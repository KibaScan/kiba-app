#!/usr/bin/env python3
"""
Kiba — Phase 3: Ingredient Artifact Cleanup
Finds parsing artifacts in ingredients_dict, remaps product_ingredients
to real ingredients where possible, then deletes artifact rows.

Usage:
  python scripts/content/cleanup_artifacts.py --dry-run   # Preview only
  python scripts/content/cleanup_artifacts.py             # Apply changes
"""

import argparse
import os
import re
import sys
from collections import Counter

from dotenv import load_dotenv
from supabase import create_client


def get_client():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    )
    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)
    return create_client(url, key)


def fetch_all(client, table, columns):
    all_rows = []
    offset = 0
    while True:
        result = client.table(table).select(columns).range(offset, offset + 999).execute()
        all_rows.extend(result.data)
        if len(result.data) < 1000:
            break
        offset += 1000
    return all_rows


def is_artifact(name):
    if ":_" in name:
        return "colon"
    if re.search(r"[a-z]\._[a-z]", name):
        return "sentence_boundary"
    if re.search(r"[a-z]\.[a-z]", name):
        return "fused"
    if re.search(r"\d{6,}", name):
        return "lot_number"
    if len(name) > 60:
        return "too_long"
    return None


# Ingredients that are NOT real ingredient targets (false matches from DB junk)
NOT_INGREDIENTS = {
    "grain_free", "new", "added_colors", "natural", "and_salt", "and_peas",
    "and_sea_salt", "apple",  # only when extracted from product descriptions
}


def extract_real_target(name, reason, name_to_id):
    """Try to find the real ingredient this artifact maps to."""

    def valid(candidate):
        if not candidate or candidate in NOT_INGREDIENTS:
            return False
        return candidate in name_to_id and not is_artifact(candidate)

    if reason == "colon":
        # Try all segments (handles multi-colon like "a:_b:_c")
        parts = name.split(":_")
        for p in reversed(parts):
            p = p.strip("_")
            if valid(p):
                return p
        return None

    if reason == "sentence_boundary":
        parts = re.split(r"\._", name)
        for p in parts:
            p = p.strip("_")
            if valid(p):
                return p
        return None

    if reason == "fused":
        fixed = name.replace(".", "")
        if valid(fixed):
            return fixed
        fixed2 = name.replace(".", "_")
        if valid(fixed2):
            return fixed2
        return None

    if reason == "lot_number":
        cleaned = re.sub(r"[._]?[a-z]?\d{5,}.*$", "", name)
        if cleaned and valid(cleaned):
            return cleaned
        cleaned2 = re.sub(r"_?[a-z]\d+$", "", name)
        if cleaned2 and valid(cleaned2):
            return cleaned2
        return None

    if reason == "too_long":
        for sep in ["_and_", "._", ";_"]:
            parts = name.split(sep)
            if len(parts) >= 2:
                first = parts[0].strip("_")
                if valid(first):
                    return first
        # Try matching first N words against known ingredients
        words = name.split("_")
        for length in range(min(5, len(words)), 1, -1):
            candidate = "_".join(words[:length])
            if valid(candidate):
                return candidate
        return None

    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    client = get_client()

    print("Fetching ingredients...", flush=True)
    ingredients = fetch_all(client, "ingredients_dict", "id, canonical_name")
    name_to_row = {r["canonical_name"]: r for r in ingredients}
    name_to_id = {r["canonical_name"]: r["id"] for r in ingredients}
    print(f"  {len(ingredients)} total", flush=True)

    print("Fetching product_ingredients...", flush=True)
    pi_rows = fetch_all(client, "product_ingredients", "id, product_id, ingredient_id, position")
    occ = Counter(r["ingredient_id"] for r in pi_rows)
    print(f"  {len(pi_rows)} total", flush=True)

    # Build PI lookup: ingredient_id → list of PI rows
    pi_by_ingredient = {}
    for r in pi_rows:
        pi_by_ingredient.setdefault(r["ingredient_id"], []).append(r)

    # Build PI lookup: (product_id, ingredient_id) for duplicate detection
    pi_product_ingredient = set()
    for r in pi_rows:
        pi_product_ingredient.add((r["product_id"], r["ingredient_id"]))

    # Classify artifacts
    to_delete_only = []       # 0 occurrences, just delete ingredient row
    to_remap_delete = []      # has target, remap PI then delete ingredient
    to_orphan_delete = []     # no target, delete PI rows + ingredient

    for row in ingredients:
        name = row["canonical_name"]
        reason = is_artifact(name)
        if not reason:
            continue

        count = occ.get(row["id"], 0)

        if count == 0:
            to_delete_only.append((row["id"], name, reason))
            continue

        target = extract_real_target(name, reason, name_to_id)
        if target:
            to_remap_delete.append((row["id"], name, reason, count, target, name_to_id[target]))
        else:
            to_orphan_delete.append((row["id"], name, reason, count))

    print(f"\n=== CLEANUP PLAN ===", flush=True)
    print(f"Delete only (0 occ):          {len(to_delete_only)} ingredients")
    print(f"Remap + delete (has target):  {len(to_remap_delete)} ingredients, {sum(c for _,_,_,c,_,_ in to_remap_delete)} PI rows")
    print(f"Orphan delete (no target):    {len(to_orphan_delete)} ingredients, {sum(c for _,_,_,c in to_orphan_delete)} PI rows")
    total_ingredients = len(to_delete_only) + len(to_remap_delete) + len(to_orphan_delete)
    print(f"Total artifacts to remove:    {total_ingredients}")

    if args.dry_run:
        print("\n[DRY RUN — no changes applied]", flush=True)
        return

    # ── Step 1: Remap product_ingredients ──
    # Group remap PI rows by target_id so we can batch-update
    # For duplicates (target already in product), collect PI ids to delete
    print("\nStep 1: Remapping product_ingredients...", flush=True)
    remap_count = 0
    remap_skip_dup = 0
    remap_errors = 0

    # Collect: pi_ids to remap (grouped by target), pi_ids to delete (dups)
    remap_by_target = {}  # target_id → [pi_id, ...]
    dup_delete_ids = []

    for art_id, art_name, reason, count, target_name, target_id in to_remap_delete:
        pi_list = pi_by_ingredient.get(art_id, [])
        for pi in pi_list:
            if (pi["product_id"], target_id) in pi_product_ingredient:
                dup_delete_ids.append(pi["id"])
            else:
                remap_by_target.setdefault(target_id, []).append(pi["id"])
                pi_product_ingredient.add((pi["product_id"], target_id))

    # Batch remap: update PI rows per target_id
    for target_id, pi_ids in remap_by_target.items():
        for i in range(0, len(pi_ids), 100):
            batch = pi_ids[i : i + 100]
            try:
                client.table("product_ingredients").update(
                    {"ingredient_id": target_id}
                ).in_("id", batch).execute()
                remap_count += len(batch)
            except Exception as e:
                print(f"  ERROR remapping batch to {target_id}: {e}", flush=True)
                remap_errors += len(batch)
        if remap_count % 500 < 100:
            print(f"  ...remapped {remap_count} so far", flush=True)

    # Batch delete duplicate PI rows
    for i in range(0, len(dup_delete_ids), 100):
        batch = dup_delete_ids[i : i + 100]
        try:
            client.table("product_ingredients").delete().in_("id", batch).execute()
            remap_skip_dup += len(batch)
        except Exception as e:
            print(f"  ERROR deleting dup batch: {e}", flush=True)
            remap_errors += len(batch)

    print(f"  Remapped: {remap_count}", flush=True)
    print(f"  Skipped (dup, deleted PI): {remap_skip_dup}", flush=True)
    print(f"  Errors: {remap_errors}", flush=True)

    # ── Step 2: Delete orphaned PI rows ──
    print("\nStep 2: Deleting orphaned PI rows (no remap target)...", flush=True)
    orphan_pi_ids = []
    for art_id, art_name, reason, count in to_orphan_delete:
        pi_list = pi_by_ingredient.get(art_id, [])
        orphan_pi_ids.extend(pi["id"] for pi in pi_list)

    orphan_del = 0
    orphan_err = 0
    for i in range(0, len(orphan_pi_ids), 100):
        batch = orphan_pi_ids[i : i + 100]
        try:
            client.table("product_ingredients").delete().in_("id", batch).execute()
            orphan_del += len(batch)
        except Exception as e:
            print(f"  ERROR deleting orphan PI batch: {e}", flush=True)
            orphan_err += len(batch)

    print(f"  Deleted: {orphan_del}", flush=True)
    print(f"  Errors: {orphan_err}", flush=True)

    # ── Step 3: Delete artifact ingredient rows ──
    print("\nStep 3: Deleting artifact ingredient rows...", flush=True)
    all_artifact_ids = (
        [aid for aid, _, _ in to_delete_only]
        + [aid for aid, _, _, _, _, _ in to_remap_delete]
        + [aid for aid, _, _, _ in to_orphan_delete]
    )

    del_ok = 0
    del_err = 0
    for i in range(0, len(all_artifact_ids), 100):
        batch = all_artifact_ids[i : i + 100]
        try:
            client.table("ingredients_dict").delete().in_("id", batch).execute()
            del_ok += len(batch)
        except Exception as e:
            print(f"  ERROR deleting ingredient batch: {e}", flush=True)
            del_err += len(batch)
        if del_ok % 500 < 100:
            print(f"  ...deleted {del_ok}/{len(all_artifact_ids)} ingredients", flush=True)

    print(f"  Deleted: {del_ok}", flush=True)
    print(f"  Errors: {del_err}", flush=True)

    # ── Summary ──
    print(f"\n{'='*50}")
    print(f"PHASE 3 COMPLETE")
    print(f"  Ingredients removed: {del_ok}")
    print(f"  PI rows remapped:    {remap_count}")
    print(f"  PI dups removed:     {remap_skip_dup}")
    print(f"  PI orphans removed:  {orphan_del}")
    print(f"  Total errors:        {remap_errors + orphan_err + del_err}")


if __name__ == "__main__":
    main()
