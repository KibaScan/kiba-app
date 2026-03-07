#!/usr/bin/env python3
"""
M3 Session 1: Import kiba_cleaned.json into Supabase.

Inserts products, UPCs, and computes ingredients_hash (D-044).
Supplements are stored but NOT parsed into product_ingredients (D-096).
Ingredient parsing into product_ingredients is handled separately.

Usage:
    python3 scripts/import/import_products.py [--dry-run] [--limit N]
"""

import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone

# Allow running from project root: python3 scripts/import/import_products.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pipeline'))

from config import get_client, JSON_PATH, ERROR_LOG_PATH, BATCH_SIZE
from validators import validate_record
from hash_utils import compute_ingredients_hash


# ─── Field Mapping ──────────────────────────────────────────────

def map_product_row(record: dict) -> dict:
    """Map a JSON record to a products table row."""

    # AAFCO statement: 'unknown' -> null, keep 'yes'/'likely' as-is
    aafco = record.get('aafco_statement')
    if aafco == 'unknown' or aafco is None:
        aafco = None

    # Preservative type: validate against allowed values
    pt = record.get('preservative_type')
    if pt not in ('natural', 'synthetic', 'mixed', 'unknown'):
        pt = 'unknown'

    # is_grain_free: yes -> true, no -> false, unknown -> false
    # Schema is BOOLEAN NOT NULL DEFAULT false, so null not allowed.
    # 'unknown' maps to false (unknown = we don't know = don't flag it).
    gf = record.get('is_grain_free')
    if gf == 'yes':
        is_gf = True
    else:
        is_gf = False

    # Score confidence based on data completeness
    # Schema is TEXT NOT NULL DEFAULT 'high', so null not allowed.
    has_ingredients = record.get('_qa_has_ingredients', False)
    has_ga = record.get('_qa_has_ga', False)
    if has_ingredients and has_ga:
        confidence = 'high'
    elif has_ingredients:
        confidence = 'partial'
    else:
        confidence = 'partial'

    # Nutritional data source: set 'manual' when GA data present
    nutritional_data_source = 'manual' if has_ga else None

    ingredients_raw = record.get('ingredients_raw') or None
    ingredients_hash = compute_ingredients_hash(ingredients_raw)

    now_ts = datetime.now(timezone.utc).isoformat()

    row = {
        'brand': record['brand'],
        'name': record['product_name'],
        'category': record['category'],
        'target_species': record['target_species'],
        'source': 'scraped',
        'aafco_statement': aafco,
        'life_stage_claim': record.get('life_stage_claim'),
        'preservative_type': pt,
        'ga_protein_pct': record.get('protein_min_pct'),
        'ga_fat_pct': record.get('fat_min_pct'),
        'ga_fiber_pct': record.get('fiber_max_pct'),
        'ga_moisture_pct': record.get('moisture_max_pct'),
        'ga_calcium_pct': record.get('calcium_pct'),
        'ga_phosphorus_pct': record.get('phosphorus_pct'),
        'ga_kcal_per_cup': record.get('kcal_per_cup'),
        'ga_kcal_per_kg': record.get('kcal_per_kg'),
        'ga_taurine_pct': record.get('taurine_pct'),
        'ga_dha_pct': record.get('dha_pct'),
        'ga_omega3_pct': record.get('omega3_pct'),
        'ga_omega6_pct': record.get('omega6_pct'),
        'ingredients_raw': ingredients_raw,
        'ingredients_hash': ingredients_hash,
        'is_grain_free': is_gf,
        'is_recalled': False,
        'score_confidence': confidence,
        'nutritional_data_source': nutritional_data_source,
        'needs_review': record.get('_ingredient_status') == 'borderline',
        'last_verified_at': now_ts,
    }

    # Strip None values so DB defaults apply
    return {k: v for k, v in row.items() if v is not None}


# ─── Batch Insert Helper ───────────────────────────────────────

def batch_insert(client, table: str, rows: list[dict], batch_start: int,
                 errors: list[dict]) -> tuple[list[dict], int]:
    """Insert a batch of rows. On batch failure, fall back to one-by-one.
    Returns (inserted_data, count)."""
    try:
        result = client.table(table).insert(rows).execute()
        return result.data, len(result.data)
    except Exception as e:
        err_msg = str(e)
        inserted_data = []
        count = 0
        # One-by-one fallback
        for i, row in enumerate(rows):
            try:
                result = client.table(table).insert(row).execute()
                inserted_data.append(result.data[0])
                count += 1
            except Exception as e2:
                errors.append({
                    "index": batch_start + i,
                    "table": table,
                    "error": str(e2)[:300],
                    "row_name": row.get('name', row.get('upc', '?'))[:80],
                })
        return inserted_data, count


# ─── Main Import ────────────────────────────────────────────────

def main():
    dry_run = '--dry-run' in sys.argv
    limit = None
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        limit = int(sys.argv[idx + 1])

    # Load data
    print(f"Loading {JSON_PATH}...")
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)

    total_in_file = len(data)
    if limit:
        data = data[:limit]
        print(f"  Limited to {limit} records")
    print(f"  {len(data)} records loaded (of {total_in_file} total)")

    if dry_run:
        print("\n=== DRY RUN MODE ===\n")

    # ─── Phase 1: Validate ────────────────────────────────────
    print("\nPhase 1: Validating records...")
    validation_errors: list[dict] = []
    valid_records: list[tuple[int, dict]] = []  # (original_index, record)

    for i, record in enumerate(data):
        error = validate_record(record, i)
        if error:
            validation_errors.append(error)
        else:
            valid_records.append((i, record))

    print(f"  Valid: {len(valid_records)}")
    print(f"  Skipped (validation): {len(validation_errors)}")
    if validation_errors:
        for ve in validation_errors[:5]:
            print(f"    [{ve['index']}] {ve['product_name'][:60]}: {ve['errors']}")

    # ─── Phase 2: Insert products ─────────────────────────────
    print("\nPhase 2: Inserting products...")
    client = get_client()
    product_id_map: dict[int, str] = {}  # original_index -> product_id
    insert_errors: list[dict] = []
    products_inserted = 0

    # Build all rows first
    mapped_rows: list[tuple[int, dict]] = []
    for orig_idx, record in valid_records:
        mapped_rows.append((orig_idx, map_product_row(record)))

    for batch_start in range(0, len(mapped_rows), BATCH_SIZE):
        batch_items = mapped_rows[batch_start:batch_start + BATCH_SIZE]
        batch_indices = [item[0] for item in batch_items]
        batch_rows = [item[1] for item in batch_items]

        if dry_run:
            for i, orig_idx in enumerate(batch_indices):
                product_id_map[orig_idx] = f"dry-run-{orig_idx}"
            products_inserted += len(batch_rows)
        else:
            inserted_data, count = batch_insert(
                client, 'products', batch_rows, batch_start, insert_errors
            )
            products_inserted += count
            for i, row_data in enumerate(inserted_data):
                product_id_map[batch_indices[i]] = row_data['id']

        total_processed = min(batch_start + BATCH_SIZE, len(mapped_rows))
        if total_processed % 500 < BATCH_SIZE or total_processed >= len(mapped_rows):
            print(f"  {products_inserted}/{len(mapped_rows)} products inserted")

    # ─── Phase 3: Insert UPCs ─────────────────────────────────
    print("\nPhase 3: Inserting UPCs...")
    upc_rows: list[dict] = []
    seen_upcs: set[str] = set()

    for orig_idx, record in valid_records:
        product_id = product_id_map.get(orig_idx)
        if not product_id:
            continue

        # Collect all UPCs for this product (primary + array)
        all_upcs: list[str] = []

        primary_upc = record.get('barcode_upc')
        if primary_upc:
            all_upcs.append(str(primary_upc))

        for upc in (record.get('upcs') or []):
            upc_str = str(upc)
            if upc_str and upc_str not in all_upcs:
                all_upcs.append(upc_str)

        for upc_str in all_upcs:
            if upc_str not in seen_upcs:
                seen_upcs.add(upc_str)
                upc_rows.append({'upc': upc_str, 'product_id': product_id})

    print(f"  {len(upc_rows)} unique UPC rows to insert")
    print(f"  {sum(1 for _, r in valid_records if not r.get('barcode_upc'))} products have no UPC")

    upcs_inserted = 0
    upc_errors: list[dict] = []

    if not dry_run:
        for batch_start in range(0, len(upc_rows), BATCH_SIZE):
            batch = upc_rows[batch_start:batch_start + BATCH_SIZE]
            inserted_data, count = batch_insert(
                client, 'product_upcs', batch, batch_start, upc_errors
            )
            upcs_inserted += count

            total_processed = min(batch_start + BATCH_SIZE, len(upc_rows))
            if total_processed % 1000 < BATCH_SIZE or total_processed >= len(upc_rows):
                print(f"  {upcs_inserted}/{len(upc_rows)} UPCs inserted")
    else:
        upcs_inserted = len(upc_rows)

    # ─── Summary ──────────────────────────────────────────────
    # Category breakdown
    cat_counts: Counter = Counter()
    species_counts: Counter = Counter()
    for orig_idx, record in valid_records:
        if orig_idx in product_id_map:
            cat_counts[record['category']] += 1
            species_counts[record['target_species']] += 1

    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"Total records in file:      {total_in_file}")
    print(f"Records processed:          {len(data)}")
    print(f"Validation failures:        {len(validation_errors)}")
    print(f"Products inserted:          {products_inserted}")
    print(f"UPCs inserted:              {upcs_inserted}")
    print(f"Product insert errors:      {len(insert_errors)}")
    print(f"UPC insert errors:          {len(upc_errors)}")
    print(f"\nBy category:")
    for cat, count in sorted(cat_counts.items()):
        print(f"  {cat:20s} {count:5d}")
    print(f"\nBy species:")
    for sp, count in sorted(species_counts.items()):
        print(f"  {sp:20s} {count:5d}")

    # GA coverage
    ga_count = sum(1 for _, r in valid_records if r.get('_qa_has_ga'))
    ing_count = sum(1 for _, r in valid_records if r.get('_qa_has_ingredients'))
    print(f"\nData coverage:")
    print(f"  With GA data:             {ga_count}")
    print(f"  With ingredients:         {ing_count}")
    print(f"  With both:                {sum(1 for _, r in valid_records if r.get('_qa_has_ga') and r.get('_qa_has_ingredients'))}")

    # ─── Write error log ──────────────────────────────────────
    all_errors = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "validation_errors": validation_errors,
        "insert_errors": insert_errors,
        "upc_errors": upc_errors,
        "summary": {
            "total_records": len(data),
            "valid": len(valid_records),
            "products_inserted": products_inserted,
            "upcs_inserted": upcs_inserted,
            "validation_failures": len(validation_errors),
            "insert_failures": len(insert_errors),
            "upc_failures": len(upc_errors),
        }
    }

    with open(ERROR_LOG_PATH, 'w') as f:
        json.dump(all_errors, f, indent=2, default=str)
    print(f"\nError log written to: {ERROR_LOG_PATH}")

    if dry_run:
        print("\n=== DRY RUN COMPLETE (no data written to Supabase) ===")


if __name__ == '__main__':
    main()
