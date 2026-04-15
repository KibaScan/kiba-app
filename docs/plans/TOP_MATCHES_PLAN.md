# Plan: Top Matches — Premium Personalized Product Rankings

## Context

Scores in Kiba are per-pet — they depend on species, breed, life stage, allergens, and conditions. Currently scores are only computed one product at a time when a user scans. Steven wants a premium feature where users can browse the highest-scoring products for their specific pet. This is a major retention feature: "What's the best food for Buster?"

The challenge: ~1,700 dog foods (or ~900 cat foods) must be scored against one pet's full profile. At ~150ms per product client-side, that's minutes of serial queries. The solution is server-side batch scoring with a cache table and lazy invalidation.

## Architecture Overview

```
User opens "Top Matches"
  → checkCacheFreshness(pet)
  → If stale/empty: call batch-score Edge Function (4-6 sec)
  → If fresh: query pet_product_scores (50ms)
  → Render sorted list with score badges
  → Tap product → existing ResultScreen (fresh score computed)
```

---

## Phase 1: Schema — `pet_product_scores` Cache Table

**New migration: `supabase/migrations/011_pet_product_scores.sql`**

```sql
CREATE TABLE pet_product_scores (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id                 UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id             UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Cached score data (list view only — full breakdown computed on tap)
  final_score            SMALLINT NOT NULL,
  is_partial_score       BOOLEAN NOT NULL DEFAULT false,
  is_recalled            BOOLEAN NOT NULL DEFAULT false,
  is_supplemental        BOOLEAN NOT NULL DEFAULT false,
  category               TEXT NOT NULL CHECK (category IN ('daily_food', 'treat')),

  -- Invalidation anchors (snapshot at scoring time)
  life_stage_at_scoring  TEXT,
  pet_updated_at         TIMESTAMPTZ NOT NULL,
  pet_health_reviewed_at TIMESTAMPTZ,
  product_updated_at     TIMESTAMPTZ NOT NULL,

  -- Metadata
  scored_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scoring_version        TEXT NOT NULL DEFAULT '1',

  UNIQUE (pet_id, product_id)
);

-- Top matches query: sorted by score
CREATE INDEX idx_pps_pet_category_score
  ON pet_product_scores (pet_id, category, final_score DESC);

-- RLS: users see only their own pets' scores
ALTER TABLE pet_product_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY pps_owner ON pet_product_scores
  FOR ALL USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()))
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));
```

**What we cache:** Only `final_score` + display metadata. NOT the full `ScoredResult` (layer breakdowns, penalties, ingredient lists). That's only needed on the detail screen, which already runs `scoreProduct()` fresh.

---

## Phase 2: Batch Scoring Edge Function

**New file: `supabase/functions/batch-score/index.ts`**

**Why server-side:** The Edge Function runs in Deno next to Postgres — negligible latency per query. Two bulk SQL queries replace 1,700 individual round trips.

**Input:**
```typescript
{ pet_id, pet_profile: PetProfile, allergens: string[], conditions: string[] }
```

**Logic:**
1. Fetch all scoreable products for the pet's species (exclude `is_vet_diet`, supplements per D-096)
2. Fetch ALL product_ingredients + ingredients_dict in one join for those products
3. Group ingredients by product_id in memory
4. Run `computeScore()` for each product (pure function — copied into Edge Function bundle)
5. Skip variety pack products (detected via `detectVarietyPack()`)
6. Runtime supplemental detection via `isSupplementalByName()` (D-146)
7. Upsert all rows into `pet_product_scores`
8. Return `{ scored: number, duration_ms: number }`

**Scoring engine in the Edge Function:** `computeScore()` and its dependencies (`ingredientQuality.ts`, `nutritionalProfile.ts`, `formulationScore.ts`, `speciesRules.ts`, `personalization.ts`) are pure functions with zero React Native imports. Copy into `supabase/functions/batch-score/scoring/` with adjusted import paths. Scoring engine changes infrequently — any change bumps `scoring_version` which invalidates all caches.

**Performance estimate:**
- 2 bulk SQL queries: ~500ms
- 1,700 × `computeScore()`: ~2-3s (pure CPU math in Deno)
- Bulk upsert: ~1-2s
- **Total: 4-6 seconds** (shown as loading state to user)

---

## Phase 3: Lazy Invalidation

**New service: `src/services/topMatches.ts`**

Four checks run before every Top Matches query. Sample one cached row and compare:

| Check | Condition | Trigger |
|-------|-----------|---------|
| No cache | `COUNT(*) = 0` | First visit for this pet |
| Life stage drift | `deriveLifeStage(pet.dob)` !== `cached.life_stage_at_scoring` | Pet aged past a boundary (no user action needed) |
| Profile edit | `pet.updated_at` > `cached.pet_updated_at` | Breed, weight, any profile change |
| Health update | `pet.health_reviewed_at` > `cached.pet_health_reviewed_at` | Allergy added/removed, condition changed |
| Engine update | `cached.scoring_version` !== `CURRENT_SCORING_VERSION` | Scoring logic changed in a release |

If ANY check fails → call `batch-score` Edge Function → show "Updating matches for {petName}..." loading state → refresh list.

**Per-product staleness (product data updates):** NOT checked at list level — too expensive to join 1,700 rows against products. When user taps a product, `scoreProduct()` runs fresh (existing behavior). Product reformulations are rare; when Steven triggers a data refresh, `scoring_version` bump invalidates all caches.

---

## Phase 4: UI — SearchScreen → Top Matches

**Transform `src/screens/SearchScreen.tsx`** (currently a placeholder).

**Header:**
- "Top Matches for {petName}" with pet photo badge
- Pet switcher for multi-pet households (bottom sheet)

**Filter bar (horizontal chip scroll):**
- Category: "Daily Food" | "Treats" | "All" (default: Daily Food)
- Text search: filters by brand/name (client-side on loaded data)

**Product list (FlatList, paginated 25 at a time):**
- Product image (56×56) + brand + name (2-line clamp)
- Score badge: colored number + "% match" using `getScoreColor(score, isSupplemental)`
- Recalled badge (red pill) / Partial badge (amber) when applicable
- Tap → `ResultScreen` with `{ productId, petId }` (existing nav params)

**Loading states:**
- First-time scoring: "Scoring {n} products for {petName}..." with progress
- Stale cache refresh: same loading with "Updating matches..." copy
- Error: retry button

**Paywall:** `canSearch()` already exists in `permissions.ts` and gates this screen.

---

## Phase 5: Zustand Store

**New store: `src/stores/useTopMatchesStore.ts`**

```typescript
interface TopMatchesState {
  scores: CachedScore[];        // active pet's sorted scores
  loading: boolean;
  error: string | null;

  fetchTopMatches: (petId: string, filters?: ScoreFilters) => Promise<void>;
  refreshScores: (petId: string) => Promise<void>;
}
```

NOT persisted to AsyncStorage — score data is large and stales quickly. Fetched from Supabase on each screen visit (~50ms when cached).

---

## Edge Cases

| Case | Handling |
|------|----------|
| New pet, no cache | Batch score on first Top Matches visit |
| Null DOB (null life_stage) | Engine defaults to adult. Both sides null = no drift |
| Pet deleted | `ON DELETE CASCADE` cleans up cache rows |
| Multi-pet | Each pet has independent cache. Switching pets triggers freshness check |
| New products added after scoring | Picked up on next invalidation trigger. Acceptable lag. |
| Anonymous users | Can't be premium → `canSearch()` = false → never reach this screen |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/011_pet_product_scores.sql` | **Create** — cache table + indexes + RLS |
| `supabase/functions/batch-score/index.ts` | **Create** — server-side batch scoring |
| `supabase/functions/batch-score/scoring/` | **Create** — copied pure scoring engine files |
| `src/services/topMatches.ts` | **Create** — cache freshness + query service |
| `src/stores/useTopMatchesStore.ts` | **Create** — Zustand store |
| `src/screens/SearchScreen.tsx` | **Rewrite** — placeholder → Top Matches UI |
| `src/utils/constants.ts` | **Edit** — add `CURRENT_SCORING_VERSION` |
| `src/utils/permissions.ts` | **Edit** — possibly alias `canBrowseTopMatches()` (or reuse `canSearch()`) |
| `src/types/navigation.ts` | **No change** — `SearchStackParamList` already supports `Result` navigation |

## Implementation Sequence

1. Migration + RLS (schema foundation)
2. Edge Function + scoring engine bundle (backend)
3. Manual test: call Edge Function, verify scores match scan pipeline
4. `topMatches.ts` service + freshness checks (client service layer)
5. Zustand store (state management)
6. SearchScreen UI rewrite (the visible feature)
7. Tests: freshness logic, batch scoring regression (Pure Balance = 61), pagination
8. Device testing + performance profiling

## Verification

1. `npx jest --silent` — 641/641 tests still pass (no scoring logic changed)
2. Batch-scored Pure Balance = 61 (matches scan pipeline)
3. Add allergy → reopen Top Matches → scores refresh automatically
4. Edit pet breed → scores refresh automatically
5. Wait for life stage boundary crossing (or mock DOB) → scores refresh
6. Free user → paywall gate works
7. Multi-pet → switching pets loads correct scores
8. Tap product from list → ResultScreen shows full breakdown (fresh score)
