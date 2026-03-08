#!/usr/bin/env python3
"""
Kiba — Ingredient Severity + Flag Audit Script
Applies Rules 1-12 from the M4 audit spec.

Usage:
  python scripts/content/audit_ingredients.py --dry-run    # Preview changes, no writes
  python scripts/content/audit_ingredients.py              # Apply all rules
"""

import argparse
import csv
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl
from dotenv import load_dotenv
from supabase import create_client

# ─── Config ──────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / "data"
SEVERITY_MAP = {
    "beneficial": "good", "good": "good", "neutral": "neutral",
    "caution": "caution", "danger": "danger",
}

# ─── DB Connection ───────────────────────────────────────

def get_client():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    )
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)
    return create_client(url, key)


def fetch_all_ingredients(client):
    """Fetch all ingredients_dict rows (paginated)."""
    all_rows = []
    offset = 0
    batch = 1000
    while True:
        result = (
            client.table("ingredients_dict")
            .select("id, canonical_name, display_name, dog_base_severity, cat_base_severity, position_reduction_eligible, is_legume, review_status, tldr")
            .range(offset, offset + batch - 1)
            .execute()
        )
        all_rows.extend(result.data)
        if len(result.data) < batch:
            break
        offset += batch
    return {row["canonical_name"]: row for row in all_rows}


def fetch_occurrence_counts(client):
    """Fetch product_ingredients occurrence counts (paginated)."""
    counts = Counter()
    offset = 0
    batch = 1000
    while True:
        result = (
            client.table("product_ingredients")
            .select("ingredient_id")
            .range(offset, offset + batch - 1)
            .execute()
        )
        for r in result.data:
            counts[r["ingredient_id"]] += 1
        if len(result.data) < batch:
            break
        offset += batch
    return counts


def load_curated_entries():
    """Load all curated entries from tier xlsx files."""
    curated = {}
    files = [
        "TIER1_INGREDIENT_CONTENT.xlsx",
        "TIER1_5_INGREDIENT_CONTENT.xlsx",
        "TIER2_BATCH1_INGREDIENT_CONTENT.xlsx",
        "TIER2_Batch2_INGREDIENT_CONTENT.xlsx",
        "TIER3_VITAMINS_MINERALS_UPDATED.xlsx",
    ]
    for f in files:
        path = DATA_DIR / f
        if not path.exists():
            continue
        wb = openpyxl.load_workbook(path, read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            wb.close()
            continue
        headers = [str(h).strip().lower() if h else "" for h in rows[0]]
        cn_idx = headers.index("canonical_name")
        dog_idx = headers.index("dog_severity")
        cat_idx = headers.index("cat_severity")
        pre_idx = headers.index("position_reduction_eligible")

        for row in rows[1:]:
            if not row or not row[cn_idx]:
                continue
            cn = str(row[cn_idx]).strip()
            dog_sev = SEVERITY_MAP.get(str(row[dog_idx]).strip().lower(), "neutral") if row[dog_idx] else "neutral"
            cat_sev = SEVERITY_MAP.get(str(row[cat_idx]).strip().lower(), "neutral") if row[cat_idx] else "neutral"
            pre = row[pre_idx]
            if isinstance(pre, bool):
                pre_val = pre
            elif isinstance(pre, str):
                pre_val = pre.strip().upper() in ("TRUE", "YES", "1")
            elif pre is None:
                pre_val = None
            else:
                pre_val = bool(pre)
            curated[cn] = {"dog": dog_sev, "cat": cat_sev, "pre": pre_val}
        wb.close()
    return curated


# ─── Change Tracking ─────────────────────────────────────

class ChangeLog:
    def __init__(self):
        self.changes = []  # list of (rule, canonical_name, field, old, new)

    def add(self, rule, name, field, old_val, new_val):
        self.changes.append((rule, name, field, old_val, new_val))

    def summary_by_rule(self):
        by_rule = defaultdict(list)
        for rule, name, field, old_val, new_val in self.changes:
            by_rule[rule].append((name, field, old_val, new_val))
        return by_rule

    def print_report(self):
        by_rule = self.summary_by_rule()
        total = len(self.changes)
        print(f"\n{'='*60}")
        print(f"TOTAL CHANGES: {total}")
        print(f"{'='*60}")
        for rule in sorted(by_rule.keys()):
            items = by_rule[rule]
            print(f"\n--- {rule} ({len(items)} changes) ---")
            for name, field, old_val, new_val in sorted(items):
                print(f"  {name}: {field} {old_val} -> {new_val}")


# ─── Rule Matching Helpers ───────────────────────────────

def matches_colorant(name):
    """Rule 1: Artificial colorant patterns."""
    patterns = [
        r"(^|_)(red_#?\d)", r"(^|_)(yellow_#?\d)", r"(^|_)(blue_#?\d)",
        r"(^|_)fd.?c_", r"(^|_)artificial_color",
        r"(^|_)titanium_dioxide", r"(^|_)caramel_color",
        r"(^|_)iron_oxide",
    ]
    return any(re.search(p, name, re.IGNORECASE) for p in patterns)


def is_natural_colorant(name):
    """Exception: natural colorants stay neutral."""
    return name in ("annatto_color", "vegetable_juice_for_color", "annatto",
                    "annatto_extract", "beta_carotene", "turmeric", "turmeric_color",
                    "paprika", "beet_juice_color")


RULE2_UNNAMED_MEATS = {
    "poultry_by_products", "poultry_by_product_meal", "poultry_meal",
    "poultry_fat", "poultry_digest", "poultry_broth",
    "animal_liver", "animal_digest", "animal_fat",
    "animal_fat_preserved_with_mixed_tocopherols",
    "meat_broth", "meat_digest",
    "fish_meal", "ocean_fish_meal", "oceanfish_meal",
    "spray_dried_animal_blood_cells", "animal_plasma",
    "poultry_and_pork_digest", "d_activated_animal_sterol",
}

RULE3_NAMED_PROTEINS = {
    "beef", "tuna", "turkey", "lamb", "duck", "pork", "venison",
    "rabbit", "bison", "egg", "egg_white", "egg_product",
    "mackerel", "sardine", "herring", "cod", "trout", "quail",
}

RULE5_LEGUME_DERIVATIVES = {
    "pea_fiber", "pea_starch", "pea_flour", "pea_hull_fiber",
    "lentil_fiber", "chickpea", "chickpea_flour",
}

RULE8_SUGARS = {
    "cane_molasses", "cane_sugar", "sugar", "dextrose",
    "corn_syrup", "corn_syrup_solids",
}

# Rule 10: Parent-derivative families with word-boundary patterns
RULE10_FAMILIES = [
    # (parent_name, regex_pattern, dog_sev, cat_sev, exceptions)
    ("soy", r"(^|_)soy($|_|bean)", "caution", "caution",
     {"soy_lecithin"}),
    ("corn", r"(^|_)corn($|_)", "neutral", "caution",
     {"corn_oil", "popcorn"}),
    ("wheat", r"(^|_)wheat($|_)", "neutral", "caution",
     {"wheat_germ_oil", "buckwheat", "buckwheat_flour"}),
    ("sugar", r"(^|_)(sugar|sucrose|fructose|dextrose|cane_sugar|cane_molasses)($|_)", "caution", "caution",
     set()),
    ("salt", r"(^|_)(salt|iodized_salt|sodium_chloride)($|_)", "caution", "caution",
     {"cobalt_sulfate", "cobalt_carbonate", "basalt", "potassium_salt"}),
    ("garlic", r"(^|_)garlic($|_)", "caution", "danger",
     set()),
    ("carrageenan", r"(^|_)carrageenan($|_)", "caution", "caution",
     set()),
    ("natural_flavor", r"^natural_flavor", "caution", "caution",
     set()),
    ("spinach", r"(^|_)spinach($|_)", "neutral", "caution",
     set()),
    ("kale", r"(^|_)kale($|_)", "neutral", "caution",
     set()),
    ("iron_oxide", r"(^|_)(iron_oxide|ferric_oxide)($|_)", "caution", "caution",
     set()),
    ("menadione", r"(^|_)menadione($|_)", "caution", "caution",
     set()),
]

# Named flavors are NOT caution (species identified)
NAMED_FLAVORS = {
    "chicken_flavor", "beef_flavor", "turkey_flavor", "salmon_flavor",
    "lamb_flavor", "duck_flavor", "pork_flavor", "tuna_flavor",
}

RULE11A_UNNAMED_ORGANS = {
    "liver", "liver_meal", "meat_broth", "meat_digest",
    "fish_broth", "fish_digest", "fish_oil", "fish_stock",
    "poultry_liver", "poultry_heart",
}

RULE11B_UNNAMED_FATS = {
    "vegetable_oil", "animal_fat", "poultry_fat", "vegetable_broth",
}

RULE11C_GENERIC_FLAVORS = {
    "natural_flavor", "natural_flavors", "artificial_flavor", "artificial_flavors",
    "artificial_beef_flavor", "animal_digest", "poultry_digest",
    "poultry_and_pork_digest", "liver_flavor",
}

# Rule 12: position_reduction_eligible
R12_FALSE_COLORANT_PATTERNS = [
    r"(^|_)(red_#?\d|yellow_#?\d|blue_#?\d|fd.?c_|caramel_color|titanium_dioxide|iron_oxide)",
]
R12_FALSE_PRESERVATIVES = {
    "bha", "bht", "ethoxyquin", "tbhq",
    "sodium_nitrite", "sodium_bisulfite",
    "propylene_glycol", "menadione",
    "menadione_sodium_bisulfite_complex",
    "menadione_dimethylpyrimidinol_bisulfite",
}
R12_FALSE_SUGARS = {
    "sugar", "cane_sugar", "cane_molasses", "molasses",
    "corn_syrup", "corn_syrup_solids", "dextrose", "sucrose", "fructose",
    "sorbitol", "glycerin",
}
R12_FALSE_SUPPLEMENTS = {
    "taurine", "l_carnitine", "l-carnitine", "l_lysine", "l-lysine",
    "dl-methionine", "dl_methionine", "folic_acid", "biotin",
    "choline_chloride", "thiamine_mononitrate", "calcium_pantothenate",
    "pyridoxine_hydrochloride", "riboflavin", "niacin", "nicotinic_acid",
    "beta_carotene", "ascorbic_acid",
    "iron_sulfate", "zinc_sulfate", "copper_sulfate",
    "manganese_sulfate", "calcium_iodate", "sodium_selenite",
    "potassium_iodide", "potassium_chloride",
    "ethylenediamine_dihydroiodide",
    "glucosamine", "glucosamine_hydrochloride",
    "chondroitin_sulfate",
}

R12_TRUE_PLANT_GRAINS = {
    "brown_rice", "white_rice", "brewers_rice", "rice_flour", "oat_meal",
    "oatmeal", "barley", "sorghum", "millet", "quinoa",
    "pea_protein", "pea_protein_concentrate", "soybean_meal",
    "corn_gluten_meal", "wheat_gluten", "wheat_flour",
    "potato_starch", "tapioca_starch", "pea_starch", "pea_flour",
    "sweet_potato", "potato", "chickpea", "lentils", "dried_peas",
}
R12_TRUE_FIBERS = {
    "beet_pulp", "pea_fiber", "cellulose", "psyllium_husk",
    "tomato_pomace", "apple_pomace", "chicory_root",
    "lentil_fiber", "pea_hull_fiber", "oat_fiber",
    "miscanthus_grass",
}
R12_TRUE_UNNAMED_MEATS = {
    "meat_meal", "meat_and_bone_meal", "poultry_meal",
    "poultry_by_products", "meat_by_product", "animal_digest",
    "poultry_fat", "animal_fat", "vegetable_oil", "fish_meal",
    "ocean_fish_meal", "poultry_digest", "liver", "animal_liver",
}

NAMED_PROTEIN_PREFIXES = [
    "chicken", "beef", "turkey", "salmon", "lamb", "duck", "pork",
    "venison", "rabbit", "bison", "tuna", "mackerel", "sardine",
    "herring", "cod", "trout", "quail", "whitefish", "catfish", "menhaden",
]


# ─── Rule Application ────────────────────────────────────

def apply_rules(db_ingredients, curated, log, dry_run):
    """Apply all rules. Returns list of (id, update_dict) pairs."""
    updates = []  # (id, {field: new_val, ...})

    def queue_update(rule, name, row, field, new_val):
        old_val = row.get(field)
        if old_val == new_val:
            return
        log.add(rule, name, field, old_val, new_val)
        # Find existing pending update for this id or create new
        for u_id, u_dict in updates:
            if u_id == row["id"]:
                u_dict[field] = new_val
                return
        updates.append((row["id"], {field: new_val}))

    # ── Rule 1: Artificial colorants → caution/caution ──
    for name, row in db_ingredients.items():
        if matches_colorant(name) and not is_natural_colorant(name):
            if row["dog_base_severity"] == "neutral":
                queue_update("R1-colorant", name, row, "dog_base_severity", "caution")
            if row["cat_base_severity"] == "neutral":
                queue_update("R1-colorant", name, row, "cat_base_severity", "caution")

    # ── Rule 2: Unnamed animal sources → caution/caution ──
    for name in RULE2_UNNAMED_MEATS:
        row = db_ingredients.get(name)
        if row and row["dog_base_severity"] == "neutral":
            queue_update("R2-unnamed-meat", name, row, "dog_base_severity", "caution")
        if row and row["cat_base_severity"] == "neutral":
            queue_update("R2-unnamed-meat", name, row, "cat_base_severity", "caution")

    # ── Rule 3: Named whole proteins → good/good ──
    for name in RULE3_NAMED_PROTEINS:
        row = db_ingredients.get(name)
        if row and row["dog_base_severity"] == "neutral":
            queue_update("R3-named-protein", name, row, "dog_base_severity", "good")
        if row and row["cat_base_severity"] == "neutral":
            queue_update("R3-named-protein", name, row, "cat_base_severity", "good")

    # ── Rule 5: Legume derivatives — verify is_legume = true ──
    for name in RULE5_LEGUME_DERIVATIVES:
        row = db_ingredients.get(name)
        if row and not row.get("is_legume"):
            queue_update("R5-legume-flag", name, row, "is_legume", True)

    # ── Rule 8: Sugars → caution/caution ──
    for name in RULE8_SUGARS:
        row = db_ingredients.get(name)
        if row and row["dog_base_severity"] == "neutral":
            queue_update("R8-sugar", name, row, "dog_base_severity", "caution")
        if row and row["cat_base_severity"] == "neutral":
            queue_update("R8-sugar", name, row, "cat_base_severity", "caution")

    # ── Rule 9: Generic vegetable_oil → caution/caution ──
    row = db_ingredients.get("vegetable_oil")
    if row and row["dog_base_severity"] == "neutral":
        queue_update("R9-unnamed-oil", "vegetable_oil", row, "dog_base_severity", "caution")
    if row and row["cat_base_severity"] == "neutral":
        queue_update("R9-unnamed-oil", "vegetable_oil", row, "cat_base_severity", "caution")

    # ── Rule 10: Parent-derivative severity inheritance ──
    for parent_name, pattern, dog_sev, cat_sev, exceptions in RULE10_FAMILIES:
        regex = re.compile(pattern, re.IGNORECASE)
        for name, row in db_ingredients.items():
            if name == parent_name:
                continue
            if name in exceptions:
                continue
            if name in NAMED_FLAVORS:
                continue
            if not regex.search(name):
                continue
            # Check for false substring matches
            if parent_name == "salt" and name in (
                "cobalt_sulfate", "cobalt_carbonate", "basalt",
            ):
                continue
            if parent_name == "corn" and "acorn" in name:
                continue
            if parent_name == "wheat" and "buckwheat" in name:
                continue
            # Apply inheritance
            if dog_sev != "neutral" and row["dog_base_severity"] == "neutral":
                queue_update(f"R10-inherit({parent_name})", name, row, "dog_base_severity", dog_sev)
            if cat_sev != "neutral" and row["cat_base_severity"] == "neutral":
                queue_update(f"R10-inherit({parent_name})", name, row, "cat_base_severity", cat_sev)

    # ── Rule 11a: Unnamed organ meats → caution/caution ──
    for name in RULE11A_UNNAMED_ORGANS:
        row = db_ingredients.get(name)
        if row and row["dog_base_severity"] == "neutral":
            queue_update("R11a-unnamed-organ", name, row, "dog_base_severity", "caution")
        if row and row["cat_base_severity"] == "neutral":
            queue_update("R11a-unnamed-organ", name, row, "cat_base_severity", "caution")

    # ── Rule 11b: Unnamed fats/oils → caution/caution ──
    for name in RULE11B_UNNAMED_FATS:
        row = db_ingredients.get(name)
        if row and row["dog_base_severity"] == "neutral":
            queue_update("R11b-unnamed-fat", name, row, "dog_base_severity", "caution")
        if row and row["cat_base_severity"] == "neutral":
            queue_update("R11b-unnamed-fat", name, row, "cat_base_severity", "caution")

    # ── Rule 11c: Generic flavors/digests → caution/caution ──
    for name in RULE11C_GENERIC_FLAVORS:
        row = db_ingredients.get(name)
        if row and row["dog_base_severity"] == "neutral":
            queue_update("R11c-generic-flavor", name, row, "dog_base_severity", "caution")
        if row and row["cat_base_severity"] == "neutral":
            queue_update("R11c-generic-flavor", name, row, "cat_base_severity", "caution")

    # ── Rule 12a: position_reduction_eligible — category-based ──

    for name, row in db_ingredients.items():
        current_pre = row.get("position_reduction_eligible")

        # FALSE — presence-based concerns
        should_be_false = False
        false_rule = None

        # Colorants
        if any(re.search(p, name, re.IGNORECASE) for p in R12_FALSE_COLORANT_PATTERNS):
            should_be_false = True
            false_rule = "R12a-colorant"
        # Preservatives
        elif name in R12_FALSE_PRESERVATIVES:
            should_be_false = True
            false_rule = "R12a-preservative"
        # Sugars
        elif name in R12_FALSE_SUGARS:
            should_be_false = True
            false_rule = "R12a-sugar"
        # Supplements
        elif name in R12_FALSE_SUPPLEMENTS:
            should_be_false = True
            false_rule = "R12a-supplement"
        # Vitamins
        elif re.match(r"^vitamin_", name, re.IGNORECASE):
            should_be_false = True
            false_rule = "R12a-vitamin"
        # Mineral compounds (sulfate, proteinate, chelate, etc.)
        elif re.search(r"_(sulfate|proteinate|chelate|oxide|chloride|iodate|carbonate|phosphate|selenite|gluconate)$", name):
            should_be_false = True
            false_rule = "R12a-mineral"
        # Probiotics/fermentation
        elif re.search(r"(fermentation_product|lactobacillus|bacillus|enterococcus|probiotic|prebiotic)", name, re.IGNORECASE):
            should_be_false = True
            false_rule = "R12a-probiotic"

        if should_be_false and current_pre is not False:
            queue_update(false_rule, name, row, "position_reduction_eligible", False)
            continue

        # TRUE — quality-proportional
        should_be_true = False
        true_rule = None

        # Named animal proteins
        if any(re.match(rf"^{prefix}(_|$)", name) for prefix in NAMED_PROTEIN_PREFIXES):
            if "flavor" not in name and "digest" not in name:
                should_be_true = True
                true_rule = "R12a-named-protein"
        # Named fats/oils
        elif re.match(r"^(chicken_fat|salmon_oil|flaxseed|sunflower|canola_oil|coconut_oil|fish_oil|herring_oil)", name):
            should_be_true = True
            true_rule = "R12a-named-fat"
        # Plant proteins/grains
        elif name in R12_TRUE_PLANT_GRAINS:
            should_be_true = True
            true_rule = "R12a-plant-grain"
        # Fibers
        elif name in R12_TRUE_FIBERS:
            should_be_true = True
            true_rule = "R12a-fiber"
        # Unnamed meats (position matters — worse as primary)
        elif name in R12_TRUE_UNNAMED_MEATS:
            should_be_true = True
            true_rule = "R12a-unnamed-meat"

        if should_be_true and current_pre is not True:
            queue_update(true_rule, name, row, "position_reduction_eligible", True)

    # ── Rule 12b: Curated master list overrides ──
    for cn, entry in curated.items():
        row = db_ingredients.get(cn)
        if not row:
            continue
        if entry["pre"] is not None and row.get("position_reduction_eligible") != entry["pre"]:
            queue_update("R12b-curated", cn, row, "position_reduction_eligible", entry["pre"])

    return updates


# ─── DB Write ─────────────────────────────────────────────

def apply_updates(client, updates, dry_run):
    """Apply all queued updates to DB."""
    if dry_run:
        print(f"\n[DRY RUN] Would apply {len(updates)} updates")
        return

    success = 0
    errors = 0
    for row_id, update_dict in updates:
        try:
            client.table("ingredients_dict").update(update_dict).eq("id", row_id).execute()
            success += 1
        except Exception as e:
            print(f"  ERROR updating {row_id}: {e}")
            errors += 1

    print(f"\nDB updates: {success} success, {errors} errors")


# ─── Rule 12c: Export unknowns ────────────────────────────

def export_position_unknowns(db_ingredients, occ_counts, log):
    """Export ingredients where position_reduction_eligible is still NULL and occ >= 5."""
    # Rebuild ingredient state after applying changes (in-memory)
    applied = {}
    for rule, name, field, old_val, new_val in log.changes:
        if field == "position_reduction_eligible":
            applied[name] = new_val

    rows = []
    for name, row in db_ingredients.items():
        pre = applied.get(name, row.get("position_reduction_eligible"))
        if pre is not None:
            continue
        occ = occ_counts.get(row["id"], 0)
        if occ < 5:
            continue
        rows.append({
            "canonical_name": name,
            "dog_base_severity": row["dog_base_severity"],
            "cat_base_severity": row["cat_base_severity"],
            "position_reduction_eligible": "",
            "occurrence_count": occ,
        })

    rows.sort(key=lambda x: -x["occurrence_count"])

    path = DATA_DIR / "needs_position_review.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["canonical_name", "dog_base_severity", "cat_base_severity", "position_reduction_eligible", "occurrence_count"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nExported {len(rows)} ingredients needing position_reduction_eligible review → {path}")
    return rows


# ─── Main ─────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Kiba Ingredient Severity + Flag Audit")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    print("Connecting to Supabase...")
    client = get_client()

    print("Fetching all ingredients...")
    db_ingredients = fetch_all_ingredients(client)
    print(f"  {len(db_ingredients)} ingredients loaded")

    print("Fetching occurrence counts...")
    occ_counts = fetch_occurrence_counts(client)
    print(f"  {len(occ_counts)} ingredients have product occurrences")

    print("Loading curated entries from tier files...")
    curated = load_curated_entries()
    print(f"  {len(curated)} curated entries loaded")

    print("\nApplying Rules 1-12...")
    log = ChangeLog()
    updates = apply_rules(db_ingredients, curated, log, args.dry_run)

    # Print detailed report
    log.print_report()

    # Apply to DB
    apply_updates(client, updates, args.dry_run)

    # Rule 12 summary
    pre_changes = [c for c in log.changes if c[2] == "position_reduction_eligible"]
    pre_false = sum(1 for c in pre_changes if c[4] is False)
    pre_true = sum(1 for c in pre_changes if c[4] is True)
    print(f"\nRule 12 summary:")
    print(f"  Set to FALSE (presence-based): {pre_false}")
    print(f"  Set to TRUE (quality-proportional): {pre_true}")

    # Count NULLs remaining
    applied_pre = {c[1] for c in pre_changes}
    still_null = sum(
        1 for name, row in db_ingredients.items()
        if row.get("position_reduction_eligible") is None and name not in applied_pre
    )
    print(f"  Still NULL: {still_null}")

    # Export unknowns for review
    export_position_unknowns(db_ingredients, occ_counts, log)

    # Overall severity summary after changes
    sev_changes = [c for c in log.changes if "severity" in c[2]]
    print(f"\nSeverity changes: {len(sev_changes)}")
    flag_changes = [c for c in log.changes if c[2] == "is_legume"]
    print(f"is_legume flag changes: {len(flag_changes)}")

    if args.dry_run:
        print("\n[DRY RUN COMPLETE — no changes written to DB]")
    else:
        print("\n[AUDIT COMPLETE — all changes applied]")


if __name__ == "__main__":
    main()
