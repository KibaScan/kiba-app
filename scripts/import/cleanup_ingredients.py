"""
M3 Ingredient Cleanup — Fix normalization artifacts, assign severities, set cluster_ids

Fixes issues from M3 import pipeline:
1. Merges artifact entries into correct seed ingredients (remaps product_ingredients)
2. Deletes clear junk entries (CSS, JSON, HTML fragments, product descriptions)
3. Sets severity for top vitamins/minerals to 'good'
4. Sets severity for known caution ingredients
5. Assigns cluster_ids for splitting detection

Usage:
    python3 scripts/import/cleanup_ingredients.py --dry-run   # preview changes
    python3 scripts/import/cleanup_ingredients.py              # execute changes
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import get_client

OUTPUT_PATH = Path(__file__).resolve().parent / "cleanup_report.json"

# ── Artifact → correct canonical_name mappings ──────────────────
# These artifact entries should be merged into the correct seed ingredient.
# product_ingredients rows get remapped, then the artifact is deleted.
ARTIFACT_MERGES = {
    "**chicken": "chicken",
    "**beef": "beef",
    "sweet_potato*": "sweet_potatoes",
    "chicken_fat)": "chicken_fat",
    "zinc._sulfate": "zinc_sulfate",
    "rice1": "brewers_rice",  # rice1 display was "Rice1" — likely brewer's rice in vitamin block
    "brewer\u2019s_rice": "brewers_rice",  # curly apostrophe variant
    "=vegetable_glycerin": "glycerin",
    "apple_pomace*": "apple_pomace",
    "catnip*": "catnip",
    "cranberry*": "cranberry",
    "dried_bacillus_subtilis_fermentation_product*": "bacillus_subtilis",
    "kelp*": "dried_kelp",
    "pumpkin*": "pumpkin",
    "sweet_potatoes*": "sweet_potatoes",
    "tomatoes*": "tomatoes",
    "**minerals**": "minerals",
    # ── v7 re-import artifacts (session 8) ──
    "betacarotene": "beta_carotene",
    "taurina": "taurine",
    "vitamine_e": "vitamin_e",
    "dicalciumphosphate": "dicalcium_phosphate",
    "dicalcium_phosphat": "dicalcium_phosphate",
    "calciumpantothenate": "pantothenic_acid",
    "calciumcarbonate": "calcium_carbonate",
    "ascorbyl2polyphosphat": "vitamin_c",
    "ascorbyl2polyphoshate": "vitamin_c",
    "ascorbyl2polyphophate": "vitamin_c",
    "ascor_byl2polyphosphat": "vitamin_c",
    "pyrdoxine_hydrochloride": "vitamin_b6",
    "thiamine_mononitrat": "vitamin_b1",
}

# ── Severity updates ────────────────────────────────────────────
# Vitamins and beneficial supplements → 'good'/'good'
SEVERITY_GOOD = [
    "vitamin_e", "vitamin_a", "vitamin_d3",
    "vitamin_b1", "vitamin_b2", "vitamin_b3", "vitamin_b6", "vitamin_b7", "vitamin_b12",
    "selenium", "pantothenic_acid", "folate", "folic_acid",
    "choline_chloride", "glucosamine", "methionine",
    "beta_carotene", "iodide",
    "calcium_carbonate", "dicalcium_phosphate", "tricalcium_phosphate", "monocalcium_phosphate",
    "iron_sulfate", "manganese_sulfate", "zinc_oxide",
    "copper_chelated", "zinc_chelated", "manganese_chelated",
    "dried_yeast", "dried_egg", "egg",
    "citric_acid",
    "mixed_tocopherols_for_freshness",
    "bacillus_subtilis", "bacillus_coagulans",
    "bacillus_licheniformis_fermentation_product", "bacillus_coagulans_fermentation_product",
    "aspergillus_niger_fermentation_extract", "aspergillus_niger_fermentation_product",
    "aspergillus_oryzae",
    "glucosamine",
    "alfalfa_meal", "alfalfa_nutrient_concentrate",
]

# Known caution ingredients
SEVERITY_CAUTION = [
    "added_color",
    "artificial_flavors", "artificial_flavor",
    "artificial_chicken_flavor", "artificial_milk_flavor", "artificial_beef_flavor",
    "meat_by_product",
    "animal_plasma",
    "sodium_tripolyphosphate",
]

# Known danger ingredients (D-142: artificial colorants escalated to danger)
SEVERITY_DANGER = [
    "red_40", "red_3",
    "yellow_5", "yellow_6",
    "blue_1", "blue_2",
    "titanium_dioxide",
]

# ── Cluster ID assignments ──────────────────────────────────────
CLUSTER_ASSIGNMENTS = {
    "potato": "tuber_potato",
    "potatoes": "tuber_potato",
    "sweet_potatoes": "tuber_sweet_potato",
    "wheat_gluten": "grain_wheat",
    "oat_meal": "grain_oat",
    "soy_oil": "legume_soy",
    "soybean_meal": "legume_soy",
    # brewer\u2019s_rice merged into brewers_rice which already has grain_rice cluster
    "corn": "grain_corn",
    "corn_gluten_meal": "grain_corn",
    "egg": "protein_egg",
    "dried_egg": "protein_egg",
    "beef": "protein_beef",
    "beef_fat": "protein_beef",
    "beef_liver": "protein_beef",
    "beef_lung": "protein_beef",
    "beef_meal": "protein_beef",
    "beef_broth": "protein_beef",
    "beef_kidney": "protein_beef",
    "beef_bone_broth": "protein_beef",
    "beef_heart": "protein_beef",
    "beef_tripe": "protein_beef",
    "chicken": "protein_chicken",
}


def is_junk(cn: str) -> bool:
    """Detect clear junk entries that should be deleted outright."""
    if any(c in cn for c in ['{', '}', '<', '>']):
        return True
    if 'http' in cn or '.com' in cn:
        return True
    if any(pat in cn for pat in [
        'background_color', 'font_weight', 'font_size', 'line_height',
        'text_transform', 'pointer_events', 'display:flex', 'cursor:pointer',
        'search_input', 'search__suggestions', 'kib_section',
        'attributevalue', 'featuredattribute',
    ]):
        return True
    # Product descriptions leaked as ingredients
    if cn.startswith('"description"'):
        return True
    # Full product names with ** and colons
    if cn.startswith('**') and cn not in ARTIFACT_MERGES:
        return True
    # Vitamin blocks stored as single ingredient (comma-separated lists ending with ))
    if cn.startswith('vitamins,') and len(cn) > 50:
        return True
    # Colon-prefixed entries (recipe variant fragments)
    if cn.startswith(':_'):
        return True
    # Very long entries with multiple commas (ingredient list fragments)
    if len(cn) > 200 and cn.count(',') > 3:
        return True
    # GA data leaked into ingredient lists (e.g. "crude_fat60", "crude_fiber_525", "rice_3")
    if re.match(r'^crude_(fat|fiber|protein|ash|moisture)', cn) and re.search(r'\d', cn):
        return True
    if cn == 'rice_3':
        return True
    return False


def main():
    dry_run = "--dry-run" in sys.argv
    mode = "DRY RUN" if dry_run else "LIVE"
    print(f"=== Ingredient Cleanup ({mode}) ===\n")

    sb = get_client()

    # ── Load all ingredients ──
    all_ings = []
    page = 0
    while True:
        r = sb.table("ingredients_dict") \
            .select("id, canonical_name, dog_base_severity, cat_base_severity, cluster_id") \
            .order("canonical_name") \
            .range(page * 1000, (page + 1) * 1000 - 1) \
            .execute()
        all_ings.extend(r.data)
        if len(r.data) < 1000:
            break
        page += 1
    print(f"Total ingredients in DB: {len(all_ings)}")

    name_to_ing = {ing["canonical_name"]: ing for ing in all_ings}

    stats = {
        "artifacts_merged": 0,
        "junction_rows_remapped": 0,
        "junk_deleted": 0,
        "junk_junction_deleted": 0,
        "severities_updated": 0,
        "clusters_assigned": 0,
        "errors": [],
    }

    # ════════════════════════════════════════════════════════════
    # PHASE 1: Merge artifact entries into correct seeds
    # ════════════════════════════════════════════════════════════
    print("\n── Phase 1: Merge artifacts ──")

    for artifact_name, target_name in ARTIFACT_MERGES.items():
        artifact = name_to_ing.get(artifact_name)
        target = name_to_ing.get(target_name)

        if not artifact:
            print(f"  SKIP: artifact '{artifact_name}' not found in DB")
            continue
        if not target:
            print(f"  SKIP: target '{target_name}' not found in DB")
            stats["errors"].append(f"Missing merge target: {target_name}")
            continue

        artifact_id = artifact["id"]
        target_id = target["id"]

        # Count affected product_ingredients
        pi_count = sb.table("product_ingredients") \
            .select("id", count="exact") \
            .eq("ingredient_id", artifact_id) \
            .execute()
        count = pi_count.count or 0

        print(f"  {artifact_name} → {target_name}: {count} junction rows")

        if not dry_run and count > 0:
            # Handle potential duplicates: if a product already has the target ingredient,
            # we need to delete the artifact junction row instead of updating
            # (unique constraint on product_id + position would fail)
            # Strategy: delete artifact references where product already has target,
            # then update remaining
            existing = sb.table("product_ingredients") \
                .select("product_id") \
                .eq("ingredient_id", target_id) \
                .execute()
            existing_pids = {r["product_id"] for r in existing.data}

            if existing_pids:
                # Delete junction rows where product already has the target ingredient
                conflict_rows = sb.table("product_ingredients") \
                    .select("id, product_id") \
                    .eq("ingredient_id", artifact_id) \
                    .execute()
                conflict_ids = [r["id"] for r in conflict_rows.data if r["product_id"] in existing_pids]
                remap_ids = [r["id"] for r in conflict_rows.data if r["product_id"] not in existing_pids]

                if conflict_ids:
                    for i in range(0, len(conflict_ids), 100):
                        batch = conflict_ids[i:i+100]
                        sb.table("product_ingredients").delete().in_("id", batch).execute()
                    print(f"    Deleted {len(conflict_ids)} duplicate junction rows")

                if remap_ids:
                    for i in range(0, len(remap_ids), 100):
                        batch = remap_ids[i:i+100]
                        sb.table("product_ingredients") \
                            .update({"ingredient_id": target_id}) \
                            .in_("id", batch) \
                            .execute()
                    print(f"    Remapped {len(remap_ids)} junction rows")
            else:
                # No conflicts — safe to update all
                sb.table("product_ingredients") \
                    .update({"ingredient_id": target_id}) \
                    .eq("ingredient_id", artifact_id) \
                    .execute()

        if not dry_run:
            # Delete the artifact ingredient
            sb.table("ingredients_dict").delete().eq("id", artifact_id).execute()

        stats["artifacts_merged"] += 1
        stats["junction_rows_remapped"] += count

    # ════════════════════════════════════════════════════════════
    # PHASE 2: Delete clear junk entries
    # ════════════════════════════════════════════════════════════
    print("\n── Phase 2: Delete junk entries ──")

    junk_ids = []
    for ing in all_ings:
        # Skip already-merged artifacts
        if ing["canonical_name"] in ARTIFACT_MERGES:
            continue
        if is_junk(ing["canonical_name"]):
            junk_ids.append(ing["id"])

    print(f"  Found {len(junk_ids)} junk entries to delete")

    # Count junction rows referencing junk
    junk_pi_count = 0
    for i in range(0, len(junk_ids), 200):
        batch = junk_ids[i:i + 200]
        r = sb.table("product_ingredients") \
            .select("id", count="exact") \
            .in_("ingredient_id", batch) \
            .execute()
        junk_pi_count += (r.count or 0)
    print(f"  Junction rows referencing junk: {junk_pi_count}")

    if not dry_run:
        # Delete junction rows first (FK constraint)
        for i in range(0, len(junk_ids), 200):
            batch = junk_ids[i:i + 200]
            sb.table("product_ingredients").delete().in_("ingredient_id", batch).execute()

        # Delete junk ingredients
        for i in range(0, len(junk_ids), 200):
            batch = junk_ids[i:i + 200]
            sb.table("ingredients_dict").delete().in_("id", batch).execute()

    stats["junk_deleted"] = len(junk_ids)
    stats["junk_junction_deleted"] = junk_pi_count

    # ════════════════════════════════════════════════════════════
    # PHASE 3: Update severities
    # ════════════════════════════════════════════════════════════
    print("\n── Phase 3: Update severities ──")

    for cn in SEVERITY_GOOD:
        ing = name_to_ing.get(cn)
        if not ing:
            continue
        if ing["dog_base_severity"] == "good" and ing["cat_base_severity"] == "good":
            continue
        print(f"  {cn}: {ing['dog_base_severity']}/{ing['cat_base_severity']} → good/good")
        if not dry_run:
            sb.table("ingredients_dict") \
                .update({"dog_base_severity": "good", "cat_base_severity": "good"}) \
                .eq("id", ing["id"]) \
                .execute()
        stats["severities_updated"] += 1

    for cn in SEVERITY_CAUTION:
        ing = name_to_ing.get(cn)
        if not ing:
            continue
        if ing["dog_base_severity"] == "caution" and ing["cat_base_severity"] == "caution":
            continue
        print(f"  {cn}: {ing['dog_base_severity']}/{ing['cat_base_severity']} → caution/caution")
        if not dry_run:
            sb.table("ingredients_dict") \
                .update({"dog_base_severity": "caution", "cat_base_severity": "caution"}) \
                .eq("id", ing["id"]) \
                .execute()
        stats["severities_updated"] += 1

    for cn in SEVERITY_DANGER:
        ing = name_to_ing.get(cn)
        if not ing:
            continue
        if ing["dog_base_severity"] == "danger" and ing["cat_base_severity"] == "danger":
            continue
        print(f"  {cn}: {ing['dog_base_severity']}/{ing['cat_base_severity']} → danger/danger")
        if not dry_run:
            sb.table("ingredients_dict") \
                .update({"dog_base_severity": "danger", "cat_base_severity": "danger"}) \
                .eq("id", ing["id"]) \
                .execute()
        stats["severities_updated"] += 1

    # ════════════════════════════════════════════════════════════
    # PHASE 4: Assign cluster_ids
    # ════════════════════════════════════════════════════════════
    print("\n── Phase 4: Assign cluster_ids ──")

    for cn, cluster in CLUSTER_ASSIGNMENTS.items():
        ing = name_to_ing.get(cn)
        if not ing:
            continue
        if ing["cluster_id"] == cluster:
            continue
        print(f"  {cn}: {ing['cluster_id']} → {cluster}")
        if not dry_run:
            sb.table("ingredients_dict") \
                .update({"cluster_id": cluster}) \
                .eq("id", ing["id"]) \
                .execute()
        stats["clusters_assigned"] += 1

    # ════════════════════════════════════════════════════════════
    # REPORT
    # ════════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print(f"CLEANUP REPORT ({mode})")
    print(f"{'='*60}")
    print(f"Artifact entries merged:        {stats['artifacts_merged']}")
    print(f"Junction rows remapped:         {stats['junction_rows_remapped']}")
    print(f"Junk entries deleted:           {stats['junk_deleted']}")
    print(f"Junk junction rows deleted:     {stats['junk_junction_deleted']}")
    print(f"Severities updated:             {stats['severities_updated']}")
    print(f"Cluster IDs assigned:           {stats['clusters_assigned']}")
    if stats["errors"]:
        print(f"Errors:                         {len(stats['errors'])}")
        for e in stats["errors"]:
            print(f"  - {e}")

    with open(OUTPUT_PATH, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"\nReport saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
