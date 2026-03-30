# Batch Scoring Architecture

> How products get scored for Safe Swaps and Top Matches.
> Last updated: 2026-03-30 (session 6)

---

## Current System

### How It Works

1. **First scan trigger**: When a pet has no cached scores (or candidates come back empty), `batchScoreHybrid()` fires from SafeSwapSection.
2. **Hybrid path**: Tries the Edge Function (`supabase/functions/batch-score/`) first. If it fails (WORKER_LIMIT on free tier, timeout, etc.), falls back to client-side scoring (`batchScoreOnDevice()`).
3. **Both paths**: Fetch 200 products matching `species + category + productForm`, score each via `computeScore()`, upsert results to `pet_product_scores`.
4. **Cache read**: `fetchSafeSwaps()` queries `pet_product_scores` (top 50 by score), applies exclusion filters (allergens, severity, pantry, scans, cardiac DCM, conditions, life stage), then builds the 3-pick curated layout.
5. **Rate limit**: 5 minutes per pet. Edge Function checks via DB query (`scored_at`), client-side checks via in-memory Map.

### Key Files

| File | Role |
|------|------|
| `src/services/batchScoreOnDevice.ts` | Client-side scoring (200 products) + `batchScoreHybrid()` entry point |
| `supabase/functions/batch-score/index.ts` | Edge Function scoring (200 products server-side) |
| `src/services/safeSwapService.ts` | Cache read, filtering, curated layout |
| `src/components/result/SafeSwapSection.tsx` | UI + trigger logic |

### Constants

| Constant | Value | Location |
|----------|-------|----------|
| Product limit | 200 | Both paths: `.limit(200)` |
| Rate limit | 5 min | `RATE_LIMIT_MS` in both files |
| Candidate pool | 50 | `CANDIDATE_POOL_SIZE` in safeSwapService |
| Min score threshold | 65 | `MIN_SCORE_THRESHOLD` in safeSwapService |
| Min results to show | 3 | `MIN_RESULTS` in safeSwapService |
| Upsert chunk | 500 | `UPSERT_CHUNK` in both files |

---

## Known Issues

### 1. Stale Cache — New Products Never Scored

**Problem**: After a pet's first batch score, new products added to the DB are never scored for that pet. The cache is never invalidated for new product arrivals.

**Impact**: If 500 products are added next month, no existing pet sees them in Safe Swaps.

**Current mitigations**: `checkCacheFreshness()` in `topMatches.ts` invalidates cache when the pet profile changes (weight, breed, conditions, health review), but does NOT check for new products.

### 2. Random 200 Products — No Ordering

**Problem**: The product query has no `ORDER BY`. Postgres returns an arbitrary 200 products from the ~2,000 matching dry dog food. Better products may be missed while mediocre ones get scored.

**Impact**: Safe Swap quality is inconsistent — depends on which 200 Postgres happens to return.

### 3. 200 Limit Covers ~10% of Dry Dog Food

**Problem**: ~2,000 dry dog food products exist, but only 200 are scored. The Safe Swap candidate pool is artificially small.

**Impact**: The curated 3-pick layout (Top Pick, Fish-Based, Great Value) is limited to the best of 200, not the best of 2,000.

### 4. Edge Function and Client-Side Are Equivalent

**Problem**: Both paths fetch 200 products with the same limit. The Edge Function doesn't provide more coverage — it only offloads CPU to the server.

**Impact**: No benefit to Pro tier beyond reduced device battery/CPU usage.

---

## Proposed Approaches

### A. TTL-Based Cache Expiration

**Idea**: Re-trigger batch scoring if the cache is older than N days (e.g., 7 days).

**How**: Check `MAX(scored_at)` in `pet_product_scores` for the pet. If older than threshold, treat cache as empty and re-score.

**Pros**: Simple. Catches new products within N days. No schema changes.
**Cons**: Doesn't react immediately to new products. All pets re-score on the same cadence regardless of whether products changed.

### B. Product Count Delta Check

**Idea**: Compare total products matching the pet's filters to the number of cached scores. If products grew by >10%, trigger re-score.

**How**: `SELECT COUNT(*) FROM products WHERE species=X AND category=Y` vs `SELECT COUNT(*) FROM pet_product_scores WHERE pet_id=Z`. If delta exceeds threshold, re-score.

**Pros**: Only re-scores when there are actually new products. Efficient.
**Cons**: Doesn't catch product updates (reformulations), only additions. Two extra count queries per Safe Swap load.

### C. pg_cron Background Re-Score

**Idea**: Nightly job (like auto-deplete) that re-scores active pets in the background.

**How**: pg_cron triggers an Edge Function that iterates pets with `last_active > 7 days ago`, re-scores each. Uses `pg_net` to call the Edge Function.

**Pros**: No user-facing latency. Scores can run overnight. Could score ALL products (not just 200) since there's no UX wait.
**Cons**: Most complex. Edge Function needs to handle larger batches. Cost scales with active users. Supabase Pro required for pg_cron.

### D. Raise Product Limit (Quick Win)

**Idea**: Increase `.limit(200)` to `.limit(1000)` or remove entirely for the Edge Function.

**How**: Change one line in each file. Edge Function can handle more since it runs server-side. Client-side could stay at 200 as fallback.

**Pros**: Immediate coverage improvement. No architectural changes.
**Cons**: Longer first-scan wait (~40s for 1,000 products). Doesn't solve staleness.

### E. Combination: D + A

**Recommended approach**: Raise Edge Function limit to 1,000+ (or uncapped) for better coverage on first score. Add TTL-based expiration (7 days) so caches refresh periodically and pick up new products.

**Trade-off**: First scan takes longer (~30-40s with progress indicator), but subsequent scans are instant from cache. Cache auto-refreshes weekly.

---

## Decision Needed

- Which approach to implement (A-E or combination)?
- What TTL feels right? (7 days? 14 days? User-configurable?)
- Should the Edge Function limit differ from client-side? (e.g., Edge: 1,000, client fallback: 200)
- Should re-scoring happen on app launch or only when Safe Swaps are viewed?
