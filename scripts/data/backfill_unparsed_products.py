#!/usr/bin/env python3
"""
P0-3 Backfill: Parse products that have ingredients_raw but no product_ingredients rows.

These products have raw ingredient text in the database but were never run through
the ingredient parsing pipeline, so they show "don't have ingredient data yet" in the app.

Reuses the M3 parse_ingredients pipeline (6-stage: clean → tokenize → normalize →
match → insert dict → insert junction). After parsing, reports affected count
and success rate.

Usage:
    python3 scripts/data/backfill_unparsed_products.py [--dry-run] [--limit N]

After running: Execute batch_score.ts to score the newly parsed products.
"""

import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'import'))

from config import get_client, BATCH_SIZE
from ingredient_matcher import IngredientMatcher, load_synonyms
from parse_ingredients import (
    clean_ingredients_raw,
    split_recipes,
    tokenize,
    expand_packs,
    split_slash_tokens,
    extract_flavor_species,
    extract_primary_name,
    strip_leading_conjunction,
    extract_preservative,
    validate_token,
    detect_space_delimited,
    fix_bare_preserved_with,
)

import re

JUNCTION_BATCH_SIZE = 500
REPORTS_DIR = Path(__file__).resolve().parent


def fetch_unparsed_products(client, limit=None):
    """
    Fetch products that have ingredients_raw but NO product_ingredients rows.
    This is the gap that causes "don't have ingredient data yet" in the app.
    """
    # Step 1: Get all product_ids that already have product_ingredients
    parsed_ids = set()
    page_size = 1000
    offset = 0
    while True:
        result = (client.table('product_ingredients')
                  .select('product_id')
                  .range(offset, offset + page_size - 1)
                  .execute())
        for row in result.data:
            parsed_ids.add(row['product_id'])
        if len(result.data) < page_size:
            break
        offset += page_size

    print(f"  Products with existing product_ingredients: {len(parsed_ids)}")

    # Step 2: Get all products with ingredients_raw
    all_products = []
    offset = 0
    while True:
        result = (client.table('products')
                  .select('id,ingredients_raw,ingredients_hash,category')
                  .not_.is_('ingredients_raw', 'null')
                  .range(offset, offset + page_size - 1)
                  .execute())
        all_products.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    # Step 3: Filter to unparsed only (have raw but no junction rows)
    unparsed = [
        p for p in all_products
        if p['id'] not in parsed_ids
        and p.get('ingredients_raw')
        and p['category'] in ('daily_food', 'treat')
    ]

    if limit:
        unparsed = unparsed[:limit]

    return unparsed


def fetch_ingredients_dict(client):
    """Fetch all ingredients_dict entries."""
    all_entries = []
    page_size = 1000
    offset = 0
    while True:
        result = (client.table('ingredients_dict')
                  .select('id,canonical_name')
                  .range(offset, offset + page_size - 1)
                  .execute())
        all_entries.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size
    return all_entries


def main():
    dry_run = '--dry-run' in sys.argv
    limit = None
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        limit = int(sys.argv[idx + 1])

    print("=" * 60)
    print("P0-3: BACKFILL UNPARSED PRODUCTS")
    print("=" * 60)

    if dry_run:
        print("\n=== DRY RUN MODE ===\n")

    # ─── Phase 1: Fetch data ──────────────────────────────
    print("\nPhase 1: Identifying unparsed products...")
    client = get_client()

    products = fetch_unparsed_products(client, limit)
    print(f"  Unparsed products found: {len(products)}")

    if len(products) == 0:
        print("\nNo unparsed products found. Nothing to do.")
        return

    dict_entries = fetch_ingredients_dict(client)
    print(f"  ingredients_dict entries: {len(dict_entries)}")

    synonyms = load_synonyms()
    print(f"  Synonyms loaded: {len(synonyms)}")

    matcher = IngredientMatcher(dict_entries, synonyms)

    # ─── Phase 2: Parse & match ────────────────────────────
    print(f"\nPhase 2: Parsing {len(products)} products...")

    # Group by ingredients_hash for deduplication
    hash_groups = defaultdict(list)
    no_hash = []
    for p in products:
        h = p.get('ingredients_hash')
        if h:
            hash_groups[h].append(p)
        else:
            no_hash.append(p)

    unique_formulas = list(hash_groups.values()) + [[p] for p in no_hash]
    print(f"  Unique formulas to parse: {len(unique_formulas)}")

    parsed_formulas = []
    new_ingredients = {}
    matched_counts = Counter()
    parsing_errors = []
    status_counts = Counter()

    for i, formula_group in enumerate(unique_formulas):
        representative = formula_group[0]
        raw = representative['ingredients_raw']
        group_size = len(formula_group)

        # Stage 1: Clean
        cleaned, status = clean_ingredients_raw(raw)
        status_counts[status] += 1

        if status in ('contaminated', 'empty'):
            parsing_errors.append({
                'product_ids': [p['id'] for p in formula_group],
                'status': status,
                'raw_preview': raw[:200] if raw else None,
            })
            continue

        cleaned = detect_space_delimited(cleaned)
        cleaned = fix_bare_preserved_with(cleaned)

        recipes = split_recipes(cleaned)
        ingredient_links = []

        for recipe_idx, (recipe_name, recipe_text) in enumerate(recipes):
            position_offset = recipe_idx * 100

            # Period-as-separator fix
            recipe_text = re.sub(r'(?<!\d)[\.\]]+\s+(?=[A-Z])', ', ', recipe_text)

            tokens = tokenize(recipe_text)
            tokens = expand_packs(tokens)
            tokens = split_slash_tokens(tokens)

            if not tokens:
                continue

            for local_pos, token in enumerate(tokens, 1):
                position = local_pos + position_offset

                flavor_species = extract_flavor_species(token)
                primary = extract_primary_name(token)

                if flavor_species:
                    flavor_bases = [
                        r'natural\s+flavou?rs?$',
                        r'animal\s+digest$',
                        r'digest$',
                        r'artificial\s+flavou?rs?$',
                        r'flavou?rs?$',
                    ]
                    if any(re.match(p, primary, re.IGNORECASE) for p in flavor_bases):
                        if re.match(r'artificial', primary, re.IGNORECASE):
                            primary = f"Artificial {flavor_species.title()} Flavor"
                        elif re.match(r'animal\s+digest', primary, re.IGNORECASE):
                            primary = f"Animal Digest ({flavor_species.title()})"
                        else:
                            primary = f"Natural {flavor_species.title()} Flavor"

                primary = strip_leading_conjunction(primary)

                preservative = extract_preservative(token)

                if not validate_token(primary):
                    continue

                result = matcher.match(primary)

                if result.ingredient_id:
                    matched_counts[result.canonical_name] += group_size
                    ingredient_links.append((
                        position, result.canonical_name,
                        result.ingredient_id, recipe_name
                    ))
                elif result.normalized:
                    normalized = result.normalized
                    if normalized not in new_ingredients:
                        new_ingredients[normalized] = {
                            'display_name': primary,
                            'count': 0,
                            'example_products': [],
                        }
                    new_ingredients[normalized]['count'] += group_size
                    if len(new_ingredients[normalized]['example_products']) < 3:
                        new_ingredients[normalized]['example_products'].append(
                            representative['id']
                        )
                    ingredient_links.append((
                        position, normalized, None, recipe_name
                    ))

                # Preservative injection
                if preservative and preservative != '__self__':
                    pres_parts = re.split(
                        r'\s+(?:and|&)\s+|/', preservative, flags=re.IGNORECASE
                    )
                    for pres_idx, pres_part in enumerate(pres_parts):
                        pres_primary = strip_leading_conjunction(pres_part.strip())
                        if not pres_primary or not validate_token(pres_primary):
                            continue
                        pres_result = matcher.match(pres_primary)
                        synth_pos = 900 + position_offset + local_pos + pres_idx
                        if pres_result.ingredient_id:
                            ingredient_links.append((
                                synth_pos, pres_result.canonical_name,
                                pres_result.ingredient_id, recipe_name
                            ))
                        elif pres_result.normalized:
                            norm_pres = pres_result.normalized
                            if norm_pres not in new_ingredients:
                                new_ingredients[norm_pres] = {
                                    'display_name': pres_primary,
                                    'count': 0,
                                    'example_products': [],
                                }
                            new_ingredients[norm_pres]['count'] += group_size
                            ingredient_links.append((
                                synth_pos, norm_pres, None, recipe_name
                            ))

        if ingredient_links:
            parsed_formulas.append((formula_group, ingredient_links))
        else:
            parsing_errors.append({
                'product_ids': [p['id'] for p in formula_group],
                'status': 'no_valid_tokens',
                'raw_preview': raw[:200],
            })

        if (i + 1) % 100 == 0 or (i + 1) == len(unique_formulas):
            print(f"  Parsed {i + 1}/{len(unique_formulas)} formulas...")

    total_positions = sum(
        len(links) * len(group)
        for group, links in parsed_formulas
    )
    matched_positions = sum(
        sum(1 for _, _, iid, _ in links if iid) * len(group)
        for group, links in parsed_formulas
    )
    match_rate = matched_positions / total_positions * 100 if total_positions else 0

    print(f"\n  Parsing results:")
    print(f"    Total ingredient-position rows: {total_positions}")
    print(f"    Matched to existing dict:       {matched_positions} ({match_rate:.1f}%)")
    print(f"    New ingredients found:          {len(new_ingredients)}")

    # ─── Phase 3: Insert new ingredients ───────────────────
    print(f"\nPhase 3: Inserting {len(new_ingredients)} new ingredients...")

    new_ingredient_ids = {}
    sorted_new = sorted(new_ingredients.items(), key=lambda x: -x[1]['count'])

    if not dry_run and sorted_new:
        for batch_start in range(0, len(sorted_new), BATCH_SIZE):
            batch = sorted_new[batch_start:batch_start + BATCH_SIZE]
            rows = []
            for canonical, info in batch:
                rows.append({
                    'canonical_name': canonical,
                    'display_name': info['display_name'],
                    'dog_base_severity': 'neutral',
                    'cat_base_severity': 'neutral',
                })

            try:
                result = client.table('ingredients_dict').insert(rows).execute()
                for entry in result.data:
                    new_ingredient_ids[entry['canonical_name']] = entry['id']
                    matcher.add_entry(entry)
            except Exception:
                for row in rows:
                    try:
                        result = client.table('ingredients_dict').insert(row).execute()
                        entry = result.data[0]
                        new_ingredient_ids[entry['canonical_name']] = entry['id']
                        matcher.add_entry(entry)
                    except Exception as e2:
                        err_str = str(e2).lower()
                        if 'duplicate' in err_str or 'unique' in err_str:
                            try:
                                existing = (client.table('ingredients_dict')
                                            .select('id,canonical_name')
                                            .eq('canonical_name', row['canonical_name'])
                                            .execute())
                                if existing.data:
                                    new_ingredient_ids[existing.data[0]['canonical_name']] = existing.data[0]['id']
                            except Exception:
                                pass
    elif dry_run:
        for canonical, _ in sorted_new:
            new_ingredient_ids[canonical] = f"dry-run-{canonical}"

    # ─── Phase 4: Insert product_ingredients ─────────────
    print(f"\nPhase 4: Inserting product_ingredients rows...")

    insert_rows = []
    for formula_group, ingredient_links in parsed_formulas:
        for product in formula_group:
            for position, canonical, ingredient_id, recipe_name in ingredient_links:
                iid = ingredient_id or new_ingredient_ids.get(canonical)
                if iid:
                    insert_rows.append({
                        'product_id': product['id'],
                        'ingredient_id': iid,
                        'position': position,
                    })

    print(f"  Total rows to insert: {len(insert_rows)}")

    pi_inserted = 0
    pi_errors = []
    pi_skipped_dupes = 0

    if not dry_run and insert_rows:
        for batch_start in range(0, len(insert_rows), JUNCTION_BATCH_SIZE):
            batch = insert_rows[batch_start:batch_start + JUNCTION_BATCH_SIZE]
            try:
                result = client.table('product_ingredients').insert(batch).execute()
                pi_inserted += len(result.data)
            except Exception:
                for row in batch:
                    try:
                        result = (client.table('product_ingredients')
                                  .insert(row).execute())
                        pi_inserted += 1
                    except Exception as e2:
                        err_str = str(e2).lower()
                        if 'duplicate' in err_str or 'unique' in err_str:
                            pi_skipped_dupes += 1
                        else:
                            pi_errors.append({
                                'product_id': row['product_id'],
                                'position': row['position'],
                                'error': str(e2)[:300],
                            })

            done = min(batch_start + JUNCTION_BATCH_SIZE, len(insert_rows))
            if done % 5000 < JUNCTION_BATCH_SIZE or done >= len(insert_rows):
                print(f"  {pi_inserted}/{len(insert_rows)} rows inserted")
    else:
        pi_inserted = len(insert_rows)

    # ─── Phase 5: Report ──────────────────────────────────
    products_successfully_parsed = sum(
        len(group) for group, links in parsed_formulas if links
    )

    report = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'total_unparsed_found': len(products),
        'unique_formulas': len(unique_formulas),
        'products_successfully_parsed': products_successfully_parsed,
        'total_junction_rows_inserted': pi_inserted,
        'new_ingredients_created': len(new_ingredient_ids),
        'parsing_errors': len(parsing_errors),
        'match_rate_pct': round(match_rate, 1),
        'status_breakdown': dict(status_counts),
        'errors': parsing_errors[:50],
    }

    report_path = REPORTS_DIR / 'backfill_unparsed_report.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)

    print("\n" + "=" * 60)
    print("BACKFILL SUMMARY")
    print("=" * 60)
    print(f"Unparsed products found:      {len(products)}")
    print(f"Unique formulas parsed:       {len(unique_formulas)}")
    print(f"Products successfully parsed:  {products_successfully_parsed}")
    print(f"product_ingredients inserted:  {pi_inserted}")
    if pi_skipped_dupes:
        print(f"Dupes skipped:                {pi_skipped_dupes}")
    if pi_errors:
        print(f"Insert errors:                {len(pi_errors)}")
    print(f"New ingredients created:       {len(new_ingredient_ids)}")
    print(f"Match rate:                   {match_rate:.1f}%")
    print(f"Parsing errors:               {len(parsing_errors)}")
    print(f"\nReport written to: {report_path}")

    if dry_run:
        print("\n=== DRY RUN COMPLETE (no data written) ===")
    else:
        print(f"\nNext step: Run batch scoring for newly parsed products:")
        print(f"  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/scoring/batch_score.ts")


if __name__ == '__main__':
    main()
