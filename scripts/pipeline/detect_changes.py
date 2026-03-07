#!/usr/bin/env python3
"""
M3 Session 3: Formula Change Detection Pipeline (D-044)

Compares re-scraped product data against stored Supabase data to detect
ingredient formula changes. When a change is detected:
- Sets score_confidence = 'under_review'
- Appends to formula_change_log JSONB array
- Updates ingredients_raw and ingredients_hash
- Re-parses product_ingredients (delete old, insert new)

Usage:
    python3 scripts/pipeline/detect_changes.py <input.json> [--dry-run] [--limit N]

Input JSON format: array of objects with at minimum:
    { "product_name": str, "brand": str, "ingredients_raw": str,
      "barcode_upc": str | null, "upcs": [str] | null }

Environment:
    SUPABASE_URL              — required
    SUPABASE_SERVICE_ROLE_KEY — required
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running from project root
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'import'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_client
from hash_utils import compute_ingredients_hash

REPORT_PATH = Path(__file__).resolve().parent / 'change_detection_report.json'
BATCH_SIZE = 100


# ─── UPC Lookup Cache ────────────────────────────────────────────

def build_upc_lookup(client) -> dict[str, str]:
    """Build UPC -> product_id map from product_upcs table."""
    lookup: dict[str, str] = {}
    offset = 0
    page_size = 1000

    while True:
        resp = client.table('product_upcs').select('upc, product_id') \
            .range(offset, offset + page_size - 1).execute()
        if not resp.data:
            break
        for row in resp.data:
            lookup[row['upc']] = row['product_id']
        if len(resp.data) < page_size:
            break
        offset += page_size

    return lookup


def build_brand_name_lookup(client) -> dict[str, str]:
    """Build (brand_lower, name_lower) -> product_id map for fallback matching."""
    lookup: dict[str, str] = {}
    offset = 0
    page_size = 1000

    while True:
        resp = client.table('products').select('id, brand, name') \
            .range(offset, offset + page_size - 1).execute()
        if not resp.data:
            break
        for row in resp.data:
            key = (row['brand'].lower().strip(), row['name'].lower().strip())
            lookup[key] = row['id']
        if len(resp.data) < page_size:
            break
        offset += page_size

    return lookup


# ─── Product Fetching ─────────────────────────────────────────────

def fetch_product(client, product_id: str) -> dict | None:
    """Fetch a single product's current data."""
    resp = client.table('products').select(
        'id, name, brand, ingredients_raw, ingredients_hash, '
        'formula_change_log, score_confidence'
    ).eq('id', product_id).execute()
    return resp.data[0] if resp.data else None


# ─── Formula Change Handling ──────────────────────────────────────

def build_change_log_entry(old_hash: str | None, new_hash: str,
                           old_raw: str | None, new_raw: str) -> dict:
    """Build a formula_change_log entry."""
    return {
        'detected_at': datetime.now(timezone.utc).isoformat(),
        'old_hash': old_hash,
        'new_hash': new_hash,
        'old_ingredients_preview': (old_raw or '')[:100],
        'new_ingredients_preview': new_raw[:100],
    }


def apply_formula_change(client, product_id: str, product: dict,
                         new_raw: str, new_hash: str, dry_run: bool) -> dict:
    """Apply a formula change to a product.

    Returns a change record for the report.
    """
    old_raw = product.get('ingredients_raw')
    old_hash = product.get('ingredients_hash')

    # Build append-only change log
    existing_log = product.get('formula_change_log') or []
    if not isinstance(existing_log, list):
        existing_log = []

    entry = build_change_log_entry(old_hash, new_hash, old_raw, new_raw)
    updated_log = existing_log + [entry]

    change_record = {
        'product_id': product_id,
        'name': product.get('name', 'Unknown'),
        'brand': product.get('brand', 'Unknown'),
        'old_hash': old_hash,
        'new_hash': new_hash,
        'old_ingredients_preview': (old_raw or '')[:100],
        'new_ingredients_preview': new_raw[:100],
        'change_number': len(updated_log),
    }

    if dry_run:
        change_record['status'] = 'dry_run'
        return change_record

    # Update product row
    update_payload = {
        'ingredients_raw': new_raw,
        'ingredients_hash': new_hash,
        'score_confidence': 'under_review',
        'formula_change_log': updated_log,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }

    try:
        client.table('products').update(update_payload).eq('id', product_id).execute()
    except Exception as e:
        change_record['status'] = 'db_error'
        change_record['error'] = str(e)[:300]
        return change_record

    # Re-parse product_ingredients: delete old junction rows, insert new
    try:
        reparse_product_ingredients(client, product_id, new_raw)
        change_record['status'] = 'updated'
    except Exception as e:
        change_record['status'] = 'updated_reparse_failed'
        change_record['reparse_error'] = str(e)[:300]

    return change_record


def reparse_product_ingredients(client, product_id: str, ingredients_raw: str):
    """Delete old product_ingredients and re-insert from new ingredients_raw.

    Uses the same parsing logic as Session 1's parse_ingredients.py.
    """
    # Delete existing junction rows
    client.table('product_ingredients').delete().eq('product_id', product_id).execute()

    # Tokenize ingredients (simple comma split — bracket-aware parsing
    # would require importing the full parse_ingredients pipeline)
    raw_parts = split_ingredients(ingredients_raw)

    # Try to match each ingredient against ingredients_dict
    junction_rows = []
    for position, raw_name in enumerate(raw_parts, start=1):
        clean = raw_name.strip()
        if not clean:
            continue

        # Look up by canonical_name (case-insensitive)
        resp = client.table('ingredients_dict').select('id') \
            .ilike('canonical_name', clean).limit(1).execute()

        if resp.data:
            ingredient_id = resp.data[0]['id']
            junction_rows.append({
                'product_id': product_id,
                'ingredient_id': ingredient_id,
                'position': position,
            })
        # If no match, skip — the ingredient might need to be added via
        # the full parse_ingredients pipeline. The product is already
        # flagged as 'under_review'.

    if junction_rows:
        # Batch insert
        for i in range(0, len(junction_rows), BATCH_SIZE):
            batch = junction_rows[i:i + BATCH_SIZE]
            client.table('product_ingredients').insert(batch).execute()


def split_ingredients(text: str) -> list[str]:
    """Split ingredient text respecting parenthetical content.

    Handles nested parens: "Chicken, Rice (Brown Rice, White Rice), Salt"
    -> ["Chicken", "Rice (Brown Rice, White Rice)", "Salt"]
    """
    parts = []
    depth = 0
    current = []

    for char in text:
        if char == '(':
            depth += 1
            current.append(char)
        elif char == ')':
            depth = max(0, depth - 1)
            current.append(char)
        elif char == ',' and depth == 0:
            part = ''.join(current).strip()
            if part:
                parts.append(part)
            current = []
        else:
            current.append(char)

    # Don't forget the last part
    part = ''.join(current).strip()
    if part:
        parts.append(part)

    return parts


# ─── Main Pipeline ────────────────────────────────────────────────

def process_rescrape(input_path: str, dry_run: bool, limit: int | None):
    """Main pipeline: compare re-scraped data against stored products."""

    # Load input
    print(f'Loading {input_path}...')
    with open(input_path, 'r') as f:
        data = json.load(f)

    total_in_file = len(data)
    if limit:
        data = data[:limit]
    print(f'  {len(data)} records loaded (of {total_in_file} total)')

    if dry_run:
        print('\n=== DRY RUN MODE ===\n')

    # Connect to Supabase
    client = get_client()

    # Build lookup tables
    print('Building UPC lookup...')
    upc_lookup = build_upc_lookup(client)
    print(f'  {len(upc_lookup)} UPCs loaded')

    print('Building brand+name lookup...')
    brand_name_lookup = build_brand_name_lookup(client)
    print(f'  {len(brand_name_lookup)} products loaded')

    # Process each record
    stats = {
        'total': len(data),
        'matched': 0,
        'no_match_new': 0,
        'no_ingredients': 0,
        'verified_unchanged': 0,
        'formula_changed': 0,
        'errors': 0,
    }

    changes: list[dict] = []
    new_products: list[dict] = []
    verified: list[str] = []

    now_ts = datetime.now(timezone.utc).isoformat()

    for i, record in enumerate(data):
        if (i + 1) % 500 == 0:
            print(f'  Processing {i + 1}/{len(data)}...')

        new_raw = record.get('ingredients_raw')
        if not new_raw:
            stats['no_ingredients'] += 1
            continue

        # Step 1: Match by UPC
        product_id = None
        all_upcs = []

        primary_upc = record.get('barcode_upc')
        if primary_upc:
            all_upcs.append(str(primary_upc))
        for upc in (record.get('upcs') or []):
            upc_str = str(upc)
            if upc_str and upc_str not in all_upcs:
                all_upcs.append(upc_str)

        for upc in all_upcs:
            if upc in upc_lookup:
                product_id = upc_lookup[upc]
                break

        # Step 2: Fallback to brand+name match
        if not product_id:
            brand = (record.get('brand') or '').lower().strip()
            name = (record.get('product_name') or '').lower().strip()
            if brand and name:
                product_id = brand_name_lookup.get((brand, name))

        # Step 3: No match = new product
        if not product_id:
            stats['no_match_new'] += 1
            new_products.append({
                'brand': record.get('brand', 'Unknown'),
                'name': record.get('product_name', 'Unknown'),
                'upcs': all_upcs,
            })
            continue

        stats['matched'] += 1

        # Step 4: Compute new hash and compare
        new_hash = compute_ingredients_hash(new_raw)

        # Fetch current product data
        product = fetch_product(client, product_id)
        if not product:
            stats['errors'] += 1
            continue

        old_hash = product.get('ingredients_hash')

        if new_hash == old_hash:
            # No change — update last_verified_at
            stats['verified_unchanged'] += 1
            verified.append(product_id)

            if not dry_run:
                try:
                    client.table('products').update({
                        'last_verified_at': now_ts,
                    }).eq('id', product_id).execute()
                except Exception as e:
                    print(f'  Error updating last_verified_at for {product_id}: {e}')
        else:
            # Formula change detected
            stats['formula_changed'] += 1
            change = apply_formula_change(
                client, product_id, product, new_raw, new_hash, dry_run
            )
            changes.append(change)
            print(f'  CHANGE: {product.get("brand")} — {product.get("name")} '
                  f'(change #{change.get("change_number", "?")})')

    # Batch update last_verified_at for verified products (more efficient)
    # Already done one-by-one above since Supabase Python client doesn't
    # support bulk update by ID list easily.

    # Write report
    report = {
        'run_at': now_ts,
        'dry_run': dry_run,
        'input_file': input_path,
        'summary': stats,
        'formula_changes': changes,
        'new_products': new_products[:50],  # Cap at 50 for readability
        'new_products_total': len(new_products),
    }

    with open(REPORT_PATH, 'w') as f:
        json.dump(report, f, indent=2)
    print(f'\nReport written to {REPORT_PATH}')

    # Print summary
    print(f'\n{"="*60}')
    print(f'CHANGE DETECTION COMPLETE {"(DRY RUN)" if dry_run else ""}')
    print(f'{"="*60}')
    print(f'  Total records:          {stats["total"]}')
    print(f'  Matched to existing:    {stats["matched"]}')
    print(f'  Verified unchanged:     {stats["verified_unchanged"]}')
    print(f'  Formula changes:        {stats["formula_changed"]}')
    print(f'  New products (no match):{stats["no_match_new"]}')
    print(f'  No ingredients:         {stats["no_ingredients"]}')
    print(f'  Errors:                 {stats["errors"]}')

    if changes:
        print(f'\nChanged products:')
        for c in changes:
            print(f'  - {c.get("brand")} / {c.get("name")} '
                  f'({c.get("status", "unknown")})')

    if new_products:
        print(f'\nNew products (first 10):')
        for np in new_products[:10]:
            print(f'  - {np["brand"]} / {np["name"]}')


def main():
    parser = argparse.ArgumentParser(
        description='M3 Formula Change Detection — compare re-scraped data against Supabase'
    )
    parser.add_argument(
        'input_file',
        help='Path to re-scraped JSON file'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Compare only, no DB writes'
    )
    parser.add_argument(
        '--limit', type=int, default=0,
        help='Max records to process (0 = all)'
    )
    args = parser.parse_args()

    if not os.path.exists(args.input_file):
        print(f'ERROR: Input file not found: {args.input_file}')
        sys.exit(1)

    process_rescrape(
        args.input_file,
        args.dry_run,
        args.limit if args.limit > 0 else None,
    )


if __name__ == '__main__':
    main()
