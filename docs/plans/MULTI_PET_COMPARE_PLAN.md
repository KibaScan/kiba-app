# Multi-Pet Compare + Safe Swap Simplification

> Plan for next session. Read this before starting work.
> Created: 2026-03-29 (session 5)

---

## Context

Safe Swap currently has a multi-pet chip row ("Buster | Luna | All Dogs") that requires bulk-scored caches for every same-species pet. This is fragile — group mode returns 0 candidates if any pet lacks cached scores, and scoring all pets takes 10s+ each.

The Compare screen is the natural place for multi-pet evaluation. You're already in "which product is better?" mode. Adding per-pet scoring here is cheap (just 2 `computeScore()` calls per pet) and doesn't need bulk-cached data.

## What Changes

### 1. Safe Swap: Remove Multi-Pet (Simplify)

**Remove from `SafeSwapSection.tsx`:**
- Pet chip row (the "Buster | Luna | All Dogs" chips)
- `selectedPetId` / `groupMode` state
- `fetchGroupSafeSwaps()` call path
- Client-side cache keyed by pet (`cacheRef`)
- All the allergen/condition fetching for non-active pets

**Keep:**
- Single-pet Safe Swap for the active/scanned pet (works today)
- "Preparing..." loading state + `batchScoreOnDevice` trigger
- Curated layout (Top Pick / Fish-Based / Great Value)
- Free user paywall banner
- Compare link on each card

**Result:** SafeSwapSection becomes ~50% smaller. One pet, one fetch, no group mode complexity.

### 2. Compare Screen: Add Multi-Pet Score Row

**Current state:** CompareScreen shows two products scored for the active pet. Score rings show "X% match for Buster." Score Breakdown and Nutrition tables compare the two products.

**Add a collapsible "Your Other Pets" section** — same pattern as Score Breakdown, Ingredients, etc. Collapsed by default so it doesn't clutter the screen for in-store shoppers scanning quickly.

```
Your Other Pets                          ∨
┌──────────────────────────────────────────┐
│  Luna       34% match    ◯    89% match  │
│  Max        28% match    ◯    91% match  │
└──────────────────────────────────────────┘
```

- Collapsible section (matches existing Collapsible component pattern)
- Two-column layout matching the product cards above: Product A score | Pet name | Product B score
- Each score colored via `getScoreColor()`
- Scores computed on-demand when section is EXPANDED (lazy load) — avoids wasting compute if user never opens it
- Only shown when user has 2+ same-species pets

**Lazy loading benefit:** Scores are computed only when the user taps to expand. This gives the section time to load without blocking the initial render. The allergen/condition fetch + `computeScore()` calls happen on expand, with a brief spinner if needed.

**Cost:** For 3 dogs comparing 2 products = 4 extra `computeScore()` calls. Pure function, instant once data is fetched. Ingredients already loaded. Only the per-pet allergen/condition fetch requires network.

### 3. Compare Screen: Pet Switcher Dropdown

**Add a pet selector** to the Compare screen header or above the product cards:

```
Comparing for: Buster ▼
```

- Tapping opens a picker (bottom sheet or dropdown) listing same-species pets
- Selecting a different pet re-scores both products for that pet
- Score rings animate to new scores
- Score Breakdown updates (IQ/NP/FC buckets change per pet)
- Key Differences recalculate (allergen/condition context changes)
- Nutrition table stays the same (product data is pet-independent)

**This replaces the current fixed pet from route params.** Currently CompareScreen always uses the pet from navigation. The switcher lets users explore "what if I'm comparing for Luna instead?"

### 4. Compare Screen: "Who Benefits Most?" Line (Optional)

Below Key Differences, a single summary line:

- If one product wins for all pets: "Nature's Logic is the stronger match for all your dogs"
- If split: "Nature's Logic scores higher for Buster and Max. Pedigree doesn't score higher for any of your dogs."
- Only shown when 2+ same-species pets exist

This is a nice-to-have. Can be deferred.

## Implementation Approach

### Safe Swap Simplification
1. Remove chip row UI, `groupMode` state, `selectedPetId` state from `SafeSwapSection.tsx`
2. Remove `fetchGroupSafeSwaps` import and call path
3. Remove `getPetAllergens`/`getPetConditions` import (no longer fetching for other pets)
4. Remove `cacheRef` (no multi-pet caching needed)
5. Remove `allPets` / `sameSpeciesPets` / `showChips` / `displayName` logic
6. Simplify `loadSwaps()` to single-pet path only
7. Consider removing `fetchGroupSafeSwaps()` from `safeSwapService.ts` entirely (or keep for future use)

### Compare Screen Multi-Pet
1. Fetch `sameSpeciesPets` from `useActivePetStore` (same pattern as SafeSwapSection used)
2. After primary scoring completes, score both products for each additional pet:
   - Fetch allergens/conditions per pet (`getPetAllergens`, `getPetConditions`)
   - Call `computeScore()` with each pet's profile (ingredients already loaded)
   - Store in state: `Map<petId, { scoreA: number, scoreB: number }>`
3. Render compact score row below each product's score ring
4. Add pet switcher dropdown (update `activePetId` state → re-run primary scoring for selected pet)

### Key Files
- `src/components/result/SafeSwapSection.tsx` — simplify (remove multi-pet)
- `src/screens/CompareScreen.tsx` — add multi-pet score row + pet switcher
- `src/services/safeSwapService.ts` — optionally remove `fetchGroupSafeSwaps()`
- `src/services/scoring/engine.ts` — no changes (pure `computeScore()` reused)
- `src/services/scoring/pipeline.ts` — no changes (ingredients already fetched)

### What NOT to Change
- Scoring engine — no modifications
- `batchScoreOnDevice.ts` — stays as-is for single-pet Safe Swap cache
- `safeSwapService.ts` single-pet path — stays as-is
- Compare screen's existing layout (Score Breakdown, Nutrition, Key Differences, Ingredients)

## Verification
- Safe Swap still shows 2-3 candidates for the active pet on ResultScreen
- Compare screen shows multi-pet score row for 2+ same-species pets
- Pet switcher updates score rings + Score Breakdown + Key Differences
- Regression anchors: Pure Balance = 62, Temptations = 9
- All existing tests pass
- No new bulk scoring needed — `computeScore()` handles everything

## Open Questions for Next Session
1. Should `fetchGroupSafeSwaps()` be deleted or kept (in case group Safe Swaps return later)?
2. Pet switcher: dropdown at top of screen vs. bottom sheet picker?
3. "Who benefits most?" line: build now or defer?
4. Should the multi-pet score row be free or premium-gated?
