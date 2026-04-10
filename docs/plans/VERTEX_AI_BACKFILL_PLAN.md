# Plan: Vertex AI Data Enrichment Backfills (Post-M9)

> **Status:** Planned — starts after M9 closes
> **Owner:** Steven
> **Budget:** ~$300 in GCP Vertex AI credits (free ceiling — no out-of-pocket cost expected)
> **Related decisions:** D-127 (API keys server-side only), Rule #6 (every penalty has citation_source)

---

## Context

Two data gaps affect scoring accuracy and UI quality today. Both are closeable with a text+vision LLM backfill. We already have a working precedent — the M3 LLM Nutritional Refinery (`scripts/refinery/extract_ga.py`) — which uses Claude Haiku via the Anthropic SDK directly. This plan extends the same pattern to two new backfills, but routes through **Google Vertex AI** instead of Anthropic-direct, because Steven has ~$300 in unused Vertex credits that would otherwise go to waste.

### The two gaps

1. **Missing ingredient TLDRs + citations in `ingredients_dict`.** The `tldr`, `definition`, `detail_body`, and `citations_display` columns exist (D-105), but many rows are still null. Ingredient detail modals either show empty state or fall back to generic copy. Rule #6 also requires every penalty to have a `citation_source`, so any penalized ingredient without attribution is a compliance gap.

2. **Missing Guaranteed Analysis for Amazon products.** Many Amazon-sourced products in the 19,058-row catalog have no structured GA because Amazon detail pages put nutrition data inside **A+ content images** rather than the product description. Today these rows fall back to Atwater estimation (D-149) or get partial scores. Amazon A+ images are high-resolution marketing assets that include printed GA tables — extractable with a vision model.

### Why Vertex, not Anthropic-direct

- **Free credits** — $300 in Vertex credits, zero in Anthropic credits.
- **Model choice** — Vertex gives access to Gemini Pro (latest), which is the preferred model for both tasks: high quality for citation accuracy, strong OCR for A+ image GA extraction. Flash/Haiku are cheaper but the user explicitly chose Pro because credits remove the cost pressure.
- **Portability** — the API shape is different from Anthropic-direct, but the prompt/schema/pipeline are portable. If credits run out mid-project, swapping back to Anthropic-direct or to Google AI Studio is an endpoint + auth change.

---

## Architecture Overview

Both backfills follow the existing refinery pattern:

```
Python script (scripts/refinery/)
  → Query Supabase for rows with the gap (service role)
  → Batch rows into chunks (MAX_CONCURRENT = 10)
  → For each row:
      → Build prompt (with whitelisted reference corpus for safety)
      → POST to Vertex AI Gemini Pro endpoint
      → Parse structured JSON response
      → Validate
      → Write back to Supabase (flagged fields only)
  → Out-of-range / low-confidence results land in flagged_for_review.json
  → Human review pass before flags are cleared
```

Key differences from the M3 refinery:
- Uses Google GenAI SDK (or REST) instead of `anthropic` Python SDK
- Auth via **GCP service account JSON** loaded from env, not bearer token
- Workstream 2 adds an **image pre-download** step (Amazon CDN → Supabase Storage) before the vision call

---

## Workstream 1: Ingredient TLDR + Citation Backfill

**Target table:** `ingredients_dict`
**Target columns:** `tldr`, `definition`, `detail_body`, `citations_display`
**Scope estimate:** TBD — first step is a SELECT COUNT to scope it. Rough ballpark 500–2,000 ingredients.

### Script

**New file:** `scripts/refinery/backfill_ingredient_content.py`

**Input:** Ingredient canonical name + severity + cluster_id + allergen_group (what we already know about it).

**Output (structured JSON):**
```json
{
  "definition": "One-sentence identification of what the ingredient physically is.",
  "tldr": "2-3 sentence engaging summary (D-105 voice).",
  "detail_body": "1-2 paragraph full explanation with nutritional/safety context.",
  "citations": [
    { "source": "NRC 2006 Ch. 5", "claim": "Required for..." },
    { "source": "AAFCO 2024 §30.1", "claim": "..." }
  ]
}
```

### Citation hallucination safety (critical)

Even Gemini Pro hallucinates citations — it confidently invents plausible-sounding source names. This is unacceptable for a product that legally requires citation_source on every penalty.

**Mitigation: whitelisted reference corpus in the prompt.**

Bundle a static reference list with the script:
- NRC "Nutrient Requirements of Dogs and Cats" (2006) — chapter/section level
- AAFCO Official Publication (2024) — Model Bill sections relevant to pet food
- FDA CVM ingredient definitions (21 CFR 582 / 584)
- AVMA position statements on specific ingredients
- ACVN consensus statements (DCM, urinary, etc.)
- Any additional vet/clinical sources the user wants to whitelist

Prompt instructs: "Cite ONLY from this list. If no source in the list supports a claim, omit the claim rather than inventing a citation."

Output validator rejects any citation that doesn't appear verbatim in the whitelist. Rejected rows land in `flagged_for_review.json`.

### Manual review gate

Generated rows should be written with `citation_source = 'ai_generated_pending_review'` (or a new column flag like `tldr_reviewed = false`). A human review pass flips them to `'reviewed'` before they're trusted by the scoring engine for penalty attribution. This prevents a raw LLM run from silently backdoor-violating Rule #6.

**Open question:** Does the user want a separate review UI, or CSV export + spreadsheet review? Decide before writing the script.

---

## Workstream 2: Amazon A+ Image → GA Extraction

**Target table:** `products`
**Target columns:** `ga_protein_pct`, `ga_fat_pct`, `ga_fiber_pct`, `ga_moisture_pct`, `ga_kcal_per_cup`, `ga_kcal_per_kg`, plus the v7 DMB columns `ga_*_dmb_pct`
**Scope estimate:** Amazon-sourced products (via `asin IS NOT NULL`) where `ga_protein_pct IS NULL`. Needs a count query to scope; rough ballpark 2,000–5,000 products.

### Why this is harder than workstream 1

A+ images are hosted on `m.media-amazon.com` behind CDN redirects. Multiple gotchas:
- The A+ block can contain 4–12 images; only 1–2 have GA tables.
- Layout is arbitrary — tables, grids, decorative banners with numbers overlayed on imagery.
- CDN redirects and signed URLs can flake when passed directly to Vertex multimodal.
- Image URLs aren't stored in the DB today (we store `image_url` for the main product image only — the A+ block isn't captured).

### Prerequisite: capture A+ image URLs

Before the backfill can run, the import pipeline needs to capture A+ image URLs during scrape. This requires one of:
- **Option A** — extend the existing Apify actor to pull A+ HTML blocks and extract image URLs
- **Option B** — write a separate Amazon A+ scraper that takes a list of ASINs and returns image URLs (can batch-process existing products without reimporting)

**Recommendation:** Option B. Avoids disturbing the v7 import pipeline and lets us run the A+ scrape independently against the existing 19,058 products. Output: new table `product_aplus_images(product_id, image_url, position, fetched_at)` or a JSONB column on `products`.

**Open question:** Apify actor for A+ scraping exists or needs building? Check before committing.

### Script

**New file:** `scripts/refinery/extract_ga_from_aplus.py`

**Pipeline:**
1. Query products with `asin IS NOT NULL AND ga_protein_pct IS NULL`
2. For each, fetch A+ image URLs from the new table
3. Pre-download each image to **Supabase Storage** bucket `aplus-cache/{asin}/{idx}.jpg` (avoid hammering Amazon CDN on retry, sidestep redirect flakiness)
4. Send all images for a product to Gemini Pro in a single multimodal request with the GA extraction prompt
5. Validate against the same D-043 ranges the M3 refinery uses (reuse `scripts/refinery/validator.py`)
6. Write valid results to `products`, flag out-of-range for manual review

### Prompt strategy

Multi-image prompt asking Gemini to:
- Identify which image(s) contain GA tables
- Extract protein/fat/fiber/moisture as-fed percentages
- Extract kcal/cup and kcal/kg if present
- Return `null` per field if not found (no guessing)
- Return confidence score per field

### Validation (reuse D-043 ranges from `validator.py`)

| Field | Absolute | Typical |
|-------|----------|---------|
| protein_min_pct | 0–80 | 5–55 |
| fat_min_pct | 0–50 | 2–30 |
| fiber_max_pct | 0–30 | 0.5–15 |
| moisture_max_pct | 0–85 | 5–82 |
| kcal_per_cup | 100–7000 | 200–600 |
| kcal_per_kg | 100–7000 | 2000–5500 |

Anything outside absolute → flagged. Outside typical → saved with `ga_confidence = 'low'` for later audit.

### Downstream: DMB recompute

After GA backfill, `ga_*_dmb_pct` columns need to be recomputed via the DMB conversion formula (NP bucket spec). Either:
- Run a SQL UPDATE with the DMB formula inline
- Reuse the v7 enrichment path (migration 020 style)

**Open question:** Does a reusable DMB backfill function exist, or does this need to be written? Check `supabase/migrations/020_v7_enrichment_columns.sql`.

---

## Budget Estimate

**Gemini 2.5 Pro on Vertex AI:**
- ~$1.25 / 1M input tokens
- ~$10.00 / 1M output tokens
- ~$1.25 / 1M image input tokens (varies by resolution)

### Workstream 1 (text, 10k rows upper bound)
- ~500 input tokens/row × 10k = 5M input → **$6.25**
- ~300 output tokens/row × 10k = 3M output → **$30.00**
- **Subtotal: ~$36**

### Workstream 2 (vision, 5k products, ~4 images each)
- ~2000 tokens image input per call × 5k = 10M → **$12.50**
- ~200 output tokens/call × 5k = 1M → **$10.00**
- **Subtotal: ~$22.50**

**Total worst case: ~$60.** Leaves $240+ in credit headroom for reruns, prompt iteration, and manual review regenerations.

---

## Infrastructure / Setup

### One-time GCP prerequisites
1. Enable Vertex AI API on the existing Kiba GCP project (or create a dedicated one — the Vertex docs recommend a dedicated project for cost tracking)
2. Request access to Gemini Pro in Vertex AI Model Garden
3. Create a service account with `roles/aiplatform.user`
4. Download service account JSON key

### Secrets
- **Supabase project secrets** (for Edge Functions that call Vertex later): `GCP_SERVICE_ACCOUNT_JSON` (base64-encoded), `GCP_PROJECT_ID`, `GCP_REGION`
- **Local `.env` for backfill scripts:** `GOOGLE_APPLICATION_CREDENTIALS` pointing to the JSON file path (standard GCP pattern)

### SDK
- Python: `google-genai` or `google-cloud-aiplatform` — pick whichever has cleaner multimodal support as of script-writing time
- Add to `requirements.txt` alongside the existing `anthropic` / `supabase` / `python-dotenv` pinned in the refinery

### Rate limits
Vertex has per-project QPM quotas on Gemini Pro. Default is usually generous for backfills but verify before kicking off a 5k-row run. `MAX_CONCURRENT = 10` from the existing refinery is a safe starting point.

---

## Sequencing

**Do not start until M9 closes.** M9 is UI polish + search; splitting focus between UI work and data infra risks both.

Recommended order:
1. **Scoping queries first** — run SELECT COUNTs to measure both gaps precisely. If workstream 1 is 500 rows not 10k, the plan simplifies.
2. **Workstream 1 (TLDR backfill)** — text-only, no new scraping infra, self-contained. Use this to validate the Vertex SDK + auth path before touching images.
3. **Workstream 2 prerequisite** — A+ image scrape. Blocks workstream 2.
4. **Workstream 2 (GA vision extraction)** — depends on #3.
5. **DMB recompute** — downstream of #4.
6. **Manual review pass** — for both workstreams before data goes live in scoring.

---

## Out of Scope

- **Not** migrating Claude Code CLI auth to Vertex. The `/setup-vertex` wizard added in Claude Code v2.1.98 is orthogonal to this plan.
- **Not** replacing the M3 refinery. It still runs on Haiku for GA extraction from text-based product data. This plan adds *new* Vertex-based scripts in parallel.
- **Not** building a general-purpose ingredient knowledge base. Scope is strictly: fill the null columns that exist today.
- **Not** scoring supplements (D-096) or vet diets (D-135) as a side effect. Bypass rules stay intact; this is data quality only.

---

## Open Questions

Before kicking off, Steven should decide:

1. **Review UI vs. spreadsheet review** for workstream 1 flagged rows. Build a tiny admin view or just CSV export + Google Sheets?
2. **Reference corpus scope** — which sources go in the whitelist? NRC+AAFCO+FDA minimum, or broader?
3. **A+ scraping path** — extend Apify actor or write a standalone ASIN → A+ scraper?
4. **Dedicated GCP project or reuse existing?** The Vertex docs recommend dedicated for cost tracking; reuse is simpler.
5. **Cutover threshold** — at what confidence do we trust raw Gemini output without human review? Probably never for citations, potentially high-confidence for GA values within typical range.

---

## Success Criteria

- Workstream 1: all `ingredients_dict` rows with a non-neutral severity have a reviewed `tldr` + `citations_display` populated from a whitelisted source
- Workstream 2: ≥70% of Amazon-sourced products with prior null GA now have validated GA values (within typical range, no manual review needed)
- Zero citation hallucinations in shipped data (verified by whitelist validator + manual review sample)
- Total spend stays inside the $300 credit allocation
- No disruption to live scoring during backfill (writes are idempotent, scoring version doesn't change)

---

## References

- **Existing precedent:** `scripts/refinery/extract_ga.py`, `scripts/refinery/validator.py`, `scripts/refinery/README.md`
- **Claude Code Vertex wizard (orthogonal):** https://code.claude.com/docs/en/google-vertex-ai
- **D-127:** API keys server-side only
- **D-105:** Display content columns (`tldr`, `definition`, `detail_body`, `citations_display`)
- **D-043:** GA validation ranges
- **D-149:** Atwater fallback (what workstream 2 is replacing)
- **Rule #6:** Every penalty has `citation_source`
- **Schema:** `ingredients_dict` in `supabase/migrations/001_initial_schema.sql` lines 98–129
- **Memory:** `project_vertex_ai_backfill_plans.md` (short-form version of this plan)
