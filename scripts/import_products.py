#!/usr/bin/env python3
"""
M3 Session 1: Import kiba_cleaned.json into Supabase.

Steps:
1. Insert products (all 8,868 records)
2. Insert product_upcs (junction rows)
3. Parse ingredients for non-supplement products with clean/borderline status
4. Match parsed ingredients against ingredients_dict (121 existing entries)
5. Create new ingredients_dict entries for unmatched ingredients (neutral severity)
6. Insert product_ingredients junction rows with position
7. Compute and store ingredients_hash per D-044

Usage:
    python3 scripts/import_products.py [--dry-run] [--limit N]
"""

import json
import hashlib
import re
import os
import sys
import time
from collections import Counter

from supabase import create_client

# ─── Config ──────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL")
if not SUPABASE_URL:
    sys.exit("SUPABASE_URL not set in .env")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_SERVICE_KEY:
    sys.exit("SUPABASE_SERVICE_ROLE_KEY not set in .env")

BATCH_SIZE = 100  # rows per insert call
JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "kiba_cleaned.json")

# ─── Ingredient Normalization ────────────────────────────────────

# Synonym map: raw normalized form -> existing canonical_name
# Built from analyzing the most common raw ingredient strings
SYNONYM_MAP = {
    # Proteins
    "chicken": "chicken",
    "deboned_chicken": "chicken",
    "chicken_meal": "chicken_meal",
    "chicken_byproduct_meal": "chicken_byproduct_meal",
    "chicken_by_product_meal": "chicken_byproduct_meal",
    "poultry_byproduct_meal": "poultry_byproduct_meal",
    "poultry_by_product_meal": "poultry_byproduct_meal",
    "meat_byproducts": "meat_meal",
    "meat_by_products": "meat_meal",
    "meat_and_bone_meal": "meat_and_bone_meal",
    "meat_meal": "meat_meal",
    "salmon": "salmon",
    "salmon_meal": "salmon_meal",
    "fish_meal": "fish_meal",
    "animal_digest": "animal_digest",
    "animal_fat": "animal_fat",
    "chicken_fat": "chicken_fat",
    "pea_protein": "pea_protein",
    "corn_gluten_meal": "corn_gluten_meal",
    "hydrolyzed_protein": "hydrolyzed_protein",
    "liver_meal": "liver_meal",
    "soy": "soy",
    "soybean_meal": "soy",
    "natural_flavor": "natural_flavor",
    "natural_flavors": "natural_flavor",

    # Grains
    "corn": "corn",
    "whole_grain_corn": "corn",
    "ground_whole_grain_corn": "corn",
    "wheat": "wheat",
    "whole_grain_wheat": "wheat",
    "ground_whole_grain_wheat": "wheat",
    "brown_rice": "brown_rice",
    "white_rice": "white_rice",
    "rice": "white_rice",
    "brewers_rice": "brewers_rice",
    "barley": "barley",
    "pearled_barley": "barley",
    "cracked_pearled_barley": "barley",
    "ground_barley": "barley",
    "oats": "oats",
    "oatmeal": "oats",
    "ground_oats": "oats",
    "whole_oats": "oats",
    "millet": "millet",
    "sorghum": "sorghum",
    "grain_sorghum": "sorghum",
    "ground_whole_grain_sorghum": "sorghum",

    # Legumes / starches
    "peas": "peas",
    "dried_peas": "dried_peas",
    "green_peas": "peas",
    "lentils": "lentils",
    "chickpeas": "chickpeas",
    "sweet_potatoes": "sweet_potatoes",
    "sweet_potato": "sweet_potatoes",
    "potatoes": "potatoes",
    "potato": "potatoes",
    "potato_starch": "potato_starch",
    "tapioca_starch": "tapioca_starch",
    "tapioca": "tapioca_starch",

    # Fats / oils
    "salmon_oil": "salmon_oil",
    "canola_oil": "canola_oil",
    "coconut_oil": "coconut_oil",
    "sunflower_oil": "sunflower_oil",
    "fish_oil": "fish_oil",
    "flaxseed_oil": "flaxseed_oil",
    "flaxseed": "flaxseed",

    # Fiber / veggies
    "beet_pulp": "beet_pulp",
    "dried_plain_beet_pulp": "beet_pulp",
    "plain_dried_beet_pulp": "beet_pulp",
    "tomato_pomace": "tomato_pomace",
    "dried_tomato_pomace": "tomato_pomace",
    "pumpkin": "pumpkin",
    "carrots": "carrots",
    "dried_carrots": "carrots",
    "spinach": "spinach",
    "dried_spinach": "spinach",
    "broccoli": "broccoli",
    "dried_broccoli": "broccoli",
    "kale": "kale",
    "dried_kale": "kale",
    "green_beans": "green_beans",
    "dried_green_beans": "green_beans",
    "zucchini": "zucchini",
    "celery": "celery",
    "parsley": "parsley",
    "dried_parsley": "parsley",
    "dried_kelp": "dried_kelp",
    "kelp": "dried_kelp",
    "alfalfa": "alfalfa",
    "alfalfa_meal": "alfalfa",

    # Fruits
    "blueberries": "blueberries",
    "dried_blueberries": "blueberries",
    "cranberries": "cranberries",
    "dried_cranberries": "cranberries",
    "apples": "apples",
    "dried_apples": "apples",
    "bananas": "bananas",
    "dried_bananas": "bananas",
    "pomegranate": "pomegranate",
    "papaya": "papaya",
    "mango": "mango",
    "watermelon": "watermelon",
    "coconut": "coconut_flesh",

    # Preservatives / additives
    "bha": "bha",
    "bht": "bht",
    "tbhq": "tbhq",
    "ethoxyquin": "ethoxyquin",
    "mixed_tocopherols": "mixed_tocopherols",
    "propylene_glycol": "propylene_glycol",
    "menadione": "menadione",
    "menadione_sodium_bisulfite_complex": "menadione",
    "sodium_bisulfite": "sodium_bisulfite",
    "sodium_selenite": "sodium_selenite",
    "caramel_color": "caramel_color",
    "phosphoric_acid": "phosphoric_acid",
    "sodium_hexametaphosphate": "sodium_hexametaphosphate",
    "montmorillonite_clay": "montmorillonite_clay",

    # Colors
    "red_40": "red_40",
    "yellow_5": "yellow_5",
    "yellow_6": "yellow_6",
    "blue_2": "blue_2",
    "red_3": "red_3",
    "titanium_dioxide": "titanium_dioxide",

    # Supplements / amino acids
    "taurine": "taurine",
    "l_carnitine": "l_carnitine",
    "dl_methionine": "dl_methionine",
    "glucosamine_hcl": "glucosamine_hcl",
    "glucosamine_hydrochloride": "glucosamine_hcl",
    "chondroitin_sulfate": "chondroitin_sulfate",

    # Fibers / prebiotics / probiotics
    "chicory_root": "chicory_root",
    "dried_chicory_root": "chicory_root",
    "chicory_root_extract": "chicory_root",
    "psyllium_husk": "psyllium_husk",
    "fructooligosaccharides": "fructooligosaccharides",
    "inulin": "inulin",
    "pumpkin_fiber": "pumpkin_fiber",
    "pectin": "pectin",
    "guar_gum": "guar_gum",
    "xanthan_gum": "xanthan_gum",
    "locust_bean_gum": "locust_bean_gum",
    "powdered_cellulose": "powdered_cellulose",
    "cellulose": "powdered_cellulose",

    # Fermentation products
    "dried_lactobacillus_acidophilus_fermentation_product": "dried_lactobacillus_acidophilus_fermentation_product",
    "dried_bacillus_coagulans_fermentation_product": "dried_bacillus_coagulans_fermentation_product",
    "dried_enterococcus_faecium_fermentation_product": "dried_enterococcus_faecium_fermentation_product",
    "dried_bifidobacterium_animalis_fermentation_product": "dried_bifidobacterium_animalis_fermentation_product",

    # Botanicals
    "rosemary_extract": "rosemary_extract",
    "turmeric": "turmeric",
    "green_tea_extract": "green_tea_extract",
    "ginger": "ginger",
    "cinnamon": "cinnamon",
    "yucca_schidigera_extract": "yucca_schidigera_extract",

    # Misc
    "brewers_yeast": "brewers_yeast",
    "salt": "salt",
    "potassium_chloride": "potassium_chloride",
    "sugar": "sugar",
    "corn_syrup": "corn_syrup",
    "chia_seeds": "chia_seeds",
    "quinoa": "quinoa",
    "carrageenan": "carrageenan",
    "krill_oil": "krill_oil",

    # Common proteins not yet mapped
    "beef": "beef",
    "lamb": "lamb",
    "lamb_meal": "lamb_meal",
    "turkey": "turkey",
    "turkey_meal": "turkey_meal",
    "tuna": "tuna",
    "whitefish": "whitefish",
    "whitefish_meal": "whitefish_meal",
    "duck": "duck",
    "duck_meal": "duck_meal",
    "venison": "venison",
    "venison_meal": "venison_meal",
    "rabbit": "rabbit",
    "rabbit_meal": "rabbit_meal",
    "bison": "bison",
    "bison_meal": "bison_meal",
    "beef_meal": "beef_meal",
    "pork": "pork",
    "pork_meal": "pork_meal",
    "liver": "liver",
    "chicken_liver": "chicken_liver",
    "beef_liver": "beef_liver",
    "pork_liver": "pork_liver",
    "chicken_broth": "chicken_broth",
    "beef_broth": "beef_broth",
    "turkey_broth": "turkey_broth",
    "bone_broth": "bone_broth",
    "egg": "egg",
    "eggs": "egg",
    "egg_product": "egg_product",
    "dried_egg_product": "egg_product",
    "whole_egg": "egg",

    # Common grains / starches
    "wheat_gluten": "wheat_gluten",
    "wheat_flour": "wheat_flour",
    "rice_flour": "rice_flour",
    "corn_starch": "corn_starch",
    "cornstarch": "corn_starch",
    "corn_protein_meal": "corn_gluten_meal",

    # Common misc
    "water": "water",
    "water_sufficient_for_processing": "water",
    "sufficient_water_for_processing": "water",
    "citric_acid": "citric_acid",
    "calcium_carbonate": "calcium_carbonate",
    "canola_meal": "canola_meal",
    "dicalcium_phosphate": "dicalcium_phosphate",
    "tricalcium_phosphate": "tricalcium_phosphate",
    "monocalcium_phosphate": "monocalcium_phosphate",
    "cane_molasses": "cane_molasses",

    # Beef fat with preservative note -> animal_fat or beef_fat
    "beef_fat_preserved_with_mixed_tocopherols": "beef_fat",
    "beef_fat": "beef_fat",
    "chicken_fat_preserved_with_mixed_tocopherols": "chicken_fat",
    "pork_fat": "pork_fat",
}

# Common prefixes to strip during normalization
STRIP_PREFIXES = [
    "organic_", "dried_", "dehydrated_", "ground_", "whole_grain_",
    "fresh_", "deboned_", "boneless_", "natural_", "raw_",
    "freeze_dried_", "hydrolyzed_", "fermented_",
]


def normalize_to_canonical(raw_ingredient: str) -> str:
    """Convert a raw ingredient string to a canonical_name key for lookup."""
    # Strip parenthetical and bracket content
    name = re.sub(r'\s*\([^)]*\)', '', raw_ingredient)
    name = re.sub(r'\s*\[[^\]]*\]', '', name)

    # Lowercase, strip, collapse whitespace
    name = name.lower().strip()
    name = re.sub(r'\s+', ' ', name)

    # Remove hyphens (By-Product -> By Product -> byproduct after underscore)
    name = name.replace('-', ' ')
    name = name.replace("'", "")

    # Convert spaces to underscores
    name = name.replace(' ', '_')

    # Remove trailing periods or commas
    name = name.rstrip('.,;')

    return name


def lookup_ingredient(raw_name: str, existing_dict: dict) -> str | None:
    """Try to match a raw ingredient string to an existing canonical_name.
    Returns the canonical_name if found, None otherwise."""
    canonical = normalize_to_canonical(raw_name)

    # 1. Direct match in synonym map
    if canonical in SYNONYM_MAP:
        return SYNONYM_MAP[canonical]

    # 2. Direct match in existing dict
    if canonical in existing_dict:
        return canonical

    # 3. Try stripping common prefixes
    for prefix in STRIP_PREFIXES:
        if canonical.startswith(prefix):
            stripped = canonical[len(prefix):]
            if stripped in SYNONYM_MAP:
                return SYNONYM_MAP[stripped]
            if stripped in existing_dict:
                return stripped

    # 4. Try removing trailing 's' for plurals
    if canonical.endswith('s') and canonical[:-1] in existing_dict:
        return canonical[:-1]

    return None


# ─── Hash Computation (D-044) ────────────────────────────────────

def compute_ingredients_hash(ingredients_raw: str | None) -> str | None:
    """Normalize and SHA-256 hash ingredient string per D-044."""
    if not ingredients_raw:
        return None
    # Lowercase
    normalized = ingredients_raw.lower().strip()
    # Collapse whitespace
    normalized = re.sub(r'\s+', ' ', normalized)
    # Standardize separators to comma-space
    normalized = re.sub(r'\s*,\s*', ', ', normalized)
    # Trim each entry
    parts = [p.strip() for p in normalized.split(',')]
    # Do NOT alphabetize (order = proportion per AAFCO)
    normalized = ', '.join(parts)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


# ─── Ingredient Parsing ─────────────────────────────────────────

def split_ingredients(ingredients_raw: str) -> list[str]:
    """Split raw ingredients string into individual ingredient names.
    Handles parenthetical content (don't split on commas inside parens)."""
    # Split on commas that are NOT inside parentheses or brackets
    parts = []
    depth = 0
    current = []
    for char in ingredients_raw:
        if char in '([':
            depth += 1
            current.append(char)
        elif char in ')]':
            depth = max(0, depth - 1)
            current.append(char)
        elif char == ',' and depth == 0:
            parts.append(''.join(current).strip())
            current = []
        else:
            current.append(char)
    if current:
        last = ''.join(current).strip()
        if last:
            # Remove trailing period
            last = last.rstrip('.')
            parts.append(last)

    # Filter out empty strings and vitamin/mineral supplements that are just
    # chemical names (we keep them as individual ingredients)
    return [p.strip() for p in parts if p.strip()]


# ─── Field Mapping ───────────────────────────────────────────────

def map_product_row(record: dict) -> dict:
    """Map a JSON record to a products table row."""
    # AAFCO statement transform
    aafco = record.get('aafco_statement')
    if aafco == 'unknown' or aafco is None:
        aafco_val = None
    else:
        aafco_val = aafco  # 'yes' or 'likely'

    # is_grain_free transform
    gf = record.get('is_grain_free')
    is_gf = True if gf == 'yes' else False

    # preservative_type: keep as-is if valid, null for None
    pt = record.get('preservative_type')
    if pt not in ('natural', 'synthetic', 'mixed', 'unknown'):
        pt = 'unknown'

    # Score confidence
    has_ingredients = record.get('_qa_has_ingredients', False)
    has_ga = record.get('_qa_has_ga', False)
    if has_ingredients and has_ga:
        confidence = 'high'
    else:
        confidence = 'partial'

    ingredients_raw = record.get('ingredients_raw') or None
    ingredients_hash = compute_ingredients_hash(ingredients_raw)

    row = {
        'brand': record['brand'],
        'name': record['product_name'],
        'category': record['category'],
        'target_species': record['target_species'],
        'source': 'scraped',
        'aafco_statement': aafco_val,
        'life_stage_claim': record.get('life_stage_claim'),
        'preservative_type': pt,
        'ga_protein_pct': record.get('protein_min_pct'),
        'ga_fat_pct': record.get('fat_min_pct'),
        'ga_fiber_pct': record.get('fiber_max_pct'),
        'ga_moisture_pct': record.get('moisture_max_pct'),
        # ga_calcium_pct and ga_phosphorus_pct: columns don't exist yet in prod DB
        # Will be added via migration 004. For now, skip.
        # 'ga_calcium_pct': record.get('calcium_pct'),
        # 'ga_phosphorus_pct': record.get('phosphorus_pct'),
        'ga_kcal_per_cup': record.get('kcal_per_cup'),
        'ga_kcal_per_kg': record.get('kcal_per_kg'),
        'ga_taurine_pct': record.get('taurine_pct'),
        'ga_dha_pct': record.get('dha_pct'),
        'ga_omega3_pct': record.get('omega3_pct'),
        'ga_omega6_pct': record.get('omega6_pct'),
        'ingredients_raw': ingredients_raw,
        'ingredients_hash': ingredients_hash,
        'is_grain_free': is_gf,
        'score_confidence': confidence,
        'is_recalled': False,
        'needs_review': record.get('_ingredient_status') == 'borderline',
    }

    # Strip None values to use DB defaults
    return {k: v for k, v in row.items() if v is not None}


# ─── Main Import ─────────────────────────────────────────────────

def main():
    dry_run = '--dry-run' in sys.argv
    limit = None
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        limit = int(sys.argv[idx + 1])

    print(f"Loading {JSON_PATH}...")
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)

    if limit:
        data = data[:limit]
        print(f"  Limited to {limit} records")

    print(f"  {len(data)} records loaded")

    if dry_run:
        print("\n=== DRY RUN MODE ===\n")

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # ─── Phase 1: Load existing ingredients_dict ─────────────────
    print("\nPhase 1: Loading existing ingredients_dict...")
    existing_ingredients = {}  # canonical_name -> id
    offset = 0
    while True:
        result = client.table('ingredients_dict').select('id,canonical_name').range(offset, offset + 999).execute()
        for r in result.data:
            existing_ingredients[r['canonical_name']] = r['id']
        if len(result.data) < 1000:
            break
        offset += 1000
    print(f"  {len(existing_ingredients)} existing ingredients loaded")

    # ─── Phase 2: Insert products ────────────────────────────────
    print("\nPhase 2: Inserting products...")
    product_id_map = {}  # index -> product_id (for junction tables)
    products_inserted = 0
    errors = []

    for batch_start in range(0, len(data), BATCH_SIZE):
        batch = data[batch_start:batch_start + BATCH_SIZE]
        rows = [map_product_row(r) for r in batch]

        if dry_run:
            for i, r in enumerate(rows):
                product_id_map[batch_start + i] = f"dry-run-{batch_start + i}"
            products_inserted += len(rows)
            continue

        try:
            result = client.table('products').insert(rows).execute()
            for i, inserted in enumerate(result.data):
                product_id_map[batch_start + i] = inserted['id']
            products_inserted += len(result.data)
        except Exception as e:
            err_msg = str(e)
            errors.append(f"Batch {batch_start}: {err_msg[:200]}")
            # Try one-by-one for this batch
            for i, row in enumerate(rows):
                try:
                    result = client.table('products').insert(row).execute()
                    product_id_map[batch_start + i] = result.data[0]['id']
                    products_inserted += 1
                except Exception as e2:
                    errors.append(f"  Row {batch_start + i} ({row.get('name', '?')[:50]}): {str(e2)[:150]}")

        if (batch_start + BATCH_SIZE) % 500 == 0 or batch_start + BATCH_SIZE >= len(data):
            print(f"  {products_inserted}/{len(data)} products inserted")

    print(f"  Total products inserted: {products_inserted}")
    if errors:
        print(f"  Errors ({len(errors)}):")
        for e in errors[:20]:
            print(f"    {e}")

    # ─── Phase 3: Insert UPCs ────────────────────────────────────
    print("\nPhase 3: Inserting UPCs...")
    upcs_inserted = 0
    upc_errors = []
    upc_rows = []

    for idx, record in enumerate(data):
        product_id = product_id_map.get(idx)
        if not product_id or dry_run:
            continue

        # Primary barcode
        primary_upc = record.get('barcode_upc')
        if primary_upc:
            upc_rows.append({'upc': str(primary_upc), 'product_id': product_id})

        # Additional UPCs from upcs array
        upcs_list = record.get('upcs') or []
        for upc in upcs_list:
            upc_str = str(upc)
            # Don't duplicate the primary
            if upc_str != str(primary_upc):
                upc_rows.append({'upc': upc_str, 'product_id': product_id})

    # Deduplicate UPCs (first occurrence wins)
    seen_upcs = set()
    unique_upc_rows = []
    for row in upc_rows:
        if row['upc'] not in seen_upcs:
            seen_upcs.add(row['upc'])
            unique_upc_rows.append(row)

    print(f"  {len(unique_upc_rows)} unique UPC rows to insert")

    if not dry_run:
        for batch_start in range(0, len(unique_upc_rows), BATCH_SIZE):
            batch = unique_upc_rows[batch_start:batch_start + BATCH_SIZE]
            try:
                result = client.table('product_upcs').insert(batch).execute()
                upcs_inserted += len(result.data)
            except Exception as e:
                # Try one-by-one (UPC conflicts)
                for row in batch:
                    try:
                        result = client.table('product_upcs').insert(row).execute()
                        upcs_inserted += 1
                    except Exception as e2:
                        upc_errors.append(f"UPC {row['upc']}: {str(e2)[:100]}")

            if (batch_start + BATCH_SIZE) % 1000 == 0 or batch_start + BATCH_SIZE >= len(unique_upc_rows):
                print(f"  {upcs_inserted}/{len(unique_upc_rows)} UPCs inserted")

    print(f"  Total UPCs inserted: {upcs_inserted}")
    if upc_errors:
        print(f"  UPC errors ({len(upc_errors)}):")
        for e in upc_errors[:10]:
            print(f"    {e}")

    # ─── Phase 4: Parse ingredients & build junction ─────────────
    print("\nPhase 4: Parsing ingredients...")

    # Track new ingredients we need to create
    new_ingredients = {}  # canonical_name -> first raw occurrence
    unmatched_log = Counter()  # canonical_name -> count (for reporting)

    # First pass: discover all unique ingredients
    ingredient_assignments = []  # (record_idx, position, canonical_name)

    for idx, record in enumerate(data):
        # Skip supplements (D-096)
        if record['category'] == 'supplement':
            continue

        # Skip products without usable ingredients
        status = record.get('_ingredient_status', 'missing')
        if status in ('contaminated', 'missing'):
            continue

        ingredients_raw = record.get('ingredients_raw')
        if not ingredients_raw:
            continue

        product_id = product_id_map.get(idx)
        if not product_id:
            continue

        parts = split_ingredients(ingredients_raw)

        for pos, raw_name in enumerate(parts, start=1):
            canonical = lookup_ingredient(raw_name, existing_ingredients)

            if canonical is None:
                # No synonym match - normalize raw name as new canonical
                canonical = normalize_to_canonical(raw_name)
                if not canonical:
                    continue
                unmatched_log[canonical] += 1

            # If canonical (from synonym or normalization) isn't in dict, queue for creation
            if canonical not in existing_ingredients and canonical not in new_ingredients:
                new_ingredients[canonical] = raw_name

            ingredient_assignments.append((idx, pos, canonical))

    print(f"  {len(ingredient_assignments)} ingredient assignments")
    print(f"  {len(new_ingredients)} new ingredients to create")

    # Show top unmatched for review
    if unmatched_log:
        print(f"\n  Top 30 new/unmatched ingredients:")
        for name, count in unmatched_log.most_common(30):
            print(f"    {count:4d}x  {name}")

    # ─── Phase 5: Create new ingredients_dict entries ────────────
    print("\nPhase 5: Creating new ingredients_dict entries...")
    new_ing_created = 0

    if not dry_run and new_ingredients:
        new_ing_rows = []
        for canonical, raw_name in new_ingredients.items():
            new_ing_rows.append({
                'canonical_name': canonical,
                'dog_base_severity': 'neutral',
                'cat_base_severity': 'neutral',
                'display_name': raw_name.strip(),
            })

        for batch_start in range(0, len(new_ing_rows), BATCH_SIZE):
            batch = new_ing_rows[batch_start:batch_start + BATCH_SIZE]
            try:
                result = client.table('ingredients_dict').insert(batch).execute()
                for r in result.data:
                    existing_ingredients[r['canonical_name']] = r['id']
                new_ing_created += len(result.data)
            except Exception as e:
                # One-by-one fallback
                for row in batch:
                    try:
                        result = client.table('ingredients_dict').insert(row).execute()
                        existing_ingredients[result.data[0]['canonical_name']] = result.data[0]['id']
                        new_ing_created += 1
                    except Exception as e2:
                        # Might already exist (race condition or duplicate canonical)
                        if 'duplicate' in str(e2).lower():
                            # Fetch the existing one
                            existing = client.table('ingredients_dict').select('id').eq('canonical_name', row['canonical_name']).execute()
                            if existing.data:
                                existing_ingredients[row['canonical_name']] = existing.data[0]['id']
                        else:
                            print(f"    Error creating {row['canonical_name']}: {str(e2)[:100]}")

    print(f"  Created {new_ing_created} new ingredients")

    # ─── Phase 6: Insert product_ingredients junction ────────────
    print("\nPhase 6: Inserting product_ingredients...")
    pi_inserted = 0
    pi_errors = []

    if not dry_run:
        pi_rows = []
        for record_idx, position, canonical in ingredient_assignments:
            product_id = product_id_map.get(record_idx)
            ingredient_id = existing_ingredients.get(canonical)
            if product_id and ingredient_id:
                pi_rows.append({
                    'product_id': product_id,
                    'ingredient_id': ingredient_id,
                    'position': position,
                })

        print(f"  {len(pi_rows)} junction rows to insert")

        for batch_start in range(0, len(pi_rows), BATCH_SIZE):
            batch = pi_rows[batch_start:batch_start + BATCH_SIZE]
            try:
                result = client.table('product_ingredients').insert(batch).execute()
                pi_inserted += len(result.data)
            except Exception as e:
                # One-by-one fallback (duplicate position conflicts)
                for row in batch:
                    try:
                        result = client.table('product_ingredients').insert(row).execute()
                        pi_inserted += 1
                    except Exception as e2:
                        pi_errors.append(str(e2)[:100])

            if (batch_start + BATCH_SIZE) % 5000 == 0 or batch_start + BATCH_SIZE >= len(pi_rows):
                print(f"  {pi_inserted}/{len(pi_rows)} junction rows inserted")

    print(f"  Total product_ingredients inserted: {pi_inserted}")
    if pi_errors:
        print(f"  Junction errors: {len(pi_errors)}")
        for e in pi_errors[:5]:
            print(f"    {e}")

    # ─── Summary ─────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"Products inserted:          {products_inserted}")
    print(f"UPCs inserted:              {upcs_inserted}")
    print(f"New ingredients created:    {new_ing_created}")
    print(f"Product-ingredient links:   {pi_inserted}")
    print(f"Product errors:             {len(errors)}")
    print(f"UPC errors:                 {len(upc_errors)}")
    print(f"Junction errors:            {len(pi_errors)}")

    # Category breakdown
    cat_counts = Counter(r['category'] for r in data if data.index(r) in product_id_map)
    # Faster approach:
    cat_counts = Counter()
    species_counts = Counter()
    for idx, r in enumerate(data):
        if idx in product_id_map:
            cat_counts[r['category']] += 1
            species_counts[r['target_species']] += 1

    print(f"\nBy category:   {dict(cat_counts)}")
    print(f"By species:    {dict(species_counts)}")
    print(f"Total in dict: {len(existing_ingredients)} ingredients")


if __name__ == '__main__':
    main()
