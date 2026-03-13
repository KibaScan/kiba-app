#!/usr/bin/env python3
"""
Export uncovered ingredients (NULL tldr, >= 1 product occurrence),
grouped by family for efficient batch content generation.

Usage:
  python scripts/content/export_uncovered_grouped.py
"""

import csv
import os
import re
from collections import Counter, defaultdict

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env")


def get_client():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    )
    return create_client(url, key)


def fetch_all(client, table, columns):
    all_rows = []
    offset = 0
    while True:
        r = client.table(table).select(columns).range(offset, offset + 999).execute()
        all_rows.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000
    return all_rows


# ── Known chemical families ──────────────────────────────────
CHEMICAL_FAMILIES = {
    "iron": ["ferrous", "iron", "ferric"],
    "zinc": ["zinc"],
    "manganese": ["manganese"],
    "copper": ["copper", "cupric"],
    "selenium": ["selenium", "sodium_selenite", "selenomethionine"],
    "cobalt": ["cobalt"],
    "iodine": ["iodine", "iodate", "iodide", "ethylenediamine_dihydriodide"],
    "calcium": ["calcium", "tricalcium", "dicalcium"],
    "potassium": ["potassium"],
    "sodium": ["sodium"],
    "magnesium": ["magnesium"],
    "phosphorus": ["phosphorus", "phosphate", "phosphoric"],
    "choline": ["choline"],
    "taurine": ["taurine"],
    "biotin": ["biotin", "d_biotin"],
    "thiamine": ["thiamine", "thiamin"],
    "riboflavin": ["riboflavin"],
    "niacin": ["niacin", "niacinamide", "nicotinic"],
    "pantothenic": ["pantothenic", "pantothenate", "d_pantothenate", "d_calcium_pantothenate"],
    "pyridoxine": ["pyridoxine"],
    "folic_acid": ["folic", "folate"],
    "vitamin_b12": ["cobalamin", "cyanocobalamin", "vitamin_b12"],
    "omega": ["omega", "dha", "epa"],
    "fish_oil": ["fish_oil", "salmon_oil", "menhaden"],
    "probiotic": [
        "lactobacillus", "enterococcus", "bacillus", "bifidobacterium",
        "pediococcus", "saccharomyces", "aspergillus",
    ],
    "joint_support": ["glucosamine", "chondroitin", "msm"],
    "carotenoid": ["beta_carotene", "lycopene", "lutein", "astaxanthin"],
    "tocopherol": ["tocopherol", "tocopheryl"],
    "l_carnitine": ["l_carnitine", "carnitine"],
    "amino_acid": [
        "dl_methionine", "l_lysine", "l_threonine", "l_tryptophan",
        "l_cysteine", "l_tyrosine", "methionine_hydroxy",
    ],
    "rosemary": ["rosemary"],
    "yucca": ["yucca"],
    "kelp": ["kelp", "seaweed"],
    "flaxseed": ["flaxseed", "flax"],
    "chicory": ["chicory"],
    "cranberry": ["cranberry", "cranberries"],
    "blueberry": ["blueberry", "blueberries"],
    "turmeric": ["turmeric", "curcumin"],
    "green_tea": ["green_tea"],
    "marigold": ["marigold", "calendula"],
}

SUFFIXES = [
    "_supplement", "_chelate", "_chelated", "_proteinate",
    "_polysaccharide_complex", "_amino_acid_chelate", "_amino_acid_complex",
    "_complex", "_sulfate", "_sulphate", "_oxide", "_hydrochloride",
    "_carbonate", "_chloride", "_citrate", "_gluconate", "_lactate",
    "_acetate", "_succinate", "_fumarate", "_mononitrate", "_monohydrate",
    "_glycinate", "_methionine_hydroxy_analogue", "_trihydrate",
]


def assign_family(name, cluster_id):
    """Assign an ingredient to a family for grouping."""
    # Strategy 1: Use cluster_id if present
    if cluster_id:
        return cluster_id

    # Strategy 2: Known chemical families (check full word boundaries)
    for family, keywords in CHEMICAL_FAMILIES.items():
        for kw in keywords:
            if name == kw or name.startswith(kw + "_") or name.endswith("_" + kw):
                return family
            # Interior match: _kw_
            if ("_" + kw + "_") in name:
                return family

    # Strategy 3: vitamin_ prefix grouping
    if name.startswith("vitamin_"):
        m = re.match(r"(vitamin_[a-z]\d*)", name)
        if m:
            return m.group(1)
        return "vitamin_other"

    # Strategy 4: mineral_ prefix
    if name.startswith("mineral_"):
        return "mineral_mix"

    # Strategy 5: Strip known suffixes to find root
    stripped = name
    for suffix in sorted(SUFFIXES, key=len, reverse=True):
        if stripped.endswith(suffix):
            stripped = stripped[: -len(suffix)]
            break

    # Strategy 6: For multi-word names, use first 2 words as prefix family
    parts = stripped.split("_")
    if len(parts) >= 3:
        return "_".join(parts[:2])

    return stripped


def main():
    client = get_client()

    # ── Fetch ingredients with NULL tldr ──
    print("Fetching ingredients with NULL tldr...", flush=True)
    all_ing = []
    offset = 0
    while True:
        r = (
            client.table("ingredients_dict")
            .select("id, canonical_name, cluster_id, dog_base_severity, cat_base_severity")
            .is_("tldr", "null")
            .range(offset, offset + 999)
            .execute()
        )
        all_ing.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000
    print(f"  {len(all_ing)} ingredients with NULL tldr", flush=True)

    # ── Fetch occurrence counts ──
    print("Fetching product_ingredients for occurrence counts...", flush=True)
    pi_counts = Counter()
    offset = 0
    while True:
        r = (
            client.table("product_ingredients")
            .select("ingredient_id")
            .range(offset, offset + 999)
            .execute()
        )
        for row in r.data:
            pi_counts[row["ingredient_id"]] += 1
        if len(r.data) < 1000:
            break
        offset += 1000
    print(f"  {sum(pi_counts.values())} total PI rows", flush=True)

    # ── Filter to occurrence > 0 ──
    uncovered = []
    for ing in all_ing:
        count = pi_counts.get(ing["id"], 0)
        if count > 0:
            uncovered.append({**ing, "occurrence_count": count})
    print(f"  {len(uncovered)} uncovered ingredients with >= 1 occurrence\n", flush=True)

    # ── Assign families ──
    for ing in uncovered:
        ing["family"] = assign_family(ing["canonical_name"], ing.get("cluster_id"))

    # ── Sort: family, then occurrence_count desc ──
    uncovered.sort(key=lambda x: (x["family"], -x["occurrence_count"]))

    # ── Write CSV ──
    outpath = "scripts/content/data/uncovered_ingredients_grouped.csv"
    with open(outpath, "w", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "family", "canonical_name",
                "dog_base_severity", "cat_base_severity", "occurrence_count",
            ],
        )
        w.writeheader()
        for ing in uncovered:
            w.writerow({
                "family": ing["family"],
                "canonical_name": ing["canonical_name"],
                "dog_base_severity": ing["dog_base_severity"],
                "cat_base_severity": ing["cat_base_severity"],
                "occurrence_count": ing["occurrence_count"],
            })

    # ── Summary ──
    families = defaultdict(list)
    for ing in uncovered:
        families[ing["family"]].append(ing)

    print("=" * 65)
    print("UNCOVERED INGREDIENTS — GROUPED BY FAMILY")
    print("=" * 65)
    print(f"Total unique ingredients:  {len(uncovered)}")
    print(f"Total families:            {len(families)}")

    print(f"\n{'Family':<35} {'Members':>7}  {'Total Occ':>9}  Top member")
    print(f"{'-'*35} {'-'*7}  {'-'*9}  {'-'*35}")

    top_by_members = sorted(families.items(), key=lambda x: len(x[1]), reverse=True)[:25]
    for fam_name, members in top_by_members:
        total_occ = sum(m["occurrence_count"] for m in members)
        top = max(members, key=lambda m: m["occurrence_count"])
        print(
            f"{fam_name:<35} {len(members):>7}  {total_occ:>9}  "
            f"{top['canonical_name']} ({top['occurrence_count']})"
        )

    print(f"\nTop 20 families by total product occurrences:")
    print(f"{'Family':<35} {'Members':>7}  {'Total Occ':>9}")
    print(f"{'-'*35} {'-'*7}  {'-'*9}")

    top_by_occ = sorted(
        families.items(),
        key=lambda x: sum(m["occurrence_count"] for m in x[1]),
        reverse=True,
    )[:20]
    for fam_name, members in top_by_occ:
        total_occ = sum(m["occurrence_count"] for m in members)
        print(f"{fam_name:<35} {len(members):>7}  {total_occ:>9}")

    # ── Severity breakdown ──
    sev_counts = Counter()
    for ing in uncovered:
        dog = ing["dog_base_severity"] or "null"
        cat = ing["cat_base_severity"] or "null"
        sev_counts[f"dog:{dog}"] += 1
        sev_counts[f"cat:{cat}"] += 1
    print(f"\nSeverity breakdown of uncovered ingredients:")
    for key in sorted(sev_counts.keys()):
        print(f"  {key:<20} {sev_counts[key]:>5}")

    print(f"\nWritten to {outpath}")


if __name__ == "__main__":
    main()
