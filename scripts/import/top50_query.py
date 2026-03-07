"""
Top 50 New Ingredients by Frequency — Manual Review Export

Queries ingredients_dict for ingredients added during M3 import pipeline
(neutral severity, no cluster_id — not part of original 121 seed set).
Joins to product_ingredients for frequency count and example product names.

Output: scripts/import/top50_new_ingredients_review.json
"""

import json
import sys
from pathlib import Path

# Add parent for config import
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import get_client

OUTPUT_PATH = Path(__file__).resolve().parent / "top50_new_ingredients_review.json"


def main():
    sb = get_client()

    # ── Step 1: Get all ingredients that are likely M3-auto-added ──
    # Original seed ingredients had severity assigned; M3 auto-added got 'neutral'/'neutral'.
    # We also check for ingredients that have no display content (tldr, detail_body) since
    # seed ingredients were curated with content.
    # Strategy: neutral/neutral severity AND no tldr (unreviewed)
    print("Fetching new ingredients from ingredients_dict...")

    # Paginate to avoid 1000-row default limit
    new_ingredients = []
    page = 0
    PAGE_SIZE = 1000
    while True:
        result = sb.table("ingredients_dict") \
            .select("id, canonical_name, dog_base_severity, cat_base_severity, cluster_id, "
                    "is_unnamed_species, is_legume, cat_carb_flag, display_name, created_at") \
            .eq("dog_base_severity", "neutral") \
            .eq("cat_base_severity", "neutral") \
            .is_("tldr", "null") \
            .order("canonical_name") \
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1) \
            .execute()
        new_ingredients.extend(result.data)
        if len(result.data) < PAGE_SIZE:
            break
        page += 1

    print(f"  Found {len(new_ingredients)} unreviewed neutral ingredients")

    if not new_ingredients:
        print("No new ingredients found. Exiting.")
        return

    # ── Step 2: For each, count product_ingredients references ──
    # We'll batch query product_ingredients grouped by ingredient_id
    ingredient_ids = [ing["id"] for ing in new_ingredients]
    id_to_ing = {ing["id"]: ing for ing in new_ingredients}

    print("Counting product references (batched)...")

    # Supabase doesn't support GROUP BY via REST, so we fetch all product_ingredients
    # for these ingredient IDs and count in Python
    counts: dict[str, list[str]] = {}  # ingredient_id -> [product_id, ...]

    BATCH = 200
    for i in range(0, len(ingredient_ids), BATCH):
        batch_ids = ingredient_ids[i:i + BATCH]
        pi_result = sb.table("product_ingredients") \
            .select("ingredient_id, product_id") \
            .in_("ingredient_id", batch_ids) \
            .limit(10000) \
            .execute()

        for row in pi_result.data:
            iid = row["ingredient_id"]
            if iid not in counts:
                counts[iid] = []
            counts[iid].append(row["product_id"])

    print(f"  Processed {sum(len(v) for v in counts.values())} product_ingredient rows")

    # ── Step 3: Sort by frequency, take top 50 ──
    ranked = []
    for ing in new_ingredients:
        iid = ing["id"]
        product_ids = counts.get(iid, [])
        ranked.append({
            "ingredient_id": iid,
            "canonical_name": ing["canonical_name"],
            "display_name": ing.get("display_name"),
            "product_count": len(product_ids),
            "dog_base_severity": ing["dog_base_severity"],
            "cat_base_severity": ing["cat_base_severity"],
            "cluster_id": ing["cluster_id"],
            "is_unnamed_species": ing["is_unnamed_species"],
            "is_legume": ing["is_legume"],
            "cat_carb_flag": ing["cat_carb_flag"],
            "example_product_ids": product_ids[:3],  # up to 3 for name lookup
        })

    ranked.sort(key=lambda x: x["product_count"], reverse=True)
    top50 = ranked[:50]

    # ── Step 4: Fetch example product names ──
    print("Fetching example product names...")
    all_example_pids = set()
    for item in top50:
        all_example_pids.update(item["example_product_ids"])

    pid_to_name: dict[str, str] = {}
    example_pid_list = list(all_example_pids)
    for i in range(0, len(example_pid_list), BATCH):
        batch = example_pid_list[i:i + BATCH]
        prod_result = sb.table("products") \
            .select("id, name") \
            .in_("id", batch) \
            .execute()
        for row in prod_result.data:
            pid_to_name[row["id"]] = row["name"]

    # ── Step 5: Build final output with flags ──
    # Known danger ingredients that might have slipped through
    KNOWN_DANGER = {
        "bha", "bht", "ethoxyquin", "tbhq", "propylene_glycol",
        "red_40", "yellow_5", "yellow_6", "blue_2", "titanium_dioxide",
        "red_3", "caramel_color",
    }
    # Ingredients that should get 'caution' severity
    LIKELY_CAUTION = {
        "added_color", "artificial_flavors", "artificial_flavor",
        "artificial_chicken_flavor", "artificial_milk_flavor",
        "artificial_beef_flavor",
    }
    # Splitting cluster candidates (pea/corn/rice/potato/chicken/soy derivatives)
    CLUSTER_KEYWORDS = {
        "pea": "legume_pea", "lentil": "legume_lentil", "chickpea": "legume_chickpea",
        "corn": "grain_corn", "maize": "grain_corn",
        "rice": "grain_rice", "potato": "tuber_potato", "sweet_potato": "tuber_sweet_potato",
        "chicken": "protein_chicken", "soy": "legume_soy", "soybean": "legume_soy",
        "wheat": "grain_wheat", "barley": "grain_barley", "oat": "grain_oat",
        "salmon": "protein_salmon", "turkey": "protein_turkey", "duck": "protein_duck",
        "beef": "protein_beef", "lamb": "protein_lamb", "venison": "protein_venison",
        "tapioca": "starch_tapioca", "flaxseed": "seed_flax", "flax": "seed_flax",
    }
    # Unnamed species indicators
    UNNAMED_KEYWORDS = ["animal_fat", "animal_digest", "meat_meal", "poultry_meal",
                        "poultry_fat", "meat_byproducts", "animal_byproduct",
                        "natural_flavor", "meat_and_bone"]

    output = []
    for item in top50:
        cn = item["canonical_name"]

        # Resolve example product name
        example_names = [pid_to_name.get(pid, "?") for pid in item["example_product_ids"][:1]]

        # Flag detection
        flags = []

        # Normalization artifacts (bad canonical_names from scrape)
        if cn.startswith("**") or cn.startswith("=") or cn.endswith("*"):
            flags.append("ARTIFACT - malformed canonical_name, needs cleanup")

        if cn in KNOWN_DANGER:
            flags.append("DANGER - known harmful ingredient")

        if cn in LIKELY_CAUTION:
            flags.append("CAUTION - likely needs caution severity")

        # Check splitting cluster
        suggested_cluster = None
        for keyword, cluster in CLUSTER_KEYWORDS.items():
            if keyword in cn:
                suggested_cluster = cluster
                flags.append(f"SPLITTING - suggest cluster_id: {cluster}")
                break

        # Check unnamed species
        for pattern in UNNAMED_KEYWORDS:
            if pattern in cn:
                flags.append("UNNAMED_SPECIES - generic animal source")
                break

        output.append({
            "canonical_name": cn,
            "display_name": item["display_name"],
            "product_count": item["product_count"],
            "example_product": example_names[0] if example_names else None,
            "dog_base_severity": item["dog_base_severity"],
            "cat_base_severity": item["cat_base_severity"],
            "cluster_id": item["cluster_id"],
            "flags": flags if flags else None,
            "suggested_cluster_id": suggested_cluster,
        })

    # ── Step 6: Write output ──
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {len(output)} ingredients to {OUTPUT_PATH}")
    print("\n── Top 50 Summary ──")
    print(f"{'#':<4} {'Ingredient':<45} {'Count':<8} {'Flags'}")
    print("─" * 100)
    for i, item in enumerate(output, 1):
        flags_str = ", ".join(item["flags"]) if item["flags"] else ""
        print(f"{i:<4} {item['canonical_name']:<45} {item['product_count']:<8} {flags_str}")

    # Stats
    flagged = sum(1 for item in output if item["flags"])
    print(f"\n{flagged}/{len(output)} flagged for attention")
    zero_products = sum(1 for item in output if item["product_count"] == 0)
    if zero_products:
        print(f"{zero_products} ingredients with 0 product references (orphans)")


if __name__ == "__main__":
    main()
