#!/usr/bin/env python3
"""
M3 Session 2: LLM Nutritional Refinery

Extracts Guaranteed Analysis (GA) values from pet food product data using
Claude Haiku. Validates results (D-043) before writing to Supabase.

Values are stored as-fed — the scoring engine handles DMB conversion.

Usage:
    python3 scripts/refinery/extract_ga.py [--dry-run] [--limit N]

Environment:
    ANTHROPIC_API_KEY  — required (D-127: server-side only)
    SUPABASE_URL       — required
    SUPABASE_SERVICE_ROLE_KEY — required
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Allow running from project root
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "import"))

from config import get_client
from validator import validate_ga_values

try:
    import anthropic
except ImportError:
    print("ERROR: anthropic package not installed. Run: pip install anthropic")
    sys.exit(1)


# ─── Constants ────────────────────────────────────────────────

MODEL = "claude-haiku-4-5-20251001"
MAX_CONCURRENT = 10
MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0  # seconds

RESULTS_PATH = Path(__file__).resolve().parent / "refinery_results.json"
FLAGGED_PATH = Path(__file__).resolve().parent / "flagged_for_review.json"

GA_FIELDS_MAP = {
    "protein_min_pct": "ga_protein_pct",
    "fat_min_pct": "ga_fat_pct",
    "fiber_max_pct": "ga_fiber_pct",
    "moisture_max_pct": "ga_moisture_pct",
    "kcal_per_cup": "ga_kcal_per_cup",
    "kcal_per_kg": "ga_kcal_per_kg",
}

EXTRACTION_PROMPT = """You are a pet food label data extractor. Extract the Guaranteed Analysis values from this pet food product information. Return ONLY a JSON object, no other text.

Product: {name}
Brand: {brand}
Ingredients: {ingredients_raw}
Category: {category}

Extract these values as numbers (no % sign). Use null if not found:
{{
  "protein_min_pct": <number or null>,
  "fat_min_pct": <number or null>,
  "fiber_max_pct": <number or null>,
  "moisture_max_pct": <number or null>,
  "kcal_per_cup": <number or null>,
  "kcal_per_kg": <number or null>
}}

IMPORTANT: Only extract values explicitly stated in the product information above. Never infer or calculate values. If the text doesn't contain GA data, return all nulls."""


# ─── Stats Tracking ──────────────────────────────────────────

class Stats:
    def __init__(self):
        self.processed = 0
        self.extracted = 0
        self.flagged = 0
        self.all_null = 0
        self.failed = 0
        self.skipped_existing = 0
        self.input_tokens = 0
        self.output_tokens = 0


# ─── Haiku Extraction ────────────────────────────────────────

def build_prompt(product: dict) -> str:
    return EXTRACTION_PROMPT.format(
        name=product.get("name", "Unknown"),
        brand=product.get("brand", "Unknown"),
        ingredients_raw=(product.get("ingredients_raw") or "")[:2000],
        category=product.get("category") or "unknown",
    )


async def call_haiku(
    client: anthropic.AsyncAnthropic,
    product: dict,
    semaphore: asyncio.Semaphore,
    stats: Stats,
) -> dict | None:
    """Call Haiku for a single product. Returns extracted values or None."""
    prompt = build_prompt(product)
    product_id = product["id"]

    async with semaphore:
        for attempt in range(MAX_RETRIES):
            try:
                response = await client.messages.create(
                    model=MODEL,
                    max_tokens=256,
                    messages=[{"role": "user", "content": prompt}],
                )

                # Track tokens
                stats.input_tokens += response.usage.input_tokens
                stats.output_tokens += response.usage.output_tokens

                # Parse response
                text = response.content[0].text.strip()

                # Strip markdown code fences if present
                if text.startswith("```"):
                    lines = text.split("\n")
                    # Remove first line (```json or ```) and last line (```)
                    lines = [l for l in lines if not l.strip().startswith("```")]
                    text = "\n".join(lines).strip()

                values = json.loads(text)
                return values

            except anthropic.RateLimitError:
                backoff = INITIAL_BACKOFF * (2 ** attempt)
                print(f"  Rate limited on {product_id}, retry in {backoff:.1f}s...")
                await asyncio.sleep(backoff)

            except (json.JSONDecodeError, KeyError, IndexError) as e:
                print(f"  Parse error for {product_id}: {e}")
                return None

            except anthropic.APIError as e:
                print(f"  API error for {product_id}: {e}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(INITIAL_BACKOFF * (2 ** attempt))
                else:
                    return None

    return None


# ─── Main Pipeline ────────────────────────────────────────────

async def process_batch(
    haiku_client: anthropic.AsyncAnthropic,
    products: list[dict],
    supabase,
    stats: Stats,
    dry_run: bool,
) -> tuple[list[dict], list[dict]]:
    """Process a batch of products concurrently.

    Returns (results, flagged) lists.
    """
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    results = []
    flagged = []

    tasks = [
        call_haiku(haiku_client, p, semaphore, stats)
        for p in products
    ]
    extractions = await asyncio.gather(*tasks)

    for product, values in zip(products, extractions):
        product_id = product["id"]
        product_name = product.get("name", "Unknown")
        stats.processed += 1

        if values is None:
            stats.failed += 1
            results.append({
                "product_id": product_id,
                "name": product_name,
                "status": "failed",
                "reason": "haiku_error",
            })
            continue

        # Check if all values are null
        non_null = {k: v for k, v in values.items() if v is not None and k in GA_FIELDS_MAP}
        if not non_null:
            stats.all_null += 1
            results.append({
                "product_id": product_id,
                "name": product_name,
                "status": "all_null",
            })
            continue

        # Validate (D-043)
        # No product_form column in schema — pass None (cross-validation skipped)
        is_valid, errors, warnings = validate_ga_values(values)

        if not is_valid:
            stats.flagged += 1
            entry = {
                "product_id": product_id,
                "name": product_name,
                "brand": product.get("brand", "Unknown"),
                "extracted_values": values,
                "errors": errors,
                "warnings": warnings,
            }
            flagged.append(entry)
            results.append({
                "product_id": product_id,
                "name": product_name,
                "status": "flagged",
                "errors": errors,
            })
            continue

        # Build update payload — only non-null validated fields
        update = {
            "nutritional_data_source": "llm_extracted",
            "score_confidence": "high",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        for extract_key, db_col in GA_FIELDS_MAP.items():
            val = values.get(extract_key)
            if val is not None:
                update[db_col] = val

        if not dry_run:
            try:
                supabase.table("products").update(update).eq("id", product_id).execute()
            except Exception as e:
                print(f"  DB update error for {product_id}: {e}")
                stats.failed += 1
                results.append({
                    "product_id": product_id,
                    "name": product_name,
                    "status": "db_error",
                    "error": str(e),
                })
                continue

        stats.extracted += 1
        result_entry = {
            "product_id": product_id,
            "name": product_name,
            "status": "extracted",
            "values": {k: v for k, v in values.items() if v is not None},
        }
        if warnings:
            result_entry["warnings"] = warnings
        results.append(result_entry)

    return results, flagged


async def run(args):
    """Main entry point."""
    supabase = get_client()
    haiku_client = anthropic.AsyncAnthropic()  # reads ANTHROPIC_API_KEY from env

    # Query products needing GA extraction
    # daily_food first (needs GA for 30% nutritional bucket), then treats
    print("Querying products with missing GA data...")

    query = (
        supabase.table("products")
        .select("id, name, brand, ingredients_raw, category, "
                "ga_protein_pct, ga_fat_pct, ga_fiber_pct, ga_moisture_pct")
        .not_.is_("ingredients_raw", "null")
        .is_("ga_protein_pct", "null")
        .in_("category", ["daily_food", "treat"])
        .order("category", desc=False)  # daily_food before treat
        .limit(args.limit if args.limit else 10000)
    )
    response = query.execute()
    products = response.data

    if not products:
        print("No products found needing GA extraction.")
        return

    # Safety guard: skip products that already have GA data
    products = [
        p for p in products
        if p.get("ga_protein_pct") is None
    ]

    daily_count = sum(1 for p in products if p.get("category") == "daily_food")
    treat_count = sum(1 for p in products if p.get("category") == "treat")
    print(f"Found {len(products)} products: {daily_count} daily_food, {treat_count} treats")

    if args.dry_run:
        products = products[:5]
        print(f"DRY RUN: processing first {len(products)} products only, no DB writes")

    # Process in batches
    stats = Stats()
    all_results = []
    all_flagged = []
    batch_size = MAX_CONCURRENT

    start_time = time.time()

    for i in range(0, len(products), batch_size):
        batch = products[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(products) + batch_size - 1) // batch_size

        print(f"\nBatch {batch_num}/{total_batches} ({len(batch)} products)...")

        results, flagged = await process_batch(
            haiku_client, batch, supabase, stats, args.dry_run,
        )
        all_results.extend(results)
        all_flagged.extend(flagged)

        # Cost tracking per batch
        elapsed = time.time() - start_time
        cost_input = stats.input_tokens * 0.80 / 1_000_000   # $0.80/MTok
        cost_output = stats.output_tokens * 4.00 / 1_000_000  # $4.00/MTok
        total_cost = cost_input + cost_output

        print(f"  Progress: {stats.processed}/{len(products)} | "
              f"Extracted: {stats.extracted} | Flagged: {stats.flagged} | "
              f"Failed: {stats.failed} | All-null: {stats.all_null}")
        print(f"  Tokens: {stats.input_tokens:,} in / {stats.output_tokens:,} out | "
              f"Cost: ${total_cost:.4f} | Time: {elapsed:.1f}s")

    # Write results
    with open(RESULTS_PATH, "w") as f:
        json.dump({
            "run_at": datetime.now(timezone.utc).isoformat(),
            "dry_run": args.dry_run,
            "summary": {
                "total_processed": stats.processed,
                "extracted": stats.extracted,
                "flagged": stats.flagged,
                "all_null": stats.all_null,
                "failed": stats.failed,
                "input_tokens": stats.input_tokens,
                "output_tokens": stats.output_tokens,
            },
            "results": all_results,
        }, f, indent=2)
    print(f"\nResults written to {RESULTS_PATH}")

    if all_flagged:
        with open(FLAGGED_PATH, "w") as f:
            json.dump(all_flagged, f, indent=2)
        print(f"Flagged products written to {FLAGGED_PATH}")

    # Final summary
    elapsed = time.time() - start_time
    cost_input = stats.input_tokens * 0.80 / 1_000_000
    cost_output = stats.output_tokens * 4.00 / 1_000_000
    total_cost = cost_input + cost_output

    print(f"\n{'='*60}")
    print(f"REFINERY COMPLETE {'(DRY RUN)' if args.dry_run else ''}")
    print(f"{'='*60}")
    print(f"  Processed:  {stats.processed}")
    print(f"  Extracted:  {stats.extracted}")
    print(f"  Flagged:    {stats.flagged}")
    print(f"  All-null:   {stats.all_null}")
    print(f"  Failed:     {stats.failed}")
    print(f"  Tokens:     {stats.input_tokens:,} in / {stats.output_tokens:,} out")
    print(f"  Cost:       ${total_cost:.4f}")
    print(f"  Time:       {elapsed:.1f}s")


def main():
    parser = argparse.ArgumentParser(
        description="M3 LLM Nutritional Refinery — Extract GA values via Claude Haiku"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Process first 5 products, print results, no DB writes"
    )
    parser.add_argument(
        "--limit", type=int, default=0,
        help="Max products to process (0 = all)"
    )
    args = parser.parse_args()

    # Verify API key exists
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set in environment or .env")
        sys.exit(1)

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
