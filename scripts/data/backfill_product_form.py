"""
Migration 010 Backfill: Populate product_form column on products table.

Two-pass strategy:
  Pass 1 — Dataset backfill: Read product_form from v6 dataset JSON, match by (brand, name).
  Pass 2 — Inference fallback: For remaining NULLs, infer from GA moisture and product name.

Usage:
  python scripts/data/backfill_product_form.py
  python scripts/data/backfill_product_form.py --dry-run
  python scripts/data/backfill_product_form.py --limit 50
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add sibling dirs to path for shared config
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'import'))

from config import get_client, JSON_PATH

# ─── Value mapping from dataset to DB enum ───────────────────

FORM_MAP = {
    'dry': 'dry',
    'wet': 'wet',
    'freeze-dried': 'freeze_dried',
    'freeze_dried': 'freeze_dried',
    'raw': 'raw',
    'dehydrated': 'dehydrated',
    # 'topper' is a product type, not a physical form — skip
}


def load_dataset_lookup() -> dict[tuple[str, str], str]:
    """Build (brand, product_name) → product_form lookup from dataset."""
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)
    print(f"Loaded {len(data)} records from dataset")

    lookup: dict[tuple[str, str], str] = {}
    skipped = 0
    for record in data:
        raw_form = record.get('product_form', '')
        mapped = FORM_MAP.get(raw_form, '')
        if not mapped:
            skipped += 1
            continue
        key = (record.get('brand', ''), record.get('product_name', ''))
        if key not in lookup:
            lookup[key] = mapped

    print(f"Dataset lookup: {len(lookup)} products with form data ({skipped} skipped)")
    return lookup


def fetch_all_products(client):
    """Fetch all products with pagination (Supabase 1000-row limit)."""
    all_products = []
    offset = 0
    page_size = 1000

    # Try selecting product_form (may not exist pre-migration)
    try:
        test = client.table('products').select('product_form').limit(1).execute()
        select_cols = 'id, brand, name, ga_moisture_pct, product_form'
    except Exception:
        print("  (product_form column not yet created — treating all as NULL)")
        select_cols = 'id, brand, name, ga_moisture_pct'

    while True:
        result = (
            client.table('products')
            .select(select_cols)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data
        all_products.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return all_products


def infer_form(product: dict) -> str | None:
    """Infer product_form from GA moisture and product name keywords."""
    name = (product.get('name') or '').lower()

    # Rule 1: High moisture → wet
    moisture = product.get('ga_moisture_pct')
    if moisture is not None and moisture > 60:
        return 'wet'

    # Rule 2: Name keywords
    if 'freeze-dried' in name or 'freeze dried' in name:
        return 'freeze_dried'

    if 'dehydrated' in name:
        return 'dehydrated'

    # Rule 3: "raw" but NOT "raw hide" / "rawhide"
    if re.search(r'\braw\b', name) and 'raw hide' not in name and 'rawhide' not in name:
        return 'raw'

    return None


def main():
    parser = argparse.ArgumentParser(description='Backfill product_form column')
    parser.add_argument('--dry-run', action='store_true', help='Print updates without writing')
    parser.add_argument('--limit', type=int, default=0, help='Limit number of updates')
    args = parser.parse_args()

    client = get_client()

    # ─── Fetch all products ──────────────────────────────────
    print("Fetching all products...")
    all_products = fetch_all_products(client)
    print(f"Total products in DB: {len(all_products)}")

    already_set = sum(1 for p in all_products if p.get('product_form'))
    print(f"Already have product_form: {already_set}")

    # ─── Pass 1: Dataset backfill ────────────────────────────
    print("\n── Pass 1: Dataset backfill ──")
    lookup = load_dataset_lookup()

    pass1_updates: list[tuple[str, str]] = []
    for product in all_products:
        if product.get('product_form'):
            continue  # Already set
        key = (product.get('brand', ''), product.get('name', ''))
        form = lookup.get(key)
        if form:
            pass1_updates.append((product['id'], form))

    print(f"Pass 1 matches: {len(pass1_updates)}")

    # Track which IDs got updated in pass 1
    pass1_ids = set(pid for pid, _ in pass1_updates)

    # ─── Pass 2: Inference fallback ──────────────────────────
    print("\n── Pass 2: Inference fallback ──")

    pass2_updates: list[tuple[str, str]] = []
    for product in all_products:
        if product.get('product_form'):
            continue
        if product['id'] in pass1_ids:
            continue
        form = infer_form(product)
        if form:
            pass2_updates.append((product['id'], form))

    print(f"Pass 2 inferences: {len(pass2_updates)}")

    # ─── Combine and apply ───────────────────────────────────
    all_updates = pass1_updates + pass2_updates

    if args.limit > 0:
        all_updates = all_updates[:args.limit]

    print(f"\nTotal updates to apply: {len(all_updates)}")

    if args.dry_run:
        print("\n[DRY RUN] Sample updates:")
        for pid, form in all_updates[:10]:
            print(f"  {pid} → {form}")
        print(f"  ... ({len(all_updates)} total)")
    else:
        errors = []
        for i, (product_id, form) in enumerate(all_updates):
            try:
                client.table('products').update({'product_form': form}).eq('id', product_id).execute()
            except Exception as e:
                errors.append({'id': product_id, 'error': str(e)[:200]})

            if (i + 1) % 500 == 0:
                print(f"  Updated {i + 1}/{len(all_updates)}...")

        print(f"\nUpdated {len(all_updates) - len(errors)} products ({len(errors)} errors)")

        if errors:
            print(f"First 5 errors:")
            for err in errors[:5]:
                print(f"  {err['id']}: {err['error']}")

    # ─── Summary ─────────────────────────────────────────────
    remaining_null = len(all_products) - already_set - len(all_updates)

    # Count by form value
    from collections import Counter
    form_counts = Counter(form for _, form in all_updates)

    print(f"\n── Summary ──")
    print(f"Already set before run:  {already_set}")
    print(f"Pass 1 (dataset):        {len(pass1_updates)}")
    print(f"Pass 2 (inference):      {len(pass2_updates)}")
    print(f"Remaining NULL:          {remaining_null}")
    print(f"\nForm breakdown (this run):")
    for form, count in form_counts.most_common():
        print(f"  {form}: {count}")

    # Write log
    log = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'total_products': len(all_products),
        'already_set': already_set,
        'pass1_dataset': len(pass1_updates),
        'pass2_inference': len(pass2_updates),
        'remaining_null': remaining_null,
        'form_counts': dict(form_counts),
        'dry_run': args.dry_run,
    }
    log_path = Path(__file__).parent / 'backfill_product_form_log.json'
    with open(log_path, 'w') as f:
        json.dump(log, f, indent=2)
    print(f"\nLog written to {log_path}")


if __name__ == '__main__':
    main()
