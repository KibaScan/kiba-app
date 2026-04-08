# Scoring Cache Architecture — Implementation State

> **Status:** Implemented (Session 33-34). Form-aware scoring, cache invalidation, payload-driven versioning, HomeScreen scoring trigger.
> **Goal:** This document is the master source of truth for how product scores flow through the app — from batch computation to cache storage to UI display. Read this before touching any scoring, search, or browse code.

---

## 1. Core Architecture

Scores live in two worlds:

- **Fresh scores** — computed on-demand by `scoreProduct()` in `pipeline.ts` when the user taps into a product. Always correct. Displayed on ResultScreen.
- **Cached scores** — pre-computed in bulk by `batchScoreOnDevice` or the `batch-score` Edge Function, stored in `pet_product_scores`. Displayed in search results, Top Picks, and category browse. May lag behind fresh scores if the cache is stale.

**The fundamental constraint:** There are ~19,058 products but only ~1,000 get batch-scored per cycle (Edge Function limit). Products not in the batch have no cached score and show no score badge in search/browse.

---

## 2. Database: `pet_product_scores`

```
pet_id          UUID NOT NULL (FK → pets)
product_id      UUID NOT NULL (FK → products)
final_score     SMALLINT NOT NULL
is_partial_score BOOLEAN
is_supplemental  BOOLEAN
category        TEXT CHECK IN ('daily_food', 'treat')
product_form    TEXT (nullable, added migration 035)
life_stage_at_scoring TEXT (nullable)
pet_updated_at  TIMESTAMPTZ NOT NULL — snapshot of pet.updated_at at scoring time
pet_health_reviewed_at TIMESTAMPTZ — snapshot of pet.health_reviewed_at
product_updated_at TIMESTAMPTZ NOT NULL — snapshot of product.updated_at
scored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
scoring_version TEXT NOT NULL DEFAULT '1'

UNIQUE (pet_id, product_id)
```

**Indexes:**
- `idx_pps_pet_category_score` — `(pet_id, category, final_score DESC)` — Top Picks, fetchTopMatches
- `idx_pps_pet_cat_form_score` — `(pet_id, category, product_form, final_score DESC)` — form-aware maturity checks, browse

---

## 3. Write Paths (Score Production)

### 3.1 Client-Side: `batchScoreOnDevice()`
**File:** `src/services/batchScoreOnDevice.ts`

- **Limit:** 200 products (`CLIENT_LIMIT`)
- **Flow:** Fetch pet profile → fetch allergens/conditions → fetch candidate products → bulk fetch ingredients → score loop via `computeScore()` → chunked upsert (500/chunk)
- **Delta mode:** When cache is >=80% mature for the requested category+form, only scores products updated since last run
- **Rate limit:** 5-min cooldown per `pet:category:form` key (in-memory Map, resets on app restart)

### 3.2 Edge Function: `batch-score`
**File:** `supabase/functions/batch-score/index.ts`

- **Limit:** 1,000 default (`DEFAULT_LIMIT`), 2,000 hard cap (`MAX_LIMIT`)
- **Two-phase:** Phase 1 scores 200 products synchronously (~8-10s), returns response. Phase 2 scores remaining ~800 in background via `EdgeRuntime.waitUntil()`, chunked at 200 with 50ms GC yields.
- **Delta mode:** Same 80% maturity threshold as client
- **Rate limit:** DB-backed via `scored_at` query (5-min cooldown per pet+category+form)
- **Payload-driven versioning:** Writes `scoring_version` from client request body (fallback `'1'` for old clients). Prevents infinite wipe+score loops when version bumps.

### 3.3 Hybrid Entry Point: `batchScoreHybrid()`
**File:** `src/services/batchScoreOnDevice.ts`

Tries Edge Function first (1,000 limit), falls back to client-side (200 limit) if Edge Function fails. Passes `scoring_version: CURRENT_SCORING_VERSION` in request body.

### 3.4 Fresh Scoring: `scoreProduct()`
**File:** `src/services/scoring/pipeline.ts`

On-demand scoring for a single product. Called by ResultScreen on mount. Fetches ingredients from DB, hydrates, runs `computeScore()`. Result is NOT cached in `pet_product_scores` — it's displayed directly and stored in `scan_history` for the Recent Scans section.

**Bypass order:** Vet diet (D-135) → species mismatch (D-144) → recalled (D-158) → variety pack (D-145) → supplemental (65/35/0) → normal (55/30/15).

---

## 4. Read Paths (Score Consumption)

### 4.1 HomeScreen Search (`searchProducts`)
**File:** `src/services/topMatches.ts`

1. Queries `products` table by name/brand ILIKE (up to 50 results)
2. If `petId` provided, enriches with cached scores from `pet_product_scores`
3. Products without cached scores get `final_score: null` (no badge)

**Gap:** Search queries the full 19K catalog but scores exist for only ~1K. Most search results show no score.

### 4.2 Top Picks Carousel
**File:** `src/components/browse/TopPicksCarousel.tsx`

1. Calls `fetchCategoryTopPicks()` → `fetchBrowseResults()` → `fetchScoredResults()`
2. Reads from `pet_product_scores` joined with `products`
3. Filters to `final_score != null`, shows top 10
4. If no scored products exist for the category, carousel is empty

### 4.3 Category Browse (`fetchScoredResults`)
**File:** `src/services/categoryBrowseService.ts`

1. Reads from `pet_product_scores` with product join
2. Post-query filters: vet_diet, recalled, variety_pack, species, form
3. Overfetch 50x for form/name filters (minority forms are sparse in cache)
4. Falls back to `fetchUnscoredResults()` when scored results are empty for a form

### 4.4 Pantry Score Resolution
**File:** `src/services/pantryService.ts`

`resolveScoresForPet()` — reads from `pet_product_scores`, falls back to `scan_history` if not found. Used by PantryCard score badges.

### 4.5 Recent Scans
**File:** `src/services/scanHistoryService.ts`

Reads from `scan_history` table (NOT `pet_product_scores`). Scores stored here are always fresh — written by ResultScreen at scan time via `scoreProduct()`. This is why Recent Scans shows correct scores even when browse/search shows stale ones.

---

## 5. Scoring Triggers

| Trigger | Location | When | What |
|---------|----------|------|------|
| `ensureCacheFresh()` | HomeScreen `useFocusEffect` | Every Home tab focus | Check freshness → wipe stale → re-score 1K via Edge Function |
| `ensureFormScored()` | CategoryBrowseScreen `loadFirstPage` | Browse a specific form (dry/wet/freeze-dried) | Check form count → score that form if 0 cached |
| SafeSwapSection | ResultScreen Safe Swap | Cache empty or no candidates | `batchScoreHybrid()` for category+form |
| `useTopMatchesStore` | Orphaned store | Never (no consumer) | `loadTopMatches` / `refreshScores` — correct but unwired |

---

## 6. Cache Invalidation

### `invalidateStaleScores(petId)`
**File:** `src/services/topMatches.ts`

Full DELETE of all `pet_product_scores` rows for a pet. Called when `checkCacheFreshness()` returns false (stale).

**Why full wipe (not filtered):** Life stage drift and engine version bumps don't change `pet_updated_at`. A filtered delete (`neq('pet_updated_at', ...)`) would miss those rows, leaving the cache appearing "mature" and trapping batch scoring in delta mode.

### `checkCacheFreshness(pet)`
**File:** `src/services/topMatches.ts`

Samples ONE row from `pet_product_scores`. Returns false (stale) if ANY of 4 conditions fail:
1. Life stage drift (derived vs cached)
2. Profile edit (`pet.updated_at > cached.pet_updated_at`)
3. Health update (`pet.health_reviewed_at > cached.pet_health_reviewed_at`)
4. Engine version (`scoring_version !== CURRENT_SCORING_VERSION`)

### `ensureCacheFresh(petId, pet)`
**File:** `src/services/topMatches.ts`

Orchestrator: check → invalidate → re-score. In-memory concurrency lock (`Set<string>`) prevents overlapping runs from rapid tab switching.

### Payload-Driven Versioning
**File:** `src/services/batchScoreOnDevice.ts` + `supabase/functions/batch-score/index.ts`

Client sends `scoring_version: CURRENT_SCORING_VERSION` in Edge Function request body. Edge Function uses client-provided version for upserts (fallback `'1'`). Prevents infinite wipe+score loops when version bumps: old clients see `'1'` in DB, new clients see `'2'`.

---

## 7. Form-Aware Scoring (Migration 035)

### Problem
Batch scoring's cache maturity check counted ALL products in a category. When dry+wet filled the 80% threshold, minority forms (freeze-dried, raw, dehydrated) never got a full batch — delta mode activated and scored 0 products for those forms.

### Fix
- Added `product_form` column to `pet_product_scores` (migration 035, deployed)
- Maturity check queries filter by `product_form` when provided (both client + Edge Function)
- Rate limit key includes form: `pet:category:form` (form-specific scoring isn't blocked by category-wide batches)
- `ensureFormScored()` in `categoryBrowseService.ts` checks form-specific count, triggers `batchScoreHybrid` if 0

---

## 8. Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `CURRENT_SCORING_VERSION` | `'2'` | `src/utils/constants.ts` | Cache invalidation trigger |
| `CLIENT_LIMIT` | 200 | `batchScoreOnDevice.ts` | Client-side product cap |
| `DEFAULT_LIMIT` | 1,000 | Edge Function | Server-side default |
| `MAX_LIMIT` | 2,000 | Edge Function | Hard ceiling |
| `PHASE1_SIZE` | 200 | Edge Function | Sync phase (before response) |
| `PHASE2_CHUNK` | 200 | Edge Function | Background chunk size |
| `CACHE_MATURITY_THRESHOLD` | 0.80 | Both | Delta mode gate (80% coverage) |
| `RATE_LIMIT_MS` | 300,000 (5 min) | Both | Full-batch cooldown |
| `UPSERT_CHUNK` | 500 | Both | DB upsert batch size |

---

## 9. Known Gaps & Open Issues

### 9.1 Search Score Coverage (Active)
**Problem:** `searchProducts()` queries the full 19K catalog but only ~1K products have cached scores. Most search results show no score badge.

**Why:** The 1K batch is ordered by `updated_at DESC` — most recently updated products, not most searched. Search terms may match products outside the batch.

**Options:**
- **A. Score on search demand** — when `searchProducts` returns unscored products, score them client-side via `computeScore()`. Requires bulk ingredient fetch (~2-3s for 50 products).
- **B. Raise batch limits** — increase `MAX_LIMIT` to 5K+, run multiple batches, cover more catalog. One-time cost per pet.
- **C. Pre-compute via background job** — pg_cron or dedicated Edge Function that scores entire catalog for a pet. Server-to-server, no timeout pressure.

**Status:** Not yet implemented. Search results show scores only for products in the ~1K batch.

### 9.2 Top Picks Empty for Minority Categories
**Problem:** TopPicksCarousel filters to `final_score != null`. If the active category (e.g., Treats, Toppers) has 0 scored products, carousel is empty.

**Mitigation:** `ensureFormScored` handles form-specific gaps on CategoryBrowseScreen. TopPicksCarousel could call similar logic, but currently doesn't.

### 9.3 Edge Function Engine Sync
**Problem:** The Edge Function has its own copy of the scoring engine at `supabase/functions/batch-score/scoring/`. If client-side scoring logic changes, the Edge Function must be redeployed.

**Guard:** `scripts/verify-engine-copy.ts` (Pure Balance = 62 regression test). CLAUDE.md documents: "Changes to `src/services/scoring/` MUST be synced here."

**Current state:** Engines are logic-identical (verified session 34). `CURRENT_SCORING_VERSION` bumped to `'2'` and Edge Function redeployed.

### 9.4 `useTopMatchesStore` Orphaned
**Problem:** The store exists with correct `invalidateStaleScores` + `batchScoreHybrid` logic, but no component imports it. The original consumer (SearchScreen) was deleted when HomeScreen v2 replaced it.

**Impact:** None — scoring triggers are now wired directly into HomeScreen (`ensureCacheFresh`) and CategoryBrowseScreen (`ensureFormScored`). Store is dead code but correct if re-wired.

---

## 10. File Map

| File | Role |
|------|------|
| `src/services/topMatches.ts` | Cache freshness, invalidation, search enrichment, `ensureCacheFresh` |
| `src/services/batchScoreOnDevice.ts` | Client-side batch scoring, `batchScoreHybrid` (Edge Function + fallback) |
| `src/services/categoryBrowseService.ts` | Browse queries, `ensureFormScored`, unscored fallback |
| `src/services/scoring/pipeline.ts` | Fresh single-product scoring (`scoreProduct`) |
| `src/services/scoring/engine.ts` | Pure scoring math (`computeScore`) |
| `src/stores/useTopMatchesStore.ts` | Orphaned store (correct but unwired) |
| `src/screens/HomeScreen.tsx` | `ensureCacheFresh` trigger in `useFocusEffect` |
| `src/screens/CategoryBrowseScreen.tsx` | `ensureFormScored` trigger in `loadFirstPage` |
| `src/screens/ResultScreen.tsx` | Fresh scoring + scan_history insert |
| `src/components/browse/TopPicksCarousel.tsx` | Top Picks display (reads `pet_product_scores` via browse service) |
| `supabase/functions/batch-score/index.ts` | Edge Function (1K products, two-phase, payload-driven versioning) |
| `supabase/migrations/035_pps_product_form.sql` | `product_form` column on `pet_product_scores` |

---

## 11. Scoring Flow Diagram

```
User opens app
       │
       ▼
HomeScreen useFocusEffect
       │
       ├── ensureCacheFresh(petId, pet) [fire-and-forget]
       │     │
       │     ├── checkCacheFreshness(pet) → sample 1 row
       │     │     │
       │     │     ├── FRESH → return (no-op)
       │     │     │
       │     │     └── STALE → invalidateStaleScores(petId) → DELETE all
       │     │                    │
       │     │                    └── batchScoreHybrid(petId, pet)
       │     │                          │
       │     │                          ├── Edge Function → 1000 products (Phase 1 + Phase 2)
       │     │                          │     writes scoring_version from client payload
       │     │                          │
       │     │                          └── Fallback → client-side → 200 products
       │     │
       │     └── lock released
       │
       ├── User searches "Puppy chopped"
       │     │
       │     └── searchProducts() → products table ILIKE
       │           │
       │           └── Enrich with pet_product_scores (if petId)
       │                 │
       │                 ├── Product in cache → show score badge
       │                 └── Product NOT in cache → null (no badge)
       │
       ├── User taps product → ResultScreen
       │     │
       │     └── scoreProduct() → ALWAYS FRESH (pipeline.ts)
       │           │
       │           └── Insert to scan_history (fire-and-forget)
       │
       └── User browses "Daily Food > Freeze-Dried"
              │
              └── CategoryBrowseScreen
                    │
                    ├── ensureFormScored(petId, pet, 'daily_food', 'freeze_dried')
                    │     │
                    │     └── Count check → if 0 → batchScoreHybrid (form-specific)
                    │
                    └── fetchScoredResults() → pet_product_scores
                          │
                          ├── Products scored → show with badges
                          └── 0 results → fallback to fetchUnscoredResults()
```

---

*This document confirms the full scoring cache architecture as of session 34 (April 8, 2026). Reference before any scoring, search, browse, or cache changes.*
