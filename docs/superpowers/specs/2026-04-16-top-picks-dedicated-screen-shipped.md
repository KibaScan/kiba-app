# Top Picks Dedicated Screen — Shipped Summary

**Date shipped:** 2026-04-16 (sessions 50 + 51)
**Branch:** `m9-top-picks-screen` (18 commits, 15 content + 3 doc; not yet pushed)
**Milestone:** M9 (UI Polish & Search)
**Companion docs:**
- Design spec: `2026-04-15-top-picks-dedicated-screen-design.md`
- Implementation plan: `../plans/2026-04-15-top-picks-dedicated-screen.md`
- Deferred enhancements: `2026-04-15-top-picks-deferred-enhancements.md`

---

## What shipped

A dedicated `CategoryTopPicksScreen` that replaces the current `TopPicksCarousel` "See All" destination with a finite, curated **top-20 showcase** — Hero (rank #1 with 3 insight bullets) + Leaderboard (ranks #2–20, 1 insight each) + Escape Hatch footer to the existing `CategoryBrowseScreen`.

- **Concierge vs. Warehouse intent:** Old flow dumped Buyer-intent users into a 19,058-product infinite scroll. New flow serves them a finite, ranked list with reasoning per pick.
- **Insights engine:** Pure function generates up to 3 D-094/D-095-compliant bullets per pick from **static signals only** — no score_breakdown caching, no engine re-run, no new migrations.
- **Supplements bypass:** `supplement` category skips the new screen entirely (unscored per D-096) and routes to `CategoryBrowseScreen` unchanged.
- **UPVM compliance** enforced by a blocklist regex unit test — copy templates guaranteed factual (`"Free of chicken"`, `"AAFCO Adult Maintenance"`, `"Lower-fat formula (10% DMB)"`), never therapeutic.

---

## Files created or modified (15 production commits)

### Type scaffolding (1 file)

- **`src/types/categoryBrowse.ts`** — extended existing file. Added:
  - `TopPickEntry` interface (extends `BrowseProduct`) with insight-source fields: `ga_protein_pct`, `ga_fat_pct`, `ga_moisture_pct`, `ga_protein_dmb_pct`, `ga_fat_dmb_pct`, `preservative_type`, `aafco_statement`, `life_stage_claim`, `top_ingredients[]`.
  - `InsightKind` union type (6 values: `'allergen_safe' | 'life_stage' | 'macro_fat' | 'macro_protein' | 'preservative' | 'quality_tier'`).
  - `InsightBullet` interface (`{ kind, text }`).

### Service layer (2 files)

- **`src/services/topPickInsights.ts`** (NEW) — pure helper `generateTopPickInsights(entry, ctx): InsightBullet[]`. Private check functions per insight kind, all orchestrated with fixed priority ordering and a cap of 3. D-016 DMB conversion helper included.

- **`src/services/categoryBrowseService.ts`** (MODIFIED) — replaced the stub `fetchCategoryTopPicks` with a real 2-query composition:
  1. `pet_product_scores !inner products` with expanded SELECT (macros, AAFCO, preservative, life_stage_claim). Inherits bypass filters (`is_vet_diet`, `is_recalled`, `is_variety_pack`, `needs_review`, species mismatch).
  2. `product_ingredients !inner ingredients_dict` batched for the top-20 survivor IDs, position ≤ 10, hydrates `top_ingredients[]` with allergen_group preview.

### Navigation (2 files)

- **`src/types/navigation.ts`** (MODIFIED) — added `CategoryTopPicks: { category, petId, subFilter? }` to `HomeStackParamList`.
- **`src/navigation/index.tsx`** (MODIFIED) — imported and registered `CategoryTopPicksScreen` inside `HomeStackScreen.Navigator`.

### Components (3 new files, 1 modified)

- **`src/components/browse/TopPickHeroCard.tsx`** (NEW) — Crown Jewel. Matte Premium Featured Action Card: `cardSurface` bg, accent-tint 2px border, `borderRadius: 16`, trophy chip "Best overall match for {Pet}", product image on white stage, compact circular score badge (92px), brand + name, up to 3 insight bullets with checkmark icons. Whole card is the tap target.

  **Note:** Uses a lightweight score badge, not the full `ScoreRing` component. `ScoreRing` requires `petPhotoUri` + `species` props not available in browse context. Aligns with Gemini's V2 mockup. Documented in the component file header.

- **`src/components/browse/TopPickRankRow.tsx`** (NEW) — Leaderboard row. Matte Premium card anatomy, rank badge (`#N`), product image, brand + name, single insight (highest-priority), score pill.

- **`src/components/browse/topPicksCarouselHelpers.ts`** (NEW) — `resolveSeeAllDestination(category): 'CategoryTopPicks' | 'CategoryBrowse'`. Supplements short-circuit to `CategoryBrowse`; everything else routes to `CategoryTopPicks`.

- **`src/components/browse/TopPicksCarousel.tsx`** (MODIFIED) — `handleSeeAll` updated to call `resolveSeeAllDestination` and navigate to the resolved route. Rest of the carousel unchanged.

### Screen (2 new files)

- **`src/screens/CategoryTopPicksScreen.tsx`** (REPLACED from placeholder) — 225-line full implementation:
  - Paywall gate (`canSearch()`).
  - Tab bar hide/restore on focus (matches `CompareScreen` pattern).
  - Parallel fetch: `Promise.all([fetchCategoryTopPicks, getPetAllergens])`.
  - Client-side insight computation per pick → `insightsMap`.
  - 4 states: loading, healthy (≥10 picks), partial (1–9 picks with primary-tint escape hatch), empty (empty card + escape hatch).
  - Hero renders `picks[0]` with 3 insights.
  - Leaderboard loops `picks.slice(1)` rendering `TopPickRankRow` × 19 with ranks 2–20.
  - Escape hatch routes to `CategoryBrowse` with preserved `{category, petId, subFilter}`.
  - `mountedRef` cleanup pattern prevents unmount state updates.

- **`src/screens/categoryTopPicksHelpers.ts`** (NEW) — pure helpers extracted for testability:
  - `getCategoryTitle(category)` — maps to `'Daily Food' | 'Toppers & Mixers' | 'Treats' | 'Supplements'`.
  - `getFilterLabel(category, subFilterKey)` — lookup from `SUB_FILTERS`, null if not found.
  - `getTopPicksTitle(category, subFilterKey, petName)` — composite title generator:
    - No sub-filter: `"Top {Category} for {Pet}"`
    - Daily Food + sub: `"Top {Filter} Food for {Pet}"`
    - Toppers & Mixers + sub: `"Top {Filter} Toppers for {Pet}"`
    - Treats/Supplements + sub: `"Top {Filter} for {Pet}"`

### Test files (6 new)

- `__tests__/services/topPickInsights.test.ts` — **37 tests** covering every insight kind + priority/cap + UPVM blocklist sweep + empty-data tolerance.
- `__tests__/services/categoryBrowseService.test.ts` — **4 tests** for `fetchCategoryTopPicks` (happy path with full shape, error handling, bypass filters, supplement short-circuit).
- `__tests__/components/browse/TopPickHeroCard.test.tsx` — **2 render tests** (renders all content, onPress invokes).
- `__tests__/components/browse/TopPickRankRow.test.tsx` — **3 render tests** (renders rank/brand/name/score/insight, onPress invokes, no-insight variant).
- `__tests__/components/browse/topPicksCarouselHelpers.test.ts` — **5 unit tests** (supplement→CategoryBrowse, others→CategoryTopPicks, null default).
- `__tests__/screens/categoryTopPicksHelpers.test.ts` — **12 unit tests** for all 3 title/label helpers.

**Total: 63 new tests. Suite count grew from 65 → 71 (+6).**

---

## Numbers

| Metric | Before | After | Delta |
|---|---|---|---|
| Tests | 1538 | **1596** | +58 |
| Suites | 65 | **71** | +6 |
| Snapshots | 3 | 3 | — |
| Decisions | 129 | 129 | — |
| Migrations | 39 | 39 | — |
| Products | 19,058 | 19,058 | — |

**Regression anchors (all green):**
- Pure Balance (Dog, daily food) = 61 ✓
- Temptations (Cat, treat) = 0 ✓
- Pure Balance + cardiac dog = 0 (DCM zero-out) ✓
- Pure Balance + pancreatitis dog = 53 (fat >12% DMB penalty) ✓

**Typecheck:** clean in `src/`.

---

## Architecture decisions captured

1. **Path A over Path B or C for insights.**
   - Rejected caching `score_breakdown JSONB` (Path B, migration 040) — ~5-10KB/row adds ~500MB storage for heavy users, and much of the breakdown is UPVM-risky.
   - Rejected re-running pipeline on mount (Path C) — 2-5s spinner, poor UX.
   - **Path A (static signals):** insights from joined macros + AAFCO + preservative + `ingredients_dict.allergen_group`. No migration, no engine re-run, UPVM-safe by construction.

2. **Two-query composition over a Postgres RPC** (for `fetchCategoryTopPicks`). Kept insight logic in TypeScript; no new versioned RPC to maintain.

3. **Supplements skip the new screen.** Routing decision in `resolveSeeAllDestination` — supplements are unscored (D-096) so the "top N" concept doesn't apply. Continue using `CategoryBrowseScreen` (alphabetical).

4. **Sub-filter is locked to entry params.** No `SubFilterChipRow` on the screen. Filter switching is Explorer intent (belongs on `CategoryBrowseScreen`); Top Picks is a single-purpose curated view. Back-out to HomeScreen to change filter.

5. **Hero uses a compact score badge, not the full ScoreRing.** ScoreRing requires pet context props (`petPhotoUri`, `species`) not available in the browse layer. Matches Gemini V2 mockup's compact ring. Documented inline.

6. **Empty state does not self-heal with `batchScoreHybrid`.** Relies on the carousel's existing trigger. Avoids a 5-10s blocking spinner on mount and preserves the "curated" feel. Escape hatch always routes to CategoryBrowseScreen which has its own cold-cache handling.

7. **Insight priority + cap contract:** `allergen_safe > life_stage > macro (fat else protein, only one) > preservative > quality_tier`. Cap at 3 bullets. Hero renders all 3; rank rows render only `[0]`.

8. **UPVM compliance is enforced by unit test.** Blocklist regex `/\b(prescribe|treat|cure|prevent|diagnose|heal|remedy|support|improve|good for|helps with|manages?|reduces|eliminates)\b/i` run against every bullet emitted from a fixture matrix. Any copy template that slips a blocklisted term fails CI.

---

## Copy templates shipped (all D-094/D-095 compliant)

| Insight kind | Template | Example |
|---|---|---|
| allergen_safe (1) | `"Free of {allergen}"` | `"Free of chicken"` |
| allergen_safe (2) | `"Free of {a} and {b}"` | `"Free of chicken and beef"` |
| allergen_safe (3+) | `"Free of {N} of {Pet}'s allergens"` | `"Free of 3 of Troy's allergens"` |
| life_stage | `"AAFCO {LifeStageLabel}"` | `"AAFCO Adult Maintenance"` |
| macro_fat | `"Lower-fat formula ({X}% DMB)"` | `"Lower-fat formula (10% DMB)"` |
| macro_protein | `"High protein ({X}% DMB)"` | `"High protein (40% DMB)"` |
| preservative | `"Natural preservatives only"` | — |
| quality_tier | `"Top-tier ingredient quality"` | — (emitted when `final_score >= 85`) |

**Screen chrome copy:**
- Header title: `"Top Daily Food for Troy"` (or `"Top Dry Food for Troy"`, etc.)
- Sub-header (healthy): `"Ranked 1–N matches for {Pet}"`
- Sub-header (partial): `"Ranked 1–N — limited results for this filter"`
- Leaderboard section label: `"The Leaderboard"`
- Hero badge: `"Best overall match for {Pet}"`
- Escape hatch (healthy): `"Didn't find the right fit? Browse all {Category} →"`
- Escape hatch (partial/empty): `"Browse all {Category} →"`
- Empty state: `"No scored picks yet"` + `"We haven't scored any {filter} for {Pet} yet. Browse the full catalog below."`

---

## Commits (session 50 + 51)

### Session 50 (brainstorm + plan + Task 1)

1. `e3e0d7e` — design spec written + committed
2. `c84e6b5` — implementation plan written + committed (12 tasks, ~2500 lines)
3. `7f3fa90` — Kiba Index deferred as item #1 in the deferred-enhancements doc
4. `850dd6b` — **Task 1:** types scaffolding (TopPickEntry + InsightBullet + InsightKind)
5. `6649cc8` — session 50 handoff CURRENT.md update

### Session 51 (Tasks 2–11 execution + verification)

6. `805f6de` — **Task 2:** topPickInsights — allergen_safe bullet
7. `b613fd7` — **Task 3:** topPickInsights — life_stage bullet
8. `4e98f5b` — **Task 4:** topPickInsights — macro bullets with DMB conversion
9. `e0a3f42` — **Task 5:** topPickInsights — preservative, quality_tier, priority cap, UPVM sweep
10. `cc0e002` — **Task 6:** fetchCategoryTopPicks real implementation
11. `3392dcb` — **Task 7:** navigation scaffolding + placeholder screen
12. `c728adf` — **Task 8:** TopPickRankRow component + render test
13. `7b90b16` — **Task 9:** TopPickHeroCard component + render test
14. `162aa97` — Task 9 follow-up: document ScoreRing substitution rationale
15. `687b550` — **Task 10:** resolveSeeAllDestination + carousel wiring
16. `bcef873` — **Task 11:** CategoryTopPicksScreen full wiring
17. `002c22e` — Task 11 follow-up: dep array cleanup + loop variable rename
18. `b9e7a1d` — session 51 handoff CURRENT.md update

---

## Gemini UI mockups

**Path:** `/Users/stevendiaz/.gemini/antigravity/brain/f0c232ab-d2dc-4bf4-a029-dcec47c17c7b/`

- V1 mockups (superseded — violated D-095 with `"Immune Support"`, `"Skin & Coat Health"`, `"Ideal for digestion"`). **Do not use.**
- **V2 mockups** (`_v2_177628988…` suffix) — locked in. Insight copy matches spec templates verbatim. Hero uses compact score ring + two-column layout (bullets beside ring). Rank rows use cyan score pill.

**Deltas between V2 mockups and current implementation (visual polish pending):**
- Brand rendered in `.toUpperCase()` on rank rows (trivial render change).
- Top-2 ingredients subtitle on hero (`"chicken, brown rice"` — data already hydrated, one-line render add).
- Hero layout is vertical in implementation (image top, score badge inline with text below); V2 mockup has a two-column hero. Functional parity; visual polish pending.

---

## Deferred enhancements

11 items documented in `2026-04-15-top-picks-deferred-enhancements.md`. Notable:

1. **Kiba Index integration** (#1) — community taste/tummy voting as a display + sort tiebreaker (NOT a score modifier per D-019 brand-blind). Deferred until vote density accumulates (months to years).
2. **Migration 040** — cache `score_breakdown JSONB` for richer layer-3 insights. Not needed for MVP.
3. Cross-category "Picks for {Pet}" hub (Apple-style rails).
4. Inline "Add to Pantry" action on picks.
5. Self-healing `batchScoreHybrid` on empty state.
6. Screen-level integration test.
7. Additional entry points (digest push, deep links, Safe Swap outcomes).
8. Condition-driven bullets (pending vet/legal review).
9. Compare hook on hero.
10. Feline carb bullet (D-014).
11. Same-brand disambiguation for rank-row display names.

---

## What's NOT done

- **Branch not pushed to origin.** Run `git push -u origin m9-top-picks-screen` before opening a PR.
- **On-device smoke test.** Start dev server, walk the flow: HomeScreen → select Daily Food → Dry sub-filter → See All → confirm lands on new screen. Test hero tap, rank row tap, escape hatch, back button. Test supplements → See All → should skip to CategoryBrowse.
- **PR against `m5-complete`.** Once smoke-tested, open PR. Title: `"M9: Top Picks dedicated screen"`. Body should link spec + plan + this shipped doc.
- **Visual polish deltas from Gemini V2 mockup** (brand CAPS, top-2 ingredients subtitle, two-column hero layout) — deferred to a dedicated polish session or rolled into the PR review pass.
- **Spec section 3 update** — spec still describes the original image-top / bullets-below hero layout. Consider updating to match shipped implementation, or leave as design intent with an implementation-note callout.

---

## How to review

1. Read this doc top to bottom for context.
2. Open the PR (when created) — `gh pr view {n} --web`.
3. Run the full test suite locally: `npx jest`. Expect 1596/71 passing.
4. Check regression anchors: `npx jest __tests__/services/scoring/regressionAnchors.test.ts`. Pure Balance = 61, Temptations = 0.
5. Spot-check UPVM compliance: `npx jest __tests__/services/topPickInsights.test.ts -t "UPVM"`. Blocklist sweep asserts every emitted bullet is clean.
6. On-device: navigate Daily Food → Dry → See All. Confirm the new screen renders correctly in all 4 states.
