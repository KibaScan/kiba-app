# M6 Safe Swap — Implementation Plan

## Goal

Integrate the Safe Swap recommendations section into the ResultScreen, replacing the current placeholder blur/lock CTA with real curated and generic product alternatives. This is the core M6 feature that turns a scan into a recommendation engine.

---

## Draft Review & Issues Found

Your draft has solid bones — the service architecture, daily rotation, and curated 3-pick concept are all well-designed. Here's what needs improvement:

### What's Good
- **`safeSwapService.ts`** — clean architecture: daily seed rotation, pool-based refresh, curated vs generic split, multi-pet group mode
- **`SafeSwapSection.tsx`** — proper multi-pet chip row, loading/empty states, compare integration
- **Migration + backfill scripts** — price/size columns, size parser, backfill pipeline are all production-ready

### Issues to Fix

> [!WARNING]
> **7 issues in the draft that need addressing before integration**

#### 1. Missing health condition hard filters (critical gap)
The spec in CURRENT.md says "Safe Swap recommendations + **condition filters** (topMatches.ts hard filters per condition)". Your service has allergen exclusions but **zero condition-based filtering**. A pancreatitis dog should never be recommended a high-fat food. A CKD pet should never see a high-phosphorus product. These need hard filters, not just score-based sorting.

**Fix:** Add condition-aware exclusion logic that rejects products violating hard dietary constraints (e.g., fat >12% DMB for pancreatitis, protein >30% DMB for CKD).

#### 2. `scan_history` table name mismatch
The draft queries `scan_history` but CLAUDE.md says the table is literally named `scan_history` in some places and `scans` in others (different concern). The `fetchRecentScanExclusions` function references `scan_history` which is correct for per-pet scan records (FK to products), but need to confirm the table name matches the migration.

**Fix:** Verify against actual schema — the table used for recent-scan exclusion with `product_id` is `scan_history` (confirmed by ResultScreen L236).

#### 3. `fetchSevereExclusions` is called but never integrated with the exclusion pass
In `fetchSafeSwaps()`, severe exclusions are fetched and filtered, but `fetchAllergenExclusions` inside `applyExclusionFilters` runs separately. The severe check is a separate pass which means products are being iterated twice unnecessarily.

**Fix:** Combine severity exclusion into the `applyExclusionFilters` function for a single pass.

#### 4. Price columns — migration numbering conflict
The SQL file is labeled `023_safe_swap_price_columns.sql` but the last migration is 022. This is correct sequencing but the internal comment says "Migration 021" which is wrong.

**Fix:** Rename internal comment to Migration 023.

#### 5. Missing `price`/`product_size_kg` in Product TypeScript type
Your service reads `price` and `product_size_kg` from the products Supabase join, but these columns don't exist in `src/types/index.ts` `Product` type yet. TypeScript will error at compile time.

**Fix:** Add `price`, `price_currency`, and `product_size_kg` to the Product interface.

#### 6. Fish-based detection uses regex on allergen_group — fragile
`tagFishBased()` does `regex.test(allergen_group)` with a massive pattern. The `allergen_group` values in `ingredients_dict` are controlled enums — use a `Set` lookup instead of regex.

**Fix:** Replace regex with `FISH_ALLERGEN_GROUPS = new Set(['fish', 'salmon', 'tuna', ...])`.

#### 7. Free user experience is underwhelming
The current draft shows cards to everyone and navigates to ResultScreen on tap (which counts against scan limit). But the placeholder it replaces had a blur/lock premium CTA. There's no visual indicator that this is a premium feature for free users — they just see cards and burn scan credits.

**Fix:** For free users, show the section header + first card visible, then blur the remaining cards with a "Unlock alternatives" overlay (consistent with the D-126 blur pattern used elsewhere in the app).

---

## UI Design — Two Modes

### Mode 1: Curated 3-Pick (Daily Dry Food Only)

For the most common scan type — daily dry food — show 3 semantically distinct recommendations:

![Curated safe swap layout with multi-pet chips](/Users/stevendiaz/.gemini/antigravity/brain/9a0c0109-1d95-4aef-a391-17633ddafc40/multipet_safe_swaps.png)

**Layout:**
- Multi-pet chip row (only if 2+ same-species pets): `[Buster ✓] [Milo] [All Dogs]`
- Section header: score-adaptive copy from `getSwapHeaderCopy()`
- 3 horizontal cards with slot labels: **Top Pick** (star icon) / **Fish-Based** (fish icon) / **Great Value** (pricetag icon)
- Each card: product image → slot label → brand → name → score dot + "X% match" → "for [Pet]" → Compare link
- "See all alternatives" footer link (premium-gated)

![Curated safe swap section](/Users/stevendiaz/.gemini/antigravity/brain/9a0c0109-1d95-4aef-a391-17633ddafc40/curated_safe_swaps.png)

### Mode 2: Generic Horizontal Scroll (Wet Food, Treats, Supplemental)

For product forms where curated slots don't make sense:

![Generic safe swap horizontal scroll](/Users/stevendiaz/.gemini/antigravity/brain/9a0c0109-1d95-4aef-a391-17633ddafc40/generic_safe_swaps.png)

**Layout:**
- Same header, no slot labels on cards
- Top 5 alternatives in a horizontal scroll (peeking edges for scroll affordance)
- All scoring higher than the scanned product
- "See all alternatives" footer (premium-gated)

---

## Proposed Changes

### Database Layer

#### [NEW] `supabase/migrations/023_safe_swap_price_columns.sql`
- Copy from draft `023_safe_swap_price_columns.sql` with corrected internal comment (Migration 023, not 021)
- Adds `price NUMERIC`, `price_currency TEXT DEFAULT 'USD'`, `product_size_kg NUMERIC` to products
- Partial index for value-per-kg ranking

---

### Types

#### [MODIFY] [index.ts](file:///Users/stevendiaz/kiba-antigravity/src/types/index.ts)
- Add `price?: number | null`, `price_currency?: string | null`, `product_size_kg?: number | null` to `Product` interface

---

### Service Layer

#### [NEW] [safeSwapService.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/safeSwapService.ts)
Based on draft with these fixes:
1. **Add condition hard filters** — new `applyConditionFilters()` function:
   - `pancreatitis` → exclude products with fat >12% DMB
   - `ckd` → exclude products with phosphorus >0.5% DMB (dog) / >0.6% DMB (cat)
   - `diabetes` → exclude products with carb estimate >30% DMB
   - `obesity` → exclude products with kcal/cup >400 (or kcal/kg >4000)
   - `urinary` → exclude products with magnesium >0.12% (if data available)
   - These use existing GA columns that are already in the pet_product_scores join
2. **Fix fish detection** — replace regex with Set lookup on `allergen_group`
3. **Merge severity exclusion** into `applyExclusionFilters()` for single pass
4. **Accept `petConditions: string[]`** as a new param to `fetchSafeSwaps`
5. **All D-095 compliant** — header copy says "options" and "match", never "this is better"

#### [NEW] [safeSwapTypes.ts](file:///Users/stevendiaz/kiba-antigravity/src/types/safeSwap.ts)
Extract types from service into dedicated types file (cleaner imports):
- `SafeSwapCandidate`, `CuratedPicks`, `SafeSwapResult`, `GroupMode`

---

### UI Layer

#### [NEW] [SafeSwapSection.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/result/SafeSwapSection.tsx)
Based on draft with these changes:
1. **Free user blur treatment** — if `!canUseSafeSwaps()`, show header + 1 visible card + blurred overlay on remaining cards with lock icon + "Discover healthier alternatives for [Pet Name]" + paywall CTA. Consistent with existing D-126 pattern.
2. **Pass `petConditions`** to service for condition-aware filtering
3. **Fix `any` type** — `useNavigation<any>()` → use proper `NativeStackNavigationProp` from navigation types
4. **Score framing** — ensure card score text reads "[X]% match for [Pet]" per D-094 (currently correct)
5. **Smooth card animations** — add `Animated.FlatList` with staggered fade-in on load completion
6. **Card tap** — navigate to `Result` with `productId` + `petId` (navigating inside the existing scan stack)

#### [MODIFY] [ResultScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/ResultScreen.tsx)
- Replace lines 644-677 (old blur placeholder) with `<SafeSwapSection>` component
- Add import for SafeSwapSection
- Pass required props: `productId`, `petId`, `species`, `category`, `productForm`, `isSupplemental`, `scannedScore`, `petName`, `petConditions`
- Pass `petConditions` (already available as state in ResultScreen)

#### [MODIFY] [ResultScreenStyles.ts](file:///Users/stevendiaz/kiba-antigravity/src/screens/result/ResultScreenStyles.ts)
- Remove old safe swap placeholder styles: `safeSwapCard`, `safeSwapBlur`, `safeSwapLockOverlay`, `safeSwapLockText`, `safeSwapRow`, `safeSwapDot`, `safeSwapPlaceholderBar`, `safeSwapScoreBadge`

---

### Data Pipeline (optional — backfill)

#### Copy to `scripts/import/`
- `backfill_price_size.py` → `scripts/import/backfill_price_size.py`
- `size_parser.py` → `scripts/import/size_parser.py`
- These scripts populate the price/size columns for the "Great Value" slot
- Updated `import_products.py` already includes price/size in `map_product_row()` for future imports

---

## Open Questions

> [!IMPORTANT]
> **Need your input on these before I start building:**

1. **Condition hard-filter thresholds** — The thresholds I listed (fat >12% DMB for pancreatitis, etc.) are based on veterinary nutritional guidelines. Are you comfortable with these, or do you want to define them differently? These are aggressive filters — they'll exclude a lot of products for pets with conditions.

2. **Free user experience** — Two options:
   - **Option A (draft behavior):** Show all cards, tapping navigates to ResultScreen (counts against scan limit). No blur. Simpler, but doesn't promote premium.
   - **Option B (my recommendation):** Show header + 1 card visible, blur remaining with paywall CTA. Consistent with existing D-126 patterns. Better conversion but requires extra UI work.

3. **"Great Value" slot requires price data** — The backfill script needs to run against the v7 dataset to populate `price` + `product_size_kg`. Have you already run this, or should I factor the backfill into the implementation steps?

4. **"See all alternatives" destination** — The draft has a TODO for this. Should it navigate to a full-screen list (new screen), or is the current "premium gate → nothing" behavior acceptable for M6 ship?

---

## Verification Plan

### Automated Tests
- **`safeSwapService.test.ts`** — pure function tests:
  - `dailySeed()` deterministic (same input = same output)
  - `selectFromPool()` returns correct count, deterministic
  - `getSwapHeaderCopy()` returns correct copy for 3 score tiers
  - `buildCuratedResult()` fills slots correctly, falls back to generic when <1 slot filled
  - `buildGenericResult()` selects top 5
  - `refreshFromPool()` produces different results with different refreshCount
  - Condition filter thresholds (pancreatitis, CKD, diabetes, obesity)
- **Regression:** `npx jest --silent` — all 1,137 tests still pass

### Manual Verification
- Run on iOS simulator:
  - Scan a daily dry food → curated 3-pick section appears
  - Scan a wet food → generic scroll section appears  
  - Scan a treat → generic scroll section appears
  - Scan a vet diet → section hidden
  - Scan with allergies → allergen products excluded
  - Multi-pet → chip row appears, "All Dogs" works
  - Refresh button reshuffles without spinner
  - Tap card → navigates to ResultScreen
  - Compare link → paywall gate (or CompareScreen if premium)
