#!/usr/bin/env python3
"""
Backfill price + product_size_kg on products table from v7 dataset.

Reads the v7 master JSON, parses product_size → kg, and batch-updates
existing DB products matched via chewy_sku → barcode_upc fallback.

This is a one-time backfill for M6 Safe Swap "Great Value" slot.
Future imports use the updated map_product_row() which includes these fields.

Usage:
    python3 scripts/import/backfill_price_size.py --file dataset_kiba_v7_master-2.json --dry-run
    python3 scripts/import/backfill_price_size.py --file dataset_kiba_v7_master-2.json
"""

import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from size_parser import parse_size_to_kg


# ─── DB Helpers ─────────────────────────────────────────────────

def fetch_product_id_lookup(client) -> tuple[dict[str, str], dict[str, str]]:
    """Fetch product ID lookup maps from DB.

    Returns:
        (sku_to_id, upc_to_id) — chewy_sku→product_id and upc→product_id maps
    """
    print("  Fetching product IDs from DB...")

    sku_to_id: dict[str, str] = {}
    offset = 0
    while True:
        result = (client.table('products')
                  .select('id,chewy_sku')
                  .not_.is_('chewy_sku', 'null')
                  .range(offset, offset + 999)
                  .execute())
        for row in result.data:
            sku_to_id[row['chewy_sku']] = row['id']
        if len(result.data) < 1000:
            break
        offset += 1000

    upc_to_id: dict[str, str] = {}
    offset = 0
    while True:
        result = (client.table('product_upcs')
                  .select('upc,product_id')
                  .range(offset, offset + 999)
                  .execute())
        for row in result.data:
            upc_to_id[row['upc']] = row['product_id']
        if len(result.data) < 1000:
            break
        offset += 1000

    print(f"    chewy_sku lookup: {len(sku_to_id)} entries")
    print(f"    UPC lookup: {len(upc_to_id)} entries")
    return sku_to_id, upc_to_id


def batch_update(client, updates: list[dict], dry_run: bool) -> tuple[int, int]:
    """Batch-update products with price/size data.

    Each update dict: { 'id': product_id, 'price': ..., 'price_currency': ..., 'product_size_kg': ... }

    Returns (success_count, error_count).
    """
    success = 0
    errors = 0

    for update in updates:
        product_id = update.pop('id')
        if dry_run:
            success += 1
            continue

        try:
            client.table('products').update(update).eq('id', product_id).execute()
            success += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"    ERROR updating {product_id}: {str(e)[:120]}")

    return success, errors


# ─── Main ───────────────────────────────────────────────────────

def main():
    dry_run = '--dry-run' in sys.argv

    if '--file' not in sys.argv:
        print("Usage: python3 backfill_price_size.py --file <v7_dataset.json> [--dry-run]")
        sys.exit(1)
    file_idx = sys.argv.index('--file')
    input_file = sys.argv[file_idx + 1]

    print("=" * 60)
    print("BACKFILL: price + product_size_kg")
    print("=" * 60)
    if dry_run:
        print("*** DRY RUN MODE ***\n")

    # Load dataset
    print(f"\nLoading {input_file}...")
    with open(input_file, 'r') as f:
        data = json.load(f)
    print(f"  {len(data)} records loaded")

    # Phase 1: Parse all price + size data from dataset
    print("\nPhase 1: Parsing price + size data...")
    stats = Counter()
    parsed: list[dict] = []  # (record, price, currency, size_kg)

    for record in data:
        price = record.get('price')
        currency = record.get('price_currency', 'USD')

        # Prefer product_size (broader coverage), fall back to price_size
        size_str = record.get('product_size') or record.get('price_size')
        size_kg = parse_size_to_kg(size_str)

        has_price = price is not None
        has_size = size_kg is not None

        if has_price or has_size:
            stats['has_data'] += 1
            entry = {'record': record}
            if has_price:
                entry['price'] = float(price)
                entry['price_currency'] = currency if currency else 'USD'
                stats['has_price'] += 1
            if has_size:
                entry['product_size_kg'] = size_kg
                stats['has_size'] += 1
            if has_price and has_size:
                stats['has_both'] += 1
            parsed.append(entry)
        else:
            stats['no_data'] += 1

    print(f"  Has price:              {stats['has_price']}")
    print(f"  Has product_size_kg:    {stats['has_size']}")
    print(f"  Has both (value-ready): {stats['has_both']}")
    print(f"  No price or size:       {stats['no_data']}")

    # Size parse breakdown
    size_patterns = Counter()
    for record in data:
        sz = record.get('product_size') or record.get('price_size') or ''
        if not sz:
            size_patterns['(empty)'] += 1
        elif parse_size_to_kg(sz) is not None:
            size_patterns['parsed_ok'] += 1
        elif re.search(r'count|ct|pack', sz, re.I):
            size_patterns['count/pack'] += 1
        else:
            size_patterns['unparseable'] += 1

    print(f"\n  Size parsing breakdown:")
    for pattern, count in size_patterns.most_common():
        print(f"    {pattern:20s} {count:6d}")

    if not parsed:
        print("\nNo data to backfill.")
        return

    # Phase 2: Match to DB products
    print("\nPhase 2: Matching to database products...")

    # Add scripts/import to path for config module
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pipeline'))
    from config import get_client

    client = get_client()
    sku_to_id, upc_to_id = fetch_product_id_lookup(client)

    updates: list[dict] = []
    match_stats = Counter()

    for entry in parsed:
        record = entry['record']
        product_id = None

        # Try chewy_sku first (strongest, covers 82%)
        sku = record.get('chewy_sku')
        if sku and sku in sku_to_id:
            product_id = sku_to_id[sku]
            match_stats['chewy_sku'] += 1

        # Fallback to UPC
        if not product_id:
            upc = record.get('barcode_upc')
            if upc and str(upc) in upc_to_id:
                product_id = upc_to_id[str(upc)]
                match_stats['upc'] += 1

        if not product_id:
            match_stats['no_match'] += 1
            continue

        update = {'id': product_id}
        if 'price' in entry:
            update['price'] = entry['price']
            update['price_currency'] = entry['price_currency']
        if 'product_size_kg' in entry:
            update['product_size_kg'] = entry['product_size_kg']
        updates.append(update)

    print(f"  Matched via chewy_sku:  {match_stats['chewy_sku']}")
    print(f"  Matched via UPC:        {match_stats['upc']}")
    print(f"  No match (skipped):     {match_stats['no_match']}")
    print(f"  Total updates queued:   {len(updates)}")

    # Phase 3: Apply updates
    print(f"\nPhase 3: Applying {len(updates)} updates...")

    BATCH_SIZE = 100
    total_success = 0
    total_errors = 0

    for batch_start in range(0, len(updates), BATCH_SIZE):
        batch = updates[batch_start:batch_start + BATCH_SIZE]
        s, e = batch_update(client, batch, dry_run)
        total_success += s
        total_errors += e

        done = min(batch_start + BATCH_SIZE, len(updates))
        if done % 1000 < BATCH_SIZE or done >= len(updates):
            print(f"  {total_success}/{len(updates)} updated")

    # Summary
    print(f"\n{'=' * 60}")
    print("BACKFILL SUMMARY")
    print(f"{'=' * 60}")
    print(f"Dataset records:          {len(data)}")
    print(f"With price or size:       {stats['has_data']}")
    print(f"Value-ready (both):       {stats['has_both']}")
    print(f"DB matches found:         {total_success + total_errors}")
    print(f"Updates applied:          {total_success}")
    print(f"Update errors:            {total_errors}")

    # Coverage by category
    cat_value = Counter()
    for entry in parsed:
        record = entry['record']
        if 'price' in entry and 'product_size_kg' in entry:
            cat_value[record.get('category', '?')] += 1
    print(f"\nValue-ready by category:")
    for cat, count in sorted(cat_value.items()):
        total_cat = sum(1 for d in data if d.get('category') == cat)
        print(f"  {cat:20s} {count:5d} / {total_cat:5d} ({count/total_cat*100:.1f}%)")

    if dry_run:
        print(f"\n*** DRY RUN COMPLETE — no data written ***")


if __name__ == '__main__':
    main()
