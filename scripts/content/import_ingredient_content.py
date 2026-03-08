#!/usr/bin/env python3
"""
Kiba — Ingredient Content Import + Reconciliation Script
Imports curated ingredient content from Excel/Markdown source files into ingredients_dict.
Handles fuzzy matching for naming variants and inserts genuinely missing ingredients.

Usage:
  python scripts/content/import_ingredient_content.py --dry-run    # Parse + match, no writes
  python scripts/content/import_ingredient_content.py              # Full import
  python scripts/content/import_ingredient_content.py --gaps       # Gap analysis only
"""

import argparse
import os
import re
import sys
from pathlib import Path

import openpyxl
from dotenv import load_dotenv
from supabase import create_client

# ─── Config ──────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / "data"

XLSX_FILES = [
    ("TIER1_INGREDIENT_CONTENT.xlsx", "tier1"),
    ("TIER1_5_INGREDIENT_CONTENT.xlsx", "tier1_5"),
    ("TIER2_BATCH1_INGREDIENT_CONTENT.xlsx", "tier2_b1"),
    ("TIER2_Batch2_INGREDIENT_CONTENT.xlsx", "tier2_b2"),
    ("TIER3_VITAMINS_MINERALS_UPDATED.xlsx", "tier3"),
]

MD_FILE = "TIER4_PROCESSING_AIDS.md"
SKIP_CANONICAL = {"brewer_dried_yeast"}  # maps to brewers_yeast in Tier 2

# Content columns we write (never touch scoring columns)
CONTENT_COLUMNS = [
    "display_name", "definition", "tldr", "detail_body",
    "citations_display", "position_context", "primary_concern_basis",
    "base_description", "dog_context", "cat_context",
]

# Severity mapping from source file values to DB enum
SEVERITY_MAP = {
    "beneficial": "good",
    "good": "good",
    "neutral": "neutral",
    "caution": "caution",
    "danger": "danger",
}

# D-095 medical verb patterns (targeted to avoid false positives on "treat" in pet food)
MEDICAL_VERB_PATTERN = re.compile(
    r"\b(can |may |will |to |helps? )?(prescribe|cure|diagnose|prevent disease|treat disease)",
    re.IGNORECASE,
)


# ─── Parsing ─────────────────────────────────────────────

def parse_xlsx(filename: str, tier: str) -> list[dict]:
    """Parse an xlsx file into a list of ingredient dicts."""
    path = DATA_DIR / filename
    if not path.exists():
        print(f"  WARNING: {filename} not found, skipping")
        return []

    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    headers = [h.strip() if isinstance(h, str) else h for h in rows[0]]
    entries = []

    for row in rows[1:]:
        if not row or not row[1]:  # skip empty rows (col 1 = canonical_name)
            continue
        data = {}
        for i, header in enumerate(headers):
            if header == "#":
                continue
            val = row[i] if i < len(row) else None
            if isinstance(val, str):
                val = val.strip()
            if val is not None and val != "":
                data[str(header)] = val
        data["_tier"] = tier
        data["_source"] = filename
        entries.append(data)

    wb.close()
    return entries


def parse_markdown(filename: str) -> list[dict]:
    """Parse the Tier 4 markdown file into ingredient dicts."""
    path = DATA_DIR / filename
    if not path.exists():
        print(f"  WARNING: {filename} not found, skipping")
        return []

    text = path.read_text(encoding="utf-8")
    entries = []

    sections = re.split(r"^## \d+\.\s+", text, flags=re.MULTILINE)

    for section in sections[1:]:
        code_match = re.search(r"```\n?(.*?)```", section, re.DOTALL)
        if not code_match:
            continue

        code = code_match.group(1)
        data = {}

        lines = code.split("\n")
        current_key = None
        current_val_lines = []

        for line in lines:
            key_match = re.match(r"^(\w+):\s*(.*)", line)
            if key_match:
                if current_key:
                    data[current_key] = "\n".join(current_val_lines).strip()
                current_key = key_match.group(1)
                current_val_lines = [key_match.group(2)]
            elif current_key:
                current_val_lines.append(line)

        if current_key:
            data[current_key] = "\n".join(current_val_lines).strip()

        canonical = data.get("canonical_name", "")
        if canonical in SKIP_CANONICAL:
            continue

        data["_tier"] = "tier4"
        data["_source"] = filename
        entries.append(data)

    return entries


def parse_all_sources() -> list[dict]:
    """Parse all source files into a unified list."""
    all_entries = []

    for filename, tier in XLSX_FILES:
        entries = parse_xlsx(filename, tier)
        print(f"  {filename}: {len(entries)} entries")
        all_entries.extend(entries)

    md_entries = parse_markdown(MD_FILE)
    skipped = len(SKIP_CANONICAL)
    print(f"  {MD_FILE}: {len(md_entries)} entries ({skipped} skipped: {', '.join(SKIP_CANONICAL)})")
    all_entries.extend(md_entries)

    print(f"  Total parsed: {len(all_entries)}")
    return all_entries


# ─── Fuzzy Matching ──────────────────────────────────────

def normalize_name(name: str) -> str:
    """Normalize a canonical name for matching."""
    return name.lower().replace("-", "_").replace(" ", "_").strip()


def generate_variants(canonical: str) -> list[str]:
    """Generate likely DB variants for a source canonical_name."""
    variants = []
    norm = normalize_name(canonical)

    # 1. Singular/plural
    if norm.endswith("ies"):
        variants.append(norm[:-3] + "y")      # blueberries -> blueberry
    elif norm.endswith("es"):
        variants.append(norm[:-2])             # potatoes -> potato
        variants.append(norm[:-1])             # sometimes just drop s
    elif norm.endswith("s") and not norm.endswith("ss"):
        variants.append(norm[:-1])             # carrots -> carrot

    # 2. Strip _supplement suffix
    if norm.endswith("_supplement"):
        base = norm[:-11]
        variants.append(base)
        variants.append(base.replace("_", "-"))

    # 3. Underscore <-> hyphen
    if "_" in norm:
        variants.append(norm.replace("_", "-"))
    if "-" in norm:
        variants.append(norm.replace("-", "_"))

    # 4. Strip common suffixes: _oxide, _sulfate, _proteinate, etc.
    # But also try the full name with hyphens
    for suffix in ["_supplement", "_palmitate"]:
        if norm.endswith(suffix):
            variants.append(norm[:-len(suffix)])

    # 5. Special known mappings
    special = {
        "sweet_potatoes": "sweet_potato",
        "dl_alpha_tocopherol": "dl-alpha-tocopherol",
        "alpha_tocopherol_acetate": "alpha-tocopherol-acetate",
        "l_arginine": "l-arginine",
        "l_lysine": "l-lysine",
        "l_threonine": "l-threonine",
        "l_tryptophan": "l-tryptophan",
        "l_cysteine": "l-cysteine",
        "l_tyrosine": "l-tyrosine",
        "soy_lecithin": "soy-lecithin",
    }
    if norm in special:
        variants.append(special[norm])

    return variants


def fuzzy_match_entries(
    entries: list[dict],
    db_ingredients: dict[str, dict],
) -> tuple[list, list, list, list]:
    """Match entries against DB with multi-strategy fuzzy matching.

    Returns: (exact_matched, fuzzy_matched, already_has_content, unmatched)
    """
    # Build normalized lookup
    norm_lookup: dict[str, dict] = {}
    for canonical, info in db_ingredients.items():
        norm = normalize_name(canonical)
        norm_lookup[norm] = info

    # Also build a LIKE-style index for substring matching
    all_db_names = list(db_ingredients.keys())

    exact_matched = []
    fuzzy_matched = []
    already_has = []
    unmatched = []

    for entry in entries:
        canonical = entry.get("canonical_name", "")
        if not canonical:
            continue

        db_info = None
        match_type = "exact"

        # Strategy 1: Exact match
        db_info = db_ingredients.get(canonical)

        # Strategy 2: Normalized match
        if not db_info:
            norm = normalize_name(canonical)
            db_info = norm_lookup.get(norm)
            match_type = "normalized"

        # Strategy 3: Generated variants
        if not db_info:
            for variant in generate_variants(canonical):
                db_info = db_ingredients.get(variant) or norm_lookup.get(normalize_name(variant))
                if db_info:
                    match_type = f"variant({variant})"
                    break

        # Strategy 4: Substring search (last resort)
        if not db_info:
            # Extract core term (strip common prefixes/suffixes)
            core = normalize_name(canonical)
            for suffix in ["_supplement", "_oxide", "_sulfate", "_proteinate",
                           "_chelate", "_complex", "_hydrochloride", "_mononitrate",
                           "_dihydriodide", "_fumarate", "_carbonate", "_chloride",
                           "_citrate", "_phosphate", "_iodate"]:
                if core.endswith(suffix):
                    core = core[:-len(suffix)]
                    break

            candidates = [
                name for name in all_db_names
                if core in normalize_name(name) or normalize_name(name) in core
            ]
            if len(candidates) == 1:
                db_info = db_ingredients[candidates[0]]
                match_type = f"substring({candidates[0]})"

        if not db_info:
            unmatched.append(entry)
            continue

        # Check if already has content
        if db_info.get("tldr") is not None and db_info["tldr"] and db_info["tldr"].strip():
            already_has.append({
                "canonical_name": canonical,
                "db_canonical": db_info["canonical_name"],
                "match_type": match_type,
            })
            continue

        match_record = {
            "entry": entry,
            "db_id": db_info["id"],
            "db_canonical": db_info["canonical_name"],
            "match_type": match_type,
        }

        if match_type == "exact":
            exact_matched.append(match_record)
        else:
            fuzzy_matched.append(match_record)

    return exact_matched, fuzzy_matched, already_has, unmatched


# ─── D-095 Check ─────────────────────────────────────────

def check_prohibited_terms(entries: list[dict]) -> list[dict]:
    """Check for D-095 prohibited medical terms in content fields."""
    findings = []
    check_fields = ["tldr", "detail_body", "definition"]

    for entry in entries:
        canonical = entry.get("canonical_name", "")
        for field in check_fields:
            val = entry.get(field, "")
            if not val:
                continue
            matches = MEDICAL_VERB_PATTERN.findall(val)
            if matches:
                findings.append({
                    "canonical_name": canonical,
                    "field": field,
                    "matches": [m[1] if isinstance(m, tuple) else m for m in matches],
                })

    return findings


# ─── DB Operations ───────────────────────────────────────

def get_supabase_client():
    """Create Supabase client from env vars."""
    load_dotenv()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    )

    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)

    return create_client(url, key)


def fetch_db_ingredients(client) -> dict[str, dict]:
    """Fetch all ingredients from DB."""
    # Supabase default limit is 1000, paginate if needed
    all_rows = []
    offset = 0
    batch_size = 1000

    while True:
        result = (
            client.table("ingredients_dict")
            .select("id, canonical_name, tldr")
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        all_rows.extend(result.data)
        if len(result.data) < batch_size:
            break
        offset += batch_size

    ingredients = {}
    for row in all_rows:
        ingredients[row["canonical_name"]] = row

    return ingredients


def build_content_update(entry: dict) -> dict:
    """Build the update payload from a parsed entry."""
    update_data = {"review_status": "manual"}

    for col in CONTENT_COLUMNS:
        val = entry.get(col)
        if val is not None and isinstance(val, str) and val.strip():
            update_data[col] = val.strip()

    return update_data


def map_severity(raw: str | None) -> str:
    """Map source file severity string to DB enum value."""
    if not raw or not isinstance(raw, str):
        return "neutral"
    return SEVERITY_MAP.get(raw.strip().lower(), "neutral")


def map_bool(raw) -> bool:
    """Map source file boolean to Python bool."""
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        return raw.strip().upper() in ("TRUE", "YES", "1")
    return False


def write_updates(client, matched: list[dict]) -> int:
    """Update existing DB rows with curated content."""
    written = 0
    for match in matched:
        entry = match["entry"]
        db_id = match["db_id"]
        update_data = build_content_update(entry)
        client.table("ingredients_dict").update(update_data).eq("id", db_id).execute()
        written += 1
    return written


def insert_missing(client, entries: list[dict]) -> int:
    """Insert genuinely missing ingredients into ingredients_dict."""
    inserted = 0
    for entry in entries:
        canonical = entry.get("canonical_name", "")
        if not canonical:
            continue

        row = {
            "canonical_name": canonical,
            "review_status": "manual",
            "dog_base_severity": map_severity(entry.get("dog_severity") or entry.get("dog_base_severity")),
            "cat_base_severity": map_severity(entry.get("cat_severity") or entry.get("cat_base_severity")),
            "position_reduction_eligible": map_bool(entry.get("position_reduction_eligible")),
            "is_legume": map_bool(entry.get("is_legume", False)),
        }

        # Add all content columns
        for col in CONTENT_COLUMNS:
            val = entry.get(col)
            if val is not None and isinstance(val, str) and val.strip():
                row[col] = val.strip()

        client.table("ingredients_dict").insert(row).execute()
        inserted += 1

    return inserted


def run_gap_analysis(client):
    """Show top uncovered ingredients by occurrence."""
    no_content = (
        client.table("ingredients_dict")
        .select("id, canonical_name")
        .is_("tldr", "null")
        .execute()
    )

    if not no_content.data:
        print("\nAll ingredients have content!")
        return

    no_content_ids = {row["id"] for row in no_content.data}
    id_to_name = {row["id"]: row["canonical_name"] for row in no_content.data}

    # Paginate product_ingredients
    all_pi = []
    offset = 0
    batch_size = 1000
    while True:
        result = (
            client.table("product_ingredients")
            .select("ingredient_id")
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        all_pi.extend(result.data)
        if len(result.data) < batch_size:
            break
        offset += batch_size

    counts: dict[str, int] = {}
    for row in all_pi:
        iid = row["ingredient_id"]
        if iid in no_content_ids:
            counts[iid] = counts.get(iid, 0) + 1

    sorted_gaps = sorted(counts.items(), key=lambda x: -x[1])[:30]

    print(f"\n=== Gap Analysis: Top {min(30, len(sorted_gaps))} Uncovered Ingredients ===")
    print(f"  {'Canonical Name':<45} {'Products':>8}")
    print("  " + "-" * 55)
    for iid, count in sorted_gaps:
        name = id_to_name.get(iid, "???")
        print(f"  {name:<45} {count:>8}")

    total_no_content = len(no_content.data)
    total_with_refs = len(counts)
    print(f"\n  Total ingredients without content: {total_no_content}")
    print(f"  Of those, {total_with_refs} appear in at least one product")

    # Also show total coverage
    all_count = (
        client.table("ingredients_dict")
        .select("id", count="exact")
        .execute()
    )
    with_content = (
        client.table("ingredients_dict")
        .select("id", count="exact")
        .not_.is_("tldr", "null")
        .execute()
    )
    print(f"\n  Total ingredients_dict rows: {all_count.count}")
    print(f"  Rows with tldr: {with_content.count}")


# ─── Main ────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import curated ingredient content")
    parser.add_argument("--dry-run", action="store_true", help="Parse + match only, no DB writes")
    parser.add_argument("--gaps", action="store_true", help="Gap analysis only")
    args = parser.parse_args()

    print("=== Ingredient Content Reconciliation ===\n")

    client = get_supabase_client()

    if args.gaps:
        run_gap_analysis(client)
        return

    # Step 1: Parse all sources
    print("Source files:")
    entries = parse_all_sources()

    # Step 2: Match against DB with fuzzy matching
    print("\nMatching against ingredients_dict...")
    db_ingredients = fetch_db_ingredients(client)
    print(f"  DB has {len(db_ingredients)} ingredients total")

    exact_matched, fuzzy_matched, already_has, unmatched = fuzzy_match_entries(
        entries, db_ingredients
    )

    all_matched = exact_matched + fuzzy_matched

    print(f"\n  Exact matches (will write): {len(exact_matched)}")

    if fuzzy_matched:
        print(f"  Fuzzy matches (will write): {len(fuzzy_matched)}")
        for m in fuzzy_matched:
            print(f"    {m['entry']['canonical_name']} -> {m['db_canonical']} [{m['match_type']}]")

    print(f"  Already has content (skipped): {len(already_has)}")

    print(f"  Unmatched (will insert as new): {len(unmatched)}")
    if unmatched:
        for u in unmatched:
            print(f"    {u.get('canonical_name', '???')} ({u.get('_source', '?')})")

    # D-095 check
    findings = check_prohibited_terms(entries)
    if findings:
        print(f"\n  D-095 Flagged ({len(findings)} findings — review, not blocking):")
        for f in findings:
            print(f"    {f['canonical_name']}.{f['field']}: {f['matches']}")

    if args.dry_run:
        print("\nDRY RUN — no database writes.")
        print(f"\nWould write: {len(all_matched)} updates + {len(unmatched)} inserts")
        return

    # Step 3: Write updates to existing rows
    if all_matched:
        print(f"\nUpdating {len(all_matched)} existing rows...")
        updated = write_updates(client, all_matched)
        print(f"  Updated: {updated}")

    # Step 4: Insert genuinely missing ingredients
    if unmatched:
        print(f"\nInserting {len(unmatched)} new ingredients...")
        inserted = insert_missing(client, unmatched)
        print(f"  Inserted: {inserted}")

    # Step 5: Summary
    print("\n=== Summary ===")
    print(f"  Source entries parsed: {len(entries)}")
    print(f"  Already had content (skipped): {len(already_has)}")
    print(f"  Fuzzy matched to existing rows: {len(fuzzy_matched)}")
    print(f"  Exact matched to existing rows: {len(exact_matched)}")
    print(f"  Genuinely missing (inserted): {len(unmatched)}")

    # Step 6: Gap analysis
    run_gap_analysis(client)

    print("\nDone.")


if __name__ == "__main__":
    main()
