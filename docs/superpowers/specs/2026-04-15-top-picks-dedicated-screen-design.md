# Top Picks Dedicated Screen — Design Spec

**Date:** 2026-04-15
**Milestone:** M9 (UI Polish & Search)
**Status:** Design — awaiting user review before implementation plan
**Hand-off:** UI mockups to Gemini once this spec is locked

---

## Problem

Today, the HomeScreen `TopPicksCarousel` ("Top Picks for {Pet}") exposes a "See All" link that navigates to `CategoryBrowseScreen` — a flat, infinite-scroll FlashList sorted by score. That's a jarring context switch:

- Category Browse serves the **Explorer intent**: "Let me dig through the database, apply filters, see what's out there." (The Warehouse.)
- Top Picks serves the **Buyer intent**: "Kiba, do the heavy lifting. Tell me what to buy and prove why it's the best." (The Concierge.)

Pet food shopping induces high decision fatigue. Dropping a user with Buyer intent into a 19,058-product infinite scroll triggers paralysis. A hard-capped, curated top-N list signals: "We ran the math against every product. Stop scrolling. Pick one of these."

We also have an algorithm transparency gap. Users see a score pill but no reasoning. The dedicated screen unlocks vertical real estate to surface **why** a product matched — turning a sorted list into an expert consultation.

## Goals

1. Deliver a finite, showcase-style "Top 20" experience per `{category, subFilter, pet}` that replaces the current See All destination.
2. Surface 2-3 personalized insights per pick (hero) and 1 headline insight per rank row — all D-094/D-095 compliant — using only data already joined in the query.
3. Bridge Concierge and Explorer intents via an escape-hatch footer that routes to the existing `CategoryBrowseScreen` with identical params.
4. Keep supplements (unscored, D-096) and vet diets (D-135 bypass) out of the new screen entirely — their See All paths stay on the existing flat browse.

## Non-goals

- **Cross-category hub** ("Apple rails" of Top Daily + Top Topper + Top Treat in one view). Deferred — see `2026-04-15-top-picks-deferred-enhancements.md`.
- **Caching `score_breakdown JSONB` on `pet_product_scores`**. Migration 012 deliberately excluded it ("list view only — full breakdown computed on tap"). V1 uses static signals joined in the query; richer layer-3 insights deferred.
- **Inline "Add to Pantry"** action on picks. Conflicts with D-167 / behavioral feeding gating; needs a pre-confirmation flow. Deferred.
- **Self-healing `batchScoreHybrid()` trigger on empty state.** V1 relies on the carousel / `ensureCacheFresh` to have fired scoring; if empty, we bounce to CategoryBrowseScreen. Deferred.
- **Deep-link / notification entry points.** Carousel-only in V1.
- **Condition-driven bullets** (e.g., "Grain-free" for wheat-allergic pet, kidney/phosphorus callouts). UPVM risk — needs vet + legal review.
- **Compare hook on hero** ("Compare with last scan"). Deferred.

## Terminology

- **Hero / Crown Jewel** — the rank-#1 pick rendered as a featured card at the top of the screen (full ScoreRing, 3 insight bullets, accent-tint border).
- **Leaderboard** — ranks #2 through #20, rendered as taller-than-standard rows with a prominent rank badge and 1 headline insight.
- **Escape Hatch** — full-width secondary CTA at the bottom of the scroll view routing to `CategoryBrowseScreen` with the same `{category, petId, subFilter}` params.
- **Insight bullet** — a single D-094/D-095-compliant short phrase describing a factual property of the food relevant to this pet (e.g., `"Free of chicken"`, `"AAFCO Adult Maintenance"`).
- **Static signals** — insight inputs available in the current schema without cache breakdown or re-running the scoring pipeline: pet allergens, product macros (DMB), AAFCO claims, preservative type, top-10 ingredients (via `product_ingredients` + `ingredients_dict.allergen_group`), cached `final_score`.

---

## Architecture

### Scope & boundaries

**Screen:** `CategoryTopPicksScreen` — a dedicated, finite top-20 experience. Reachable only via `TopPicksCarousel` → See All from HomeScreen.

**Entry params** (unchanged from existing See All wiring):

```ts
{ category: BrowseCategory, petId: string, subFilter?: string }
```

**Stack placement:** new route `CategoryTopPicks` on `HomeStackParamList`, alongside existing `CategoryBrowse`.

**Tab bar:** hidden on focus via `navigation.getParent().setOptions({ tabBarStyle: { display: 'none' } })` — matches `CompareScreen` pattern.

**Paywall gate:** `canSearch()` — same gate as `CategoryBrowseScreen` (premium-only today). Non-premium users can never reach this screen because category taps on HomeScreen already gate through `canSearch()` at `HomeScreen.tsx:330`.

**Sub-filter is locked to entry params.** There is no `SubFilterChipRow` on this screen. If the user wants to switch from `Dry` to `Wet`, they back out to HomeScreen, change the sub-filter on the category card, and re-enter. Rationale: filter switching is Explorer intent (belongs on `CategoryBrowseScreen`); Top Picks is a single-purpose curated view for one filter at a time. Keeps the "concierge" framing intact and avoids per-filter re-fetch state management on a finite-list screen.

### Category routing matrix

| Entry context | See All destination |
|---|---|
| `category = 'daily_food'` | `CategoryTopPicks` (new) |
| `category = 'toppers_mixers'` (scored at 65/35/0) | `CategoryTopPicks` (new) |
| `category = 'treat'` | `CategoryTopPicks` (new) |
| `category = 'supplement'` (unscored, D-096) | `CategoryBrowse` (existing — alphabetical) |
| `subFilter = 'vet_diet'` | Unreachable — carousel already hides at `HomeScreen.tsx:540` |

The branching logic lives in `TopPicksCarousel.handleSeeAll`. No other entry points for V1.

### Data flow

```
CategoryTopPicksScreen mounts with {category, petId, subFilter}
  │
  ├── canSearch() gate → goBack if false
  │
  ├── fetchCategoryTopPicks(petId, category, subFilter, species, 20)
  │     │
  │     ├─ Query 1: pet_product_scores !inner join products
  │     │    SELECT final_score, is_supplemental,
  │     │           products.{name, brand, image_url, product_form,
  │     │                     ga_protein_pct, ga_fat_pct, ga_moisture_pct,
  │     │                     ga_protein_dmb_pct, ga_fat_dmb_pct,
  │     │                     preservative_type, aafco_statement, life_stage_claim}
  │     │    Filters: pet_id, category, post-query exclude vet_diet/recalled/variety_pack/needs_review/species-mismatch
  │     │    Order by final_score DESC, limit 20 (with overfetch buffer for sub-filters)
  │     │
  │     └─ Query 2 (batched, top-20 IDs only):
  │          product_ingredients !inner join ingredients_dict
  │          SELECT product_id, position, canonical_name, allergen_group
  │          WHERE product_id IN (...20 ids) AND position <= 10
  │          → hydrated in-memory onto BrowseProduct[]
  │
  ├── For each pick: generateTopPickInsights(pick, pet) → InsightBullet[]
  │
  └── Render: HeroCard (pick[0]) + RankRow × (pick[1..19]) + EscapeHatch
```

**One-shot load.** No pagination. No infinite scroll. `ScrollView`, not `FlashList`.

### Architectural decisions

1. **Two batched queries, not a Postgres RPC.** Keeps insight logic in TypeScript and avoids a new versioned RPC in the migrations pipeline. Cost: one extra round-trip for the ingredient preview. Acceptable — 20 IDs, indexed lookup.
2. **Insights are computed client-side** from static fields joined in Query 1 + ingredient allergen groups from Query 2. No scoring engine re-run, no `score_breakdown` dependency.
3. **No `batchScoreHybrid` trigger on empty.** The escape hatch handles this edge. Rationale: avoids a 5–10s blocking spinner on mount and preserves the "curated" feel; the carousel and `ensureCacheFresh` already do the upfront work.

---

## Files touched

| File | Change |
|------|--------|
| `src/services/categoryBrowseService.ts` | Replace `fetchCategoryTopPicks` stub with real impl. Return `TopPickEntry[]` enriched with insight-source fields. |
| `src/services/topPickInsights.ts` | **New.** Pure helper `generateTopPickInsights(entry, pet): InsightBullet[]`. Fully unit-testable. |
| `src/types/categoryBrowse.ts` | Extend types: new `TopPickEntry` (superset of `BrowseProduct` with macros + AAFCO + preservative + ingredient preview). New `InsightBullet` type. |
| `src/screens/CategoryTopPicksScreen.tsx` | **New.** Hero + Leaderboard + Escape Hatch. `ScrollView`. |
| `src/components/browse/TopPickHeroCard.tsx` | **New.** Crown Jewel — ScoreRing, "Best overall match" badge, 3 insights, brand + name. Tap → `Result`. |
| `src/components/browse/TopPickRankRow.tsx` | **New.** Leaderboard row — rank badge, image, name/brand, score pill, 1 headline insight. |
| `src/components/browse/TopPickEscapeHatch.tsx` | **New.** Full-width secondary CTA → `CategoryBrowse` with same params. |
| `src/components/browse/TopPicksCarousel.tsx` | `handleSeeAll` — branch: `supplement` → `CategoryBrowse`, else → `CategoryTopPicks`. |
| `src/types/navigation.ts` | Add `CategoryTopPicks: { category, petId, subFilter? }` to `HomeStackParamList`. |
| `src/navigation/index.tsx` | Register the new screen on HomeStack. |
| `__tests__/services/topPickInsights.test.ts` | **New.** 13-case unit suite. |
| `__tests__/services/categoryBrowseService.test.ts` | Extend for new `fetchCategoryTopPicks` impl. |
| `__tests__/components/browse/TopPickRankRow.test.tsx` | **New.** Render test (pure presentation). |
| `__tests__/components/browse/TopPickHeroCard.test.tsx` | **New.** Render test (pure presentation). |

Screen-level integration test (`CategoryTopPicksScreen.test.tsx`) **deferred** — 4-state machine is light, insight + data layer are covered by unit tests. Add later only if a regression bites.

---

## Types

```ts
// src/types/categoryBrowse.ts — additions

/** Expanded BrowseProduct for Top Picks screen — includes insight-source fields */
export interface TopPickEntry extends BrowseProduct {
  ga_protein_pct: number | null;
  ga_fat_pct: number | null;
  ga_moisture_pct: number | null;
  ga_protein_dmb_pct: number | null;  // migration 020 — pre-computed when available
  ga_fat_dmb_pct: number | null;
  preservative_type: 'natural' | 'synthetic' | 'mixed' | 'unknown' | null;
  aafco_statement: string | null;
  life_stage_claim: string | null;
  /** Top 10 ingredients with allergen_group — from product_ingredients + ingredients_dict */
  top_ingredients: Array<{ position: number; canonical_name: string; allergen_group: string | null }>;
}

/** A single insight bullet rendered on Hero or Rank Row */
export interface InsightBullet {
  /** Priority key — determines ordering when capping */
  kind: 'allergen_safe' | 'life_stage' | 'macro_protein' | 'macro_fat' | 'preservative' | 'quality_tier';
  /** Display text — already interpolated, already UPVM-compliant */
  text: string;
}
```

---

## Service contracts

### `fetchCategoryTopPicks`

```ts
export async function fetchCategoryTopPicks(
  petId: string,
  category: BrowseCategory,
  subFilterKey: string | null,
  species: 'dog' | 'cat',
  limit: number = 20,
): Promise<TopPickEntry[]>
```

**Behavior:**
- Calls the existing `fetchScoredResults` internals with expanded `SELECT` to include macros + preservative + AAFCO + life-stage.
- Runs Query 2 against `product_ingredients !inner ingredients_dict` for the top-N product IDs, position ≤ 10. Hydrates `top_ingredients` onto each entry.
- Returns up to `limit` entries. Inherits all existing bypass filters (`is_vet_diet`, `is_recalled`, `is_variety_pack`, `needs_review`, species mismatch).
- Returns `[]` on error. Callers decide the empty-state treatment.
- Supplement category: never called (carousel handler routes elsewhere). Implementation still handles it defensively by returning `[]`.

### `generateTopPickInsights`

```ts
export function generateTopPickInsights(
  entry: TopPickEntry,
  pet: Pet,
): InsightBullet[]
```

**Pure function.** No I/O, no async. Unit-testable in isolation.

**Input constraints:**
- `entry` must have `final_score != null` (caller filters).
- `entry.top_ingredients` may be empty (fall through, no allergen bullet).
- `pet.allergens` may be empty array or undefined — treat as empty.
- `pet.weight_goal_level` is `-3..+3`, default `0`.
- `pet.activity_level` is `'low'|'moderate'|'high'|'working'`.

**Algorithm — fixed priority, cap at 3:**

```
order = []

if pet.allergens.length > 0 and no top-10 ingredient matches pet.allergens by allergen_group:
  order.push(allergen_safe bullet)

if entry.life_stage_claim or entry.aafco_statement matches pet.life_stage:
  order.push(life_stage bullet)

if category != 'treat' and !entry.is_supplemental and DMB resolvable:
  if pet.weight_goal_level < 0 and dmb_fat_pct < 12:
    order.push(macro_fat bullet — "Lower-fat formula (X% DMB)")
  elif (pet.weight_goal_level < 0 or activity in ['high','working']) and dmb_protein_pct >= 32:
    order.push(macro_protein bullet — "High protein (X% DMB)")

if entry.preservative_type === 'natural':
  order.push(preservative bullet)

if entry.final_score >= 85:
  order.push(quality_tier bullet)

return order.slice(0, 3)
```

**DMB conversion (D-016):**
- If `ga_*_dmb_pct` already populated (migration 020), use it.
- Else if `ga_moisture_pct > 10`: `dmb = gaAsFed / (100 - gaMoisture) * 100`.
- Else (kibble ≤ 10% moisture): use as-fed value directly.
- Else (missing moisture + missing pre-computed DMB): **skip the bullet entirely**. No speculative guesses.

---

## Copy strings

### Screen chrome

| Element | Copy template |
|---------|--------------|
| Header title | `"Top {subFilterLabel \|\| categoryLabel} for {Pet}"` |
| Header title examples | `"Top Daily Food for Troy"` · `"Top Dry Food for Troy"` · `"Top Freeze-Dried Food for Troy"` · `"Top Wet Toppers for Troy"` · `"Top Jerky & Chews for Troy"` |
| Pet badge | Paw icon + `"{Pet}"` |
| Sub-header (healthy, ≥10) | `"Ranked 1–20 matches for {Pet}"` |
| Sub-header (partial, 1–9) | `"Ranked 1–{N} — limited results for this filter"` |
| Leaderboard section label | `"The Leaderboard"` |
| Hero accent badge | `"Best overall match for {Pet}"` |
| Escape hatch (healthy) | `"Didn't find the right fit? Browse all {categoryLabel} →"` |
| Escape hatch (partial / empty) | `"Browse all {categoryLabel} →"` |
| Empty state title | `"No scored picks yet"` |
| Empty state body | `"We haven't scored any {filterLabel} for {Pet} yet. Browse the full catalog below."` |

### Insight bullet templates

| Check | Template | Example |
|-------|----------|---------|
| Allergen-safe (1 allergen clean) | `"Free of {allergen}"` | `"Free of chicken"` |
| Allergen-safe (2 allergens clean) | `"Free of {a} and {b}"` | `"Free of chicken and beef"` |
| Allergen-safe (3+ allergens clean) | `"Free of {N} of {Pet}'s allergens"` | `"Free of 3 of Troy's allergens"` |
| Life stage match | `"AAFCO {life_stage_label}"` | `"AAFCO Adult Maintenance"` |
| Macro — low-fat (weight loss) | `"Lower-fat formula ({X}% DMB)"` | `"Lower-fat formula (10% DMB)"` |
| Macro — high-protein (weight loss OR high activity) | `"High protein ({X}% DMB)"` | `"High protein (36% DMB)"` |
| Preservative quality | `"Natural preservatives only"` | — |
| Ingredient quality tier (`final_score >= 85`) | `"Top-tier ingredient quality"` | — |

### UPVM compliance

All insight copy is factual — properties of the food or pet data. No verbs from the blocklist:

```
/\b(prescribe|treat|cure|prevent|diagnose|heal|remedy|support|improve|good for|helps with|manages?|reduces|eliminates)\b/i
```

A unit test asserts every bullet emitted across a fixture matrix passes this regex. Framing stays clinical — the user draws the therapeutic connection themselves.

### Category-specific rule adjustments

- **Treats (`category === 'treat'`):** skip life stage match (treats aren't AAFCO-complete), skip macro bullet. Allowed: allergen-safe, preservative quality, ingredient quality tier.
- **Toppers & Mixers (`is_supplemental === true`):** skip macro bullet (D-136 — supplemental products are macro-scored only, not nutritionally complete). Allowed: allergen-safe, life stage match (if claim present), preservative quality, ingredient quality tier.

---

## Components

### `CategoryTopPicksScreen`

```
SafeAreaView
├── Header (fixed, not scrolled)
│   ├── Back chevron (left)
│   ├── Title (center, flex-1)
│   └── Pet badge (right)
│
└── ScrollView
    ├── Sub-header strip ("Ranked 1–N matches for {Pet}")
    ├── <TopPickHeroCard pick={picks[0]} petName={petName} onPress={...} />
    ├── Leaderboard label ("The Leaderboard")
    ├── <TopPickRankRow pick={picks[i]} rank={i+1} ... /> × 19
    └── <TopPickEscapeHatch ... />
```

### Screen states

1. **Loading** — centered `ActivityIndicator` + `"Loading top picks..."`. No skeleton in V1.
2. **Healthy (≥ 10 picks)** — full render above.
3. **Partial (1–9 picks)** — hero + available rank rows + prominent (accent-tinted) escape hatch. Sub-header: `"Ranked 1–N — limited results for this filter"`.
4. **Empty (0 picks)** — skip hero entirely. Single empty-state card + escape hatch. No hero, no rank rows, no `batchScoreHybrid` trigger.

### Component contracts

**`TopPickHeroCard`**
- Props: `{ pick: TopPickEntry, petName: string, insights: InsightBullet[], onPress: () => void }`
- Visual: Matte Premium "Featured Action Card" pattern (`.agent/design.md:172-188`) — `cardSurface` bg, accent-tint border, `borderRadius: 16`, `padding: Spacing.md`.
- White-stage product image (square, large).
- Full 360° `ScoreRing` (existing component in `src/components/scoring/`) — same as ResultScreen.
- Accent badge: "Best overall match for {Pet}".
- Brand (small, textSecondary) + name (md, semibold, 2 lines).
- Up to 3 insight bullets, each with a checkmark icon and the bullet text.
- Whole card is the tap target → navigate to `Result { productId, petId }`. No explicit button in V1 (Gemini can add in mockup if visual design calls for it).

**`TopPickRankRow`**
- Props: `{ pick: TopPickEntry, rank: number, insight: InsightBullet | null, onPress: () => void }`
- Visual: Matte Premium card anatomy (`cardSurface`, `hairlineBorder`, `borderRadius: 16`, `padding: Spacing.md`).
- Horizontal layout: rank badge (`#N`, prominent) — product image (medium, white-staged) — text block (brand + name + insight) — score pill (right).
- Taller than existing `BrowseProductRow` to fit the single insight.
- Whole row is tap target → `Result { productId, petId }`.

**`TopPickEscapeHatch`**
- Props: `{ category: BrowseCategory, petId: string, subFilter?: string, petName: string, onPress?: () => void }`
- Full-width secondary button. Default handler: `navigation.navigate('CategoryBrowse', { category, petId, subFilter })`.
- Copy adapts per state (see Copy strings table).
- Matte Premium secondary-CTA styling — hairline border, no fill.

### Matte Premium compliance

All cards follow `.agent/design.md`:
- `Colors.cardSurface`, `Colors.hairlineBorder`, `borderRadius: 16`, `padding: Spacing.md`, `marginBottom: Spacing.md`.
- Hero uses accent-tint border (`borderWidth: 2`) to read as Featured Action Card.
- Press overlay via `pressOverlay` token on all tap targets.
- Zero emojis (D-084) — Ionicons + SEVERITY_COLORS only.
- ScoreRing stays ≥ 12pt pill + D-094 "X% match" phrasing everywhere a numeric score appears in chrome (not needed inside pill).

---

## Testing plan

### `__tests__/services/topPickInsights.test.ts` (new — 13 cases)

1. **Allergen-safe (1)** — pet with chicken allergy + product without chicken in top-10 → `"Free of chicken"`.
2. **Allergen-safe (3+)** — pet with 3 allergens all clean → `"Free of 3 of Troy's allergens"`.
3. **Allergen-safe negative** — pet with chicken allergy + product with chicken in top-10 → bullet NOT emitted.
4. **Life stage match positive** — adult pet + `life_stage_claim = 'Adult Maintenance'` → `"AAFCO Adult Maintenance"`.
5. **Life stage match negative** — senior pet + adult-only product → bullet NOT emitted.
6. **Macro low-fat emit** — weight loss (level -2) + `ga_fat_pct=2.2, ga_moisture_pct=78` → DMB 10% → `"Lower-fat formula (10% DMB)"`.
7. **Macro low-fat skip (above threshold)** — weight loss + `ga_fat_pct=3, ga_moisture_pct=78` → DMB 13.6% → bullet NOT emitted.
8. **Macro high-protein emit** — weight loss + `ga_protein_pct=9, ga_moisture_pct=78` → DMB 40.9% → `"High protein (40% DMB)"`.
9. **Macro skipped for treats** — `category='treat'` → no macro bullet regardless of inputs.
10. **Macro skipped for toppers** — `is_supplemental=true` → no macro bullet.
11. **Macro skipped when DMB missing** — `ga_moisture_pct=null` + `ga_fat_dmb_pct=null` → bullet skipped, NOT guessed from as-fed.
12. **Preservative quality** — `preservative_type='natural'` → emitted. `'synthetic'`, `'mixed'`, `'unknown'`, `null` → NOT emitted.
13. **Ingredient quality tier** — `final_score=86` → emitted. `final_score=84` → NOT emitted.

### Bonus cases in same suite

- **Priority ordering + cap** — all checks pass → emits in order `[allergen_safe, life_stage, macro_*, preservative, quality_tier]`, sliced to 3.
- **UPVM blocklist sweep** — fixture matrix of pets × products → every emitted bullet passes the regex negative test.
- **Empty pet tolerance** — pet with no allergens, no weight goal, default activity → returns subset of bullets that require no personalization, never throws.

### `__tests__/services/categoryBrowseService.test.ts` (extend)

- `fetchCategoryTopPicks` returns up to 20.
- Filters `is_vet_diet`, `is_recalled`, `is_variety_pack`, `needs_review`, species mismatch — inherited from `fetchScoredResults`.
- Ingredient preview query hydrates `top_ingredients` correctly.
- Supplement category returns `[]` (defensive — caller should route elsewhere).

### Component render tests

- `TopPickHeroCard.test.tsx` — renders name, brand, 3 insights, "Best overall match" badge, ScoreRing. Pure presentation, no logic.
- `TopPickRankRow.test.tsx` — renders rank, name, brand, 1 insight, score pill. Rank prop correctly interpolated.

No screen-level integration test for V1.

### Regression anchors

Unchanged — Pure Balance = 61, Temptations = 0. This work is display-layer only; engine untouched.

---

## Risks

1. **Static signals feel thin.** If users A/B notice that every pick just says `"Free of chicken"` + `"AAFCO Adult Maintenance"`, the "expert consultation" framing breaks. Mitigation: priority ordering + macro/preservative/quality-tier gives enough variety; if telemetry shows flat-line insight diversity, fast-track migration 040 (deferred Path B).
2. **UPVM copy drift.** The blocklist regex catches only the obvious terms; a new template added later could slip a therapeutic claim. Mitigation: regex unit test runs on every bullet emitted across a fixture matrix — any new template must add fixture coverage.
3. **Empty state feels like a dead end.** If a user's carousel triggered batch-scoring but it failed silently, they'll land on the empty state with no recovery. Mitigation: escape hatch is always primary-colored in the empty state, routes to CategoryBrowseScreen which has its own scoring pipeline.
4. **DMB pre-computation drift.** Migration 020 added `ga_*_dmb_pct` but coverage may be partial for new imports. Mitigation: fallback to on-the-fly DMB from `ga_moisture_pct`; skip bullet if both missing.
5. **Second query latency.** The ingredient-preview round-trip adds ~100-200ms. Acceptable for a curated "wait and see" screen; if it becomes an issue, batch it into a Postgres RPC later.

---

## Deferred enhancements

See companion file: `docs/superpowers/specs/2026-04-15-top-picks-deferred-enhancements.md`.

---

## Open questions

None outstanding. Ready for the implementation plan.
