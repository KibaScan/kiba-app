#!/usr/bin/env python3
"""
Backfill dropped dataset fields into products table.

Migration 008 adds: is_vet_diet, special_diet, image_url, feeding_guidelines.
These fields existed in dataset_kiba_v6_merged.json but were not mapped
during the M3 import (import_products.py).

This script matches products by brand + name, then patches the 4 columns.

Usage:
    python3 scripts/data/backfill_product_metadata.py [--dry-run] [--limit N]
"""

import json
import os
import sys
from datetime import datetime, timezone

# Add parent paths for imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'import'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pipeline'))

from config import get_client, JSON_PATH

BATCH_SIZE = 50


def main():
    dry_run = '--dry-run' in sys.argv
    limit = None
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        limit = int(sys.argv[idx + 1])

    # ─── Load dataset ──────────────────────────────────────────
    print(f"Loading {JSON_PATH}...")
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)
    print(f"  {len(data)} records loaded")

    # ─── Build lookup: (brand, product_name) → metadata ────────
    # Some products share brand+name (variants); we take the first match.
    lookup: dict[tuple[str, str], dict] = {}
    for record in data:
        key = (record['brand'], record['product_name'])
        if key not in lookup:
            lookup[key] = {
                'is_vet_diet': record.get('_is_vet_diet', False) or False,
                'special_diet': record.get('special_diet') or None,
                'image_url': record.get('image_url') or None,
                'feeding_guidelines': record.get('feeding_guidelines') or None,
                'source_url': record.get('source_url') or None,
            }

    print(f"  {len(lookup)} unique (brand, name) pairs in dataset")

    # ─── Fetch all products from Supabase ──────────────────────
    print("\nFetching products from Supabase...")
    client = get_client()

    # Paginate through all products (Supabase default limit is 1000)
    all_products = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            client.table('products')
            .select('id, brand, name')
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data
        all_products.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"  {len(all_products)} products in DB")

    # ─── Match and build updates ───────────────────────────────
    updates = []
    matched = 0
    unmatched = 0

    for product in all_products:
        key = (product['brand'], product['name'])
        meta = lookup.get(key)
        if meta:
            # Only include fields that have data
            patch = {}
            if meta['is_vet_diet']:
                patch['is_vet_diet'] = True
            if meta['special_diet']:
                patch['special_diet'] = meta['special_diet']
            if meta['image_url']:
                patch['image_url'] = meta['image_url']
            if meta['feeding_guidelines']:
                patch['feeding_guidelines'] = meta['feeding_guidelines']
            if meta['source_url']:
                patch['source_url'] = meta['source_url']

            if patch:
                updates.append((product['id'], patch))
            matched += 1
        else:
            unmatched += 1

    print(f"\n  Matched: {matched}")
    print(f"  Unmatched: {unmatched}")
    print(f"  Updates to apply: {len(updates)}")

    # Count what we're backfilling
    vet_count = sum(1 for _, p in updates if p.get('is_vet_diet'))
    diet_count = sum(1 for _, p in updates if p.get('special_diet'))
    img_count = sum(1 for _, p in updates if p.get('image_url'))
    feed_count = sum(1 for _, p in updates if p.get('feeding_guidelines'))
    url_count = sum(1 for _, p in updates if p.get('source_url'))
    print(f"\n  is_vet_diet = true:    {vet_count}")
    print(f"  has special_diet:      {diet_count}")
    print(f"  has image_url:         {img_count}")
    print(f"  has feeding_guidelines:{feed_count}")
    print(f"  has source_url:        {url_count}")

    if dry_run:
        print("\n=== DRY RUN — no writes ===")
        if limit:
            for pid, patch in updates[:limit]:
                print(f"  {pid}: {patch}")
        return

    # ─── Apply updates ─────────────────────────────────────────
    if limit:
        updates = updates[:limit]
        print(f"\n  Limited to {limit} updates")

    print(f"\nApplying {len(updates)} updates...")
    applied = 0
    errors = []

    for i, (product_id, patch) in enumerate(updates):
        try:
            client.table('products').update(patch).eq('id', product_id).execute()
            applied += 1
        except Exception as e:
            errors.append({'id': product_id, 'error': str(e)[:200]})

        if (i + 1) % 500 == 0 or i + 1 == len(updates):
            print(f"  {applied}/{len(updates)} applied ({len(errors)} errors)")

    # ─── Summary ───────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("BACKFILL SUMMARY")
    print("=" * 60)
    print(f"Products matched:         {matched}")
    print(f"Updates applied:          {applied}")
    print(f"Errors:                   {len(errors)}")
    if errors:
        for e in errors[:5]:
            print(f"  {e['id']}: {e['error']}")

    # Write error log
    log_path = os.path.join(os.path.dirname(__file__), 'backfill_metadata_log.json')
    log = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'matched': matched,
        'unmatched': unmatched,
        'applied': applied,
        'errors': errors,
        'counts': {
            'is_vet_diet': vet_count,
            'special_diet': diet_count,
            'image_url': img_count,
            'feeding_guidelines': feed_count,
            'source_url': url_count,
        }
    }
    with open(log_path, 'w') as f:
        json.dump(log, f, indent=2)
    print(f"\nLog written to: {log_path}")


if __name__ == '__main__':
    main()
