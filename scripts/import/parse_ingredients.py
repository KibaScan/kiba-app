#!/usr/bin/env python3
"""
M3 Session 1: Parse ingredients_raw into product_ingredients junction table.

6-stage pipeline per INGREDIENT_PARSING_PIPELINE.md:
  Stage 1: Clean raw text (strip trailing codes, detect contamination/truncation)
  Stage 2: Tokenize with bracket-depth parser (parenthetical content stays together)
  Stage 3: Normalize for matching (lowercase, strip prefixes, apply synonyms)
  Stage 4: Match against ingredients_dict (exact -> fuzzy -> new)
  Stage 5: Insert new unknown ingredients into ingredients_dict
  Stage 6: Insert product_ingredients junction rows

Does NOT parse supplements (D-096 — stored but not scored).

Usage:
    python3 scripts/import/parse_ingredients.py [--dry-run] [--limit N]
"""

import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_client, BATCH_SIZE
from ingredient_matcher import IngredientMatcher, load_synonyms, normalize_ingredient

REPORTS_DIR = Path(__file__).resolve().parent
JUNCTION_BATCH_SIZE = 500

# ─── Stage 1: Clean Raw Text ──────────────────────────────────

CONTAMINATION_MARKERS = [
    # HTML/JSON contamination from scraping
    'verdana', 'arial', 'roboto', 'schema.org',
    '<script', '</div', 'pricecurrency', 'font-family',
    # Product descriptions scraped instead of ingredients
    'can help', 'won\'t make', 'support normal', 'improve vitality',
    # JSON contamination
    '"url', '"description',
]


def clean_ingredients_raw(text: str) -> tuple[str, str]:
    """Clean raw ingredient text.

    Returns (cleaned_text, status).
    Status: 'clean', 'truncated', 'contaminated', 'empty'
    """
    if not text or not text.strip():
        return '', 'empty'

    text = text.strip()

    # Check for HTML/JSON contamination
    text_lower = text.lower()
    if any(marker in text_lower for marker in CONTAMINATION_MARKERS):
        return text, 'contaminated'

    # Strip trailing product codes (e.g., M444922, A415423)
    text = re.sub(r'\.\s*[A-Z]?\d{4,}\s*$', '.', text)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    # Normalize quotes
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    text = text.replace('\u201c', '"').replace('\u201d', '"')

    # Remove non-printable characters
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # Strip leading/trailing periods
    text = text.strip('. ')

    # Check for truncation: unbalanced brackets indicate cut-off mid-vitamin-pack
    open_count = text.count('(') + text.count('[')
    close_count = text.count(')') + text.count(']')
    if open_count > close_count:
        return text, 'truncated'

    return text, 'clean'


# ─── Stage 2: Tokenize ────────────────────────────────────────

def tokenize(text: str) -> list[str]:
    """Split ingredients on commas, respecting parenthetical groups.

    Uses bracket-depth tracking: only splits on commas at depth 0.
    "Animal Fat (Preserved With BHA & Citric Acid)" stays as one token.
    """
    tokens = []
    depth = 0
    current = ''

    for char in text:
        if char in '([':
            depth += 1
            current += char
        elif char in ')]':
            depth = max(0, depth - 1)
            current += char
        elif char == ',' and depth == 0:
            token = current.strip()
            if token:
                tokens.append(token)
            current = ''
        else:
            current += char

    # Last token
    token = current.strip()
    if token:
        tokens.append(token)

    return tokens


def expand_packs(tokens: list[str]) -> list[str]:
    """Expand vitamin/mineral packs into individual ingredients.

    "VITAMINS [Vitamin E Supplement, Niacin, ...]" becomes individual tokens.
    Handles both brackets [...] and parens (...), with or without colons.
    Also handles unclosed packs (truncated ingredient lists).
    """
    expanded = []

    for token in tokens:
        # Match pack headers: VITAMINS [...], Minerals (...), Trace Minerals: (...)
        pack_match = re.match(
            r'^(vitamins?|minerals?|trace minerals?)\s*[:.]?\s*[\(\[](.+)',
            token, re.IGNORECASE | re.DOTALL
        )
        if pack_match:
            contents = pack_match.group(2)
            # Strip trailing close bracket/paren if present
            contents = re.sub(r'[\)\]]\s*\.?\s*$', '', contents)
            sub_tokens = tokenize(contents)
            if sub_tokens:
                expanded.extend(sub_tokens)
            else:
                expanded.append(token)  # Fallback: keep original
        else:
            expanded.append(token)

    return expanded


def extract_primary_name(token: str) -> str:
    """Extract primary ingredient name, stripping parenthetical metadata.

    "Animal Fat (Source Of Omega 6 Fatty Acids)" -> "Animal Fat"
    "Chicken Fat (Preserved With Mixed Tocopherols)" -> "Chicken Fat"
    "Red 40" -> "Red 40"
    """
    # Strip parenthetical content
    result = re.sub(r'\s*\(.*$', '', token).strip()
    result = re.sub(r'\s*\[.*$', '', result).strip()
    # Strip trailing period
    result = result.rstrip('.').strip()
    return result if result else token


# ─── Supabase Helpers ──────────────────────────────────────────

def fetch_products(client, limit=None):
    """Fetch daily_food and treat products with ingredients_raw."""
    all_products = []
    page_size = 1000
    offset = 0

    while True:
        result = (client.table('products')
                  .select('id,ingredients_raw,ingredients_hash,category')
                  .range(offset, offset + page_size - 1)
                  .execute())
        all_products.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    # Filter in Python (reliable across supabase-py versions)
    filtered = [
        p for p in all_products
        if p.get('ingredients_raw')
        and p['category'] in ('daily_food', 'treat')
    ]

    if limit:
        filtered = filtered[:limit]

    return filtered


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


# ─── Main Pipeline ─────────────────────────────────────────────

def main():
    dry_run = '--dry-run' in sys.argv
    limit = None
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        limit = int(sys.argv[idx + 1])

    print("=" * 60)
    print("M3 INGREDIENT PARSER")
    print("=" * 60)

    if dry_run:
        print("\n=== DRY RUN MODE ===\n")

    # ─── Phase 1: Fetch data ──────────────────────────────
    print("\nPhase 1: Fetching data from Supabase...")
    client = get_client()

    products = fetch_products(client, limit)
    print(f"  Products fetched: {len(products)} (daily_food + treat with ingredients)")

    dict_entries = fetch_ingredients_dict(client)
    print(f"  ingredients_dict entries: {len(dict_entries)}")

    synonyms = load_synonyms()
    print(f"  Synonyms loaded: {len(synonyms)}")

    matcher = IngredientMatcher(dict_entries, synonyms)

    # ─── Phase 2: Parse & match ────────────────────────────
    print("\nPhase 2: Parsing ingredients...")

    # Group by ingredients_hash for deduplication (size variants share formulas)
    hash_groups: dict[str, list[dict]] = defaultdict(list)
    no_hash: list[dict] = []
    for p in products:
        h = p.get('ingredients_hash')
        if h:
            hash_groups[h].append(p)
        else:
            no_hash.append(p)

    unique_formulas = list(hash_groups.values()) + [[p] for p in no_hash]
    print(f"  Unique formulas to parse: {len(unique_formulas)} "
          f"(from {len(products)} products)")

    # Results tracking
    parsed_formulas: list[tuple[list[dict], list[tuple]]] = []
    # Each entry: (product_group, [(position, canonical, ingredient_id)])
    new_ingredients: dict[str, dict] = {}  # normalized -> {display_name, count, ...}
    matched_counts: Counter = Counter()  # canonical_name -> count
    parsing_errors: list[dict] = []
    status_counts: Counter = Counter()

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

        # Stage 2: Tokenize
        tokens = tokenize(cleaned)
        tokens = expand_packs(tokens)

        if not tokens:
            parsing_errors.append({
                'product_ids': [p['id'] for p in formula_group],
                'status': 'no_tokens',
                'raw_preview': raw[:200],
            })
            continue

        # Stages 3-4: Normalize & match each token
        ingredient_links = []  # (position, canonical_or_normalized, ingredient_id)

        for position, token in enumerate(tokens, 1):
            primary = extract_primary_name(token)
            result = matcher.match(primary)

            if result.ingredient_id:
                matched_counts[result.canonical_name] += group_size
                ingredient_links.append((position, result.canonical_name,
                                         result.ingredient_id))
            elif result.normalized:
                normalized = result.normalized
                if normalized not in new_ingredients:
                    new_ingredients[normalized] = {
                        'display_name': primary,
                        'count': 0,
                        'example_products': [],
                        'example_positions': [],
                    }
                new_ingredients[normalized]['count'] += group_size
                if len(new_ingredients[normalized]['example_products']) < 3:
                    new_ingredients[normalized]['example_products'].append(
                        representative['id']
                    )
                    new_ingredients[normalized]['example_positions'].append(position)
                ingredient_links.append((position, normalized, None))

        parsed_formulas.append((formula_group, ingredient_links))

        # Progress
        if (i + 1) % 1000 == 0 or (i + 1) == len(unique_formulas):
            print(f"  Parsed {i + 1}/{len(unique_formulas)} formulas...")

    # Compute stats
    total_positions = sum(
        len(links) * len(group)
        for group, links in parsed_formulas
    )
    matched_positions = sum(
        sum(1 for _, _, iid in links if iid) * len(group)
        for group, links in parsed_formulas
    )
    match_rate = matched_positions / total_positions * 100 if total_positions else 0

    print(f"\n  Parsing results:")
    print(f"    Total ingredient-position rows: {total_positions}")
    print(f"    Matched to existing dict:       {matched_positions} ({match_rate:.1f}%)")
    print(f"    New ingredients found:          {len(new_ingredients)}")
    print(f"    Match tiers: {dict(matcher.stats)}")
    print(f"    Ingredient status: {dict(status_counts)}")

    # ─── Phase 3: Expand dictionary (Stage 5) ─────────────
    print(f"\nPhase 3: Inserting {len(new_ingredients)} new ingredients "
          f"into ingredients_dict...")

    new_ingredient_ids: dict[str, str] = {}  # normalized -> DB id
    dict_insert_errors: list[dict] = []

    # Sort by frequency (high-frequency first for review priority)
    sorted_new = sorted(new_ingredients.items(), key=lambda x: -x[1]['count'])

    if not dry_run and sorted_new:
        for batch_start in range(0, len(sorted_new), BATCH_SIZE):
            batch = sorted_new[batch_start:batch_start + BATCH_SIZE]
            rows = []
            for canonical, info in batch:
                rows.append({
                    'canonical_name': canonical,
                    'display_name': info['display_name'],
                    # Schema CHECK: ('danger','caution','neutral','good')
                    # 'unknown' not allowed — neutral is safe default
                    'dog_base_severity': 'neutral',
                    'cat_base_severity': 'neutral',
                })

            try:
                result = client.table('ingredients_dict').insert(rows).execute()
                for entry in result.data:
                    new_ingredient_ids[entry['canonical_name']] = entry['id']
                    matcher.add_entry(entry)
            except Exception:
                # One-by-one fallback
                for row in rows:
                    try:
                        result = client.table('ingredients_dict').insert(row).execute()
                        entry = result.data[0]
                        new_ingredient_ids[entry['canonical_name']] = entry['id']
                        matcher.add_entry(entry)
                    except Exception as e2:
                        err_str = str(e2).lower()
                        if 'duplicate' in err_str or 'unique' in err_str:
                            # Already exists (re-run), fetch existing
                            try:
                                existing = (client.table('ingredients_dict')
                                            .select('id,canonical_name')
                                            .eq('canonical_name', row['canonical_name'])
                                            .execute())
                                if existing.data:
                                    entry = existing.data[0]
                                    new_ingredient_ids[entry['canonical_name']] = entry['id']
                            except Exception:
                                pass
                        else:
                            dict_insert_errors.append({
                                'canonical_name': row['canonical_name'],
                                'error': str(e2)[:300],
                            })

            done = min(batch_start + BATCH_SIZE, len(sorted_new))
            if done % 500 < BATCH_SIZE or done >= len(sorted_new):
                print(f"  {len(new_ingredient_ids)}/{len(sorted_new)} "
                      f"new ingredients inserted")

        if dict_insert_errors:
            print(f"  Insert errors: {len(dict_insert_errors)}")
    elif dry_run:
        for canonical, _ in sorted_new:
            new_ingredient_ids[canonical] = f"dry-run-{canonical}"

    # ─── Phase 4: Load product_ingredients (Stage 6) ──────
    print(f"\nPhase 4: Building product_ingredients rows...")

    # Build all junction rows, resolving new ingredient IDs
    insert_rows: list[dict] = []
    unresolved = 0

    for formula_group, ingredient_links in parsed_formulas:
        for product in formula_group:
            for position, canonical, ingredient_id in ingredient_links:
                # Resolve ID: use existing or newly inserted
                iid = ingredient_id or new_ingredient_ids.get(canonical)
                if iid:
                    insert_rows.append({
                        'product_id': product['id'],
                        'ingredient_id': iid,
                        'position': position,
                    })
                else:
                    unresolved += 1

    print(f"  Total rows to insert: {len(insert_rows)}")
    if unresolved:
        print(f"  Skipped (unresolved ingredient_id): {unresolved}")

    pi_inserted = 0
    pi_errors: list[dict] = []
    pi_skipped_dupes = 0

    if not dry_run and insert_rows:
        for batch_start in range(0, len(insert_rows), JUNCTION_BATCH_SIZE):
            batch = insert_rows[batch_start:batch_start + JUNCTION_BATCH_SIZE]
            try:
                result = client.table('product_ingredients').insert(batch).execute()
                pi_inserted += len(result.data)
            except Exception:
                # One-by-one fallback
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
            if done % 10000 < JUNCTION_BATCH_SIZE or done >= len(insert_rows):
                print(f"  {pi_inserted}/{len(insert_rows)} rows inserted"
                      + (f" ({pi_skipped_dupes} dupes skipped)"
                         if pi_skipped_dupes else ""))
    else:
        pi_inserted = len(insert_rows)

    # ─── Phase 5: Reports ─────────────────────────────────
    print("\nPhase 5: Writing reports...")

    # matched_ingredients.json: {canonical_name: count} sorted by frequency
    matched_sorted = sorted(matched_counts.items(), key=lambda x: -x[1])
    with open(REPORTS_DIR / 'matched_ingredients.json', 'w') as f:
        json.dump(dict(matched_sorted), f, indent=2)
    print(f"  matched_ingredients.json: {len(matched_sorted)} unique ingredients")

    # new_ingredients.json: new ingredients with context for review
    new_report = [
        {'canonical_name': k, **v}
        for k, v in sorted_new
    ]
    with open(REPORTS_DIR / 'new_ingredients.json', 'w') as f:
        json.dump(new_report, f, indent=2, default=str)
    print(f"  new_ingredients.json: {len(new_report)} new ingredients for review")

    # parsing_errors.json: comprehensive error log
    with open(REPORTS_DIR / 'parsing_errors.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'parsing_errors': parsing_errors,
            'dict_insert_errors': dict_insert_errors,
            'junction_insert_errors': pi_errors[:200],
            'summary': {
                'products_processed': len(products),
                'unique_formulas': len(unique_formulas),
                'total_positions': total_positions,
                'matched_positions': matched_positions,
                'match_rate_pct': round(match_rate, 1),
                'new_ingredients_found': len(new_ingredients),
                'new_ingredients_inserted': len(new_ingredient_ids),
                'pi_rows_inserted': pi_inserted,
                'pi_dupes_skipped': pi_skipped_dupes,
                'pi_errors': len(pi_errors),
                'status_breakdown': dict(status_counts),
                'match_tiers': dict(matcher.stats),
            }
        }, f, indent=2, default=str)
    print(f"  parsing_errors.json written")

    # ─── Summary ──────────────────────────────────────────
    print("\n" + "=" * 60)
    print("PARSING SUMMARY")
    print("=" * 60)
    print(f"Products processed:         {len(products)}")
    print(f"Unique formulas parsed:     {len(unique_formulas)}")
    print(f"Ingredient status:")
    for status, count in sorted(status_counts.items()):
        print(f"  {status:20s}      {count}")
    print(f"Total ingredient positions: {total_positions}")
    print(f"Match rate:                 {match_rate:.1f}%")
    print(f"  Exact matches:            {matcher.stats.get('exact', 0)}")
    print(f"  Fuzzy matches:            {matcher.stats.get('fuzzy', 0)}")
    print(f"  New ingredients:          {matcher.stats.get('new', 0)}")
    print(f"New dict entries inserted:  {len(new_ingredient_ids)}")
    print(f"product_ingredients rows:   {pi_inserted}")
    if pi_skipped_dupes:
        print(f"  Dupes skipped (re-run):   {pi_skipped_dupes}")
    if pi_errors:
        print(f"  Insert errors:            {len(pi_errors)}")

    if sorted_new:
        print(f"\nTop 15 new ingredients by frequency:")
        for canonical, info in sorted_new[:15]:
            print(f"  {canonical:45s} {info['count']:5d} occurrences")

    # Warn if match rate below quality gate
    if match_rate < 95 and total_positions > 0:
        print(f"\n  WARNING: Match rate {match_rate:.1f}% is below 95% quality gate.")
        print(f"  Review new_ingredients.json and expand synonyms.json, then re-run.")

    if dry_run:
        print("\n=== DRY RUN COMPLETE (no data written to Supabase) ===")


if __name__ == '__main__':
    main()
