# Batch Scoring Architecture

> How products get scored for Safe Swaps and Top Matches.
> Last updated: 2026-03-30 (session 7) — Approach F: Delta Scoring + Two-Phase Edge

---

## Current System (Approach F)

### How It Works

1. **Trigger**: When Safe Swaps detect an empty or immature cache, `batchScoreHybrid()` fires.
2. **Hybrid path**: Tries the Edge Function first (1000 products, two-phase). Falls back to client-side (200 products) on failure.
3. **Delta check**: Both paths query cache maturity — if ≥80% of products for this category are already scored, only fetch new/updated products (delta mode). Otherwise, full batch.
4. **Phase 1 (Edge Function)**: Scores the first 200 products (ordered by `updated_at DESC`), upserts, returns response immediately.
5. **Phase 2 (Edge Function background)**: `EdgeRuntime.waitUntil()` scores remaining ~800 products in 200-product chunks with GC yields. Silent on failure — cache maturity check heals on next scan.
6. **Cache read**: `fetchSafeSwaps()` queries `pet_product_scores` (top 300 by score), applies exclusion filters (allergens, severity, pantry, scans, cardiac DCM, conditions, life stage), then builds the 3-pick curated layout.
7. **Rate limit**: 5 minutes per pet (full batch only — delta bypasses).

### Key Files

| File | Role |
|------|------|
| `src/services/batchScoreOnDevice.ts` | Client-side scoring (200 products) + `batchScoreHybrid()` entry point |
| `supabase/functions/batch-score/index.ts` | Edge Function: two-phase scoring (200 sync + 800 background) |
| `src/services/safeSwapService.ts` | Cache read, filtering, curated layout |
| `src/components/result/SafeSwapSection.tsx` | UI + trigger logic |

### Constants

| Constant | Value | Location |
|----------|-------|----------|
| Edge Function limit | 1000 | `DEFAULT_LIMIT` in Edge Function, `limit_size` in hybrid call |
| Client fallback limit | 200 | `CLIENT_LIMIT` in batchScoreOnDevice |
| Phase 1 size | 200 | `PHASE1_SIZE` in Edge Function |
| Phase 2 chunk size | 200 | `PHASE2_CHUNK` in Edge Function |
| Phase 2 GC yield | 50ms | `PHASE2_YIELD_MS` in Edge Function |
| Cache maturity threshold | 80% | `CACHE_MATURITY_THRESHOLD` in both files |
| Rate limit | 5 min | `RATE_LIMIT_MS` in both files (full batch only) |
| Candidate pool | 300 | `CANDIDATE_POOL_SIZE` in safeSwapService |
| Exclusion chunk size | 100 | `EXCLUSION_CHUNK_SIZE` in safeSwapService |
| Min score threshold | 65 | `MIN_SCORE_THRESHOLD` in safeSwapService |
| Min results to show | 3 | `MIN_RESULTS` in safeSwapService |
| Upsert chunk | 500 | `UPSERT_CHUNK` in both files |

---

## Delta Scoring

Instead of TTL-based cache expiration, the system checks whether new products have been added or updated since the last score.

1. Query `MAX(product_updated_at)` from `pet_product_scores` for this pet+category.
2. Count cached scores vs total products for the category.
3. If cache is "mature" (≥80% coverage), use `.gt('updated_at', lastScoredTimestamp)` — typically returns 0-10 products.
4. If cache is immature (Phase 2 failed, client fallback was used, etc.), run a full batch to heal.

**Why 80%?** Adapts to category size. Small category (80 cat treats) with 65 cached = 81% → delta. Large category (2000 dry dog food) with only 200 cached = 10% → full batch.

---

## Two-Phase Edge Function

The Edge Function uses `EdgeRuntime.waitUntil()` to score the full catalog without blocking the UI:

- **Phase 1** scores the top 200 products synchronously and returns the response (~8-10s).
- **Phase 2** runs in the background, scoring the remaining products in 200-product chunks with 50ms yields for garbage collection.
- Phase 2 failures are logged but silent. The cache maturity check ensures the next scan triggers a healing full batch if needed.

---

## Previous Issues (Resolved)

| Issue | Status | Fix |
|-------|--------|-----|
| Stale cache (new products never scored) | **Resolved** | Delta scoring detects new/updated products |
| Random 200 products (no ORDER BY) | **Resolved** | `ORDER BY updated_at DESC` on all product queries |
| 200-product ceiling (~10% coverage) | **Resolved** | Edge Function scores up to 1000 via two-phase |
| CANDIDATE_POOL_SIZE = 50 (filter wipeout) | **Resolved** | Raised to 300 with chunked exclusion queries |
| Edge Function no advantage | **Resolved** | Asymmetric limits (1000 vs 200) + two-phase |
| 414 URI Too Long risk | **Prevented** | Exclusion queries chunked at 100 IDs |
| Phase 2 failure = permanent data gap | **Prevented** | Cache maturity check triggers healing full batch |
