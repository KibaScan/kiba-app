# Top Picks Dedicated Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `TopPicksCarousel` "See All" destination with a finite, showcase-style `CategoryTopPicksScreen` — hero card (rank #1, 3 insights), leaderboard (#2–20, 1 insight each), escape hatch footer to existing `CategoryBrowseScreen`. Supplements skip the new screen and continue routing to `CategoryBrowseScreen`.

**Architecture:** Client-side composition of two Supabase queries — `pet_product_scores !inner products` (with expanded SELECT for macros + AAFCO + preservative) plus a batched `product_ingredients !inner ingredients_dict` lookup for the top-20 IDs. A pure helper `generateTopPickInsights(entry, ctx)` produces up to 3 D-094/D-095-compliant insight bullets per pick from static signals only (no score_breakdown caching, no new migration, no engine re-run). Navigation route `CategoryTopPicks` added to `HomeStackParamList`.

**Tech Stack:** TypeScript (strict), React Native (Expo SDK 55), Supabase-JS 2.98, Jest via jest-expo, `@testing-library/react-native` + `react-test-renderer` (render tests for pure presentation components).

**Spec:** `docs/superpowers/specs/2026-04-15-top-picks-dedicated-screen-design.md`
**Deferred items:** `docs/superpowers/specs/2026-04-15-top-picks-deferred-enhancements.md`
**Branch:** `m9-top-picks-screen` (already created, off `m5-complete`).

---

## Task 1: Types scaffolding

**Files:**
- Modify: `src/types/categoryBrowse.ts`

- [ ] **Step 1: Add `TopPickEntry` + `InsightBullet` interfaces**

Append to `src/types/categoryBrowse.ts` (after the existing `BrowsePage` interface, before `BrowseCounts`):

```ts
/** Expanded BrowseProduct for Top Picks screen — insight-source fields joined in */
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

/** A single insight bullet rendered on Hero or Rank Row. Priority key drives ordering + cap. */
export type InsightKind =
  | 'allergen_safe'
  | 'life_stage'
  | 'macro_fat'
  | 'macro_protein'
  | 'preservative'
  | 'quality_tier';

export interface InsightBullet {
  kind: InsightKind;
  /** Display text — already interpolated, already UPVM-compliant */
  text: string;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new type errors introduced).

- [ ] **Step 3: Commit**

```bash
git add src/types/categoryBrowse.ts
git commit -m "$(cat <<'EOF'
M9: add TopPickEntry + InsightBullet types

Types scaffolding for the dedicated Top Picks screen.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `topPickInsights.ts` — allergen_safe bullet (TDD)

**Files:**
- Create: `src/services/topPickInsights.ts`
- Create: `__tests__/services/topPickInsights.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/services/topPickInsights.test.ts`:

```ts
import { generateTopPickInsights, type InsightContext } from '../../src/services/topPickInsights';
import type { TopPickEntry } from '../../src/types/categoryBrowse';

function makeEntry(overrides: Partial<TopPickEntry> = {}): TopPickEntry {
  return {
    product_id: 'p1',
    product_name: 'Example Food',
    brand: 'Example Brand',
    image_url: null,
    product_form: 'dry',
    final_score: 80,
    is_supplemental: false,
    is_vet_diet: false,
    ga_protein_pct: null,
    ga_fat_pct: null,
    ga_moisture_pct: null,
    ga_protein_dmb_pct: null,
    ga_fat_dmb_pct: null,
    preservative_type: null,
    aafco_statement: null,
    life_stage_claim: null,
    top_ingredients: [],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    lifeStage: 'adult',
    weightGoalLevel: 0,
    activityLevel: 'moderate',
    allergens: [],
    category: 'daily_food',
    petName: 'Troy',
    ...overrides,
  };
}

describe('generateTopPickInsights — allergen_safe', () => {
  it('emits bullet when pet has 1 allergen and no top-10 ingredient matches', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'deboned_beef', allergen_group: 'beef' },
        { position: 2, canonical_name: 'brown_rice', allergen_group: null },
      ],
    });
    const ctx = makeCtx({ allergens: ['chicken'] });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'allergen_safe', text: 'Free of chicken' });
  });

  it('emits combined bullet for 2 clean allergens', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'salmon', allergen_group: 'fish' },
      ],
    });
    const ctx = makeCtx({ allergens: ['chicken', 'beef'] });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'allergen_safe', text: 'Free of chicken and beef' });
  });

  it('emits count-form bullet for 3+ clean allergens', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'salmon', allergen_group: 'fish' },
      ],
    });
    const ctx = makeCtx({ allergens: ['chicken', 'beef', 'dairy'], petName: 'Troy' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'allergen_safe', text: "Free of 3 of Troy's allergens" });
  });

  it('omits bullet when any top-10 ingredient matches a pet allergen', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'chicken', allergen_group: 'chicken' },
      ],
    });
    const ctx = makeCtx({ allergens: ['chicken'] });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'allergen_safe')).toBeUndefined();
  });

  it('omits bullet when pet has no allergens on record', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'chicken', allergen_group: 'chicken' },
      ],
    });
    const ctx = makeCtx({ allergens: [] });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'allergen_safe')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `npx jest __tests__/services/topPickInsights.test.ts`
Expected: FAIL with "Cannot find module" — `src/services/topPickInsights` does not exist yet.

- [ ] **Step 3: Create the helper**

Create `src/services/topPickInsights.ts`:

```ts
// Kiba — Top Pick Insights Helper
// Pure function. Generates up to 3 D-094/D-095-compliant bullets per pick
// from static signals only (no score_breakdown, no pipeline re-run).
// D-094 suitability framing, D-095 UPVM compliance, D-016 DMB conversion.

import type { LifeStage, ActivityLevel } from '../types/pet';
import type { BrowseCategory, TopPickEntry, InsightBullet } from '../types/categoryBrowse';

export interface InsightContext {
  lifeStage: LifeStage | null;
  weightGoalLevel: number;    // D-160: -3..+3
  activityLevel: ActivityLevel;
  allergens: string[];        // allergen_group names (lowercase); maps to ingredients_dict.allergen_group
  category: BrowseCategory;
  petName: string;
}

/** Max bullets rendered on Hero; rank rows use [0] only */
const MAX_BULLETS = 3;

// ─── Individual checks ────────────────────────────────────

function checkAllergenSafe(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet | null {
  if (ctx.allergens.length === 0) return null;

  const petAllergensLower = ctx.allergens.map((a) => a.toLowerCase());
  const ingredientAllergenGroups = (entry.top_ingredients ?? [])
    .map((ing) => ing.allergen_group?.toLowerCase())
    .filter((g): g is string => g != null);

  // Any pet allergen present in an ingredient's allergen_group → NOT clean
  const hasUnsafeMatch = petAllergensLower.some((petAllergen) =>
    ingredientAllergenGroups.includes(petAllergen),
  );
  if (hasUnsafeMatch) return null;

  if (petAllergensLower.length === 1) {
    return { kind: 'allergen_safe', text: `Free of ${petAllergensLower[0]}` };
  }
  if (petAllergensLower.length === 2) {
    return {
      kind: 'allergen_safe',
      text: `Free of ${petAllergensLower[0]} and ${petAllergensLower[1]}`,
    };
  }
  return {
    kind: 'allergen_safe',
    text: `Free of ${petAllergensLower.length} of ${ctx.petName}'s allergens`,
  };
}

// ─── Main ──────────────────────────────────────────────────

export function generateTopPickInsights(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet[] {
  const bullets: InsightBullet[] = [];

  const allergen = checkAllergenSafe(entry, ctx);
  if (allergen) bullets.push(allergen);

  return bullets.slice(0, MAX_BULLETS);
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx jest __tests__/services/topPickInsights.test.ts`
Expected: PASS — 5 tests in `allergen_safe` suite.

- [ ] **Step 5: Commit**

```bash
git add src/services/topPickInsights.ts __tests__/services/topPickInsights.test.ts
git commit -m "$(cat <<'EOF'
M9: topPickInsights — allergen_safe bullet

Pure helper generates "Free of {allergen}" bullet when pet has allergens
and no top-10 ingredient's allergen_group matches. Supports 1, 2, and 3+
allergen list formats. 5 unit tests cover emit/omit/count variants.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `topPickInsights.ts` — life_stage bullet

**Files:**
- Modify: `src/services/topPickInsights.ts`
- Modify: `__tests__/services/topPickInsights.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `__tests__/services/topPickInsights.test.ts` (inside the outer `describe` or as a new top-level `describe`):

```ts
describe('generateTopPickInsights — life_stage', () => {
  it('emits "AAFCO Adult Maintenance" for adult pet + adult claim', () => {
    const entry = makeEntry({ life_stage_claim: 'Adult Maintenance' });
    const ctx = makeCtx({ lifeStage: 'adult' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'life_stage', text: 'AAFCO Adult Maintenance' });
  });

  it('emits for all-life-stages claim regardless of pet stage', () => {
    const entry = makeEntry({ life_stage_claim: 'All Life Stages' });
    const ctx = makeCtx({ lifeStage: 'senior' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'life_stage', text: 'AAFCO All Life Stages' });
  });

  it('falls through to aafco_statement when life_stage_claim is null', () => {
    const entry = makeEntry({ life_stage_claim: null, aafco_statement: 'Adult Maintenance' });
    const ctx = makeCtx({ lifeStage: 'adult' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'life_stage', text: 'AAFCO Adult Maintenance' });
  });

  it('omits bullet when senior pet + adult-only claim', () => {
    const entry = makeEntry({ life_stage_claim: 'Adult Maintenance' });
    const ctx = makeCtx({ lifeStage: 'senior' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'life_stage')).toBeUndefined();
  });

  it('omits bullet when claim is missing entirely', () => {
    const entry = makeEntry({ life_stage_claim: null, aafco_statement: null });
    const ctx = makeCtx({ lifeStage: 'adult' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'life_stage')).toBeUndefined();
  });

  it('omits bullet when pet life_stage is null', () => {
    const entry = makeEntry({ life_stage_claim: 'Adult Maintenance' });
    const ctx = makeCtx({ lifeStage: null });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'life_stage')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npx jest __tests__/services/topPickInsights.test.ts`
Expected: FAIL on the 6 new tests (4 positive expectations fail, 2 currently pass by accident — the check simply doesn't exist, so no life_stage bullets are ever emitted).

- [ ] **Step 3: Implement the check**

Add the following to `src/services/topPickInsights.ts` — insert the helper above `checkAllergenSafe`, and add a call in `generateTopPickInsights` after the allergen check:

```ts
// Insert this helper above checkAllergenSafe:

function matchesPetLifeStage(claimRaw: string, petStage: LifeStage): boolean {
  const c = claimRaw.toLowerCase();
  if (c.includes('all life stage')) return true;
  if (petStage === 'puppy' && c.includes('puppy')) return true;
  if (petStage === 'kitten' && c.includes('kitten')) return true;
  if (petStage === 'adult' && (c.includes('adult') || /\bmaintenance\b/.test(c))) return true;
  if (petStage === 'senior' && c.includes('senior')) return true;
  return false;
}

/** Renders the claim with "AAFCO" prefix, title-cased. */
function formatLifeStageText(claim: string): string {
  // Trim, collapse whitespace, capitalize first letter of each word
  const tidy = claim.trim().replace(/\s+/g, ' ');
  const titled = tidy.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return `AAFCO ${titled}`;
}

function checkLifeStageMatch(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet | null {
  if (ctx.lifeStage == null) return null;
  const claim = entry.life_stage_claim ?? entry.aafco_statement;
  if (!claim) return null;
  if (!matchesPetLifeStage(claim, ctx.lifeStage)) return null;
  return { kind: 'life_stage', text: formatLifeStageText(claim) };
}
```

Update `generateTopPickInsights`:

```ts
export function generateTopPickInsights(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet[] {
  const bullets: InsightBullet[] = [];

  const allergen = checkAllergenSafe(entry, ctx);
  if (allergen) bullets.push(allergen);

  const lifeStage = checkLifeStageMatch(entry, ctx);
  if (lifeStage) bullets.push(lifeStage);

  return bullets.slice(0, MAX_BULLETS);
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx jest __tests__/services/topPickInsights.test.ts`
Expected: PASS — all allergen_safe + life_stage tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/topPickInsights.ts __tests__/services/topPickInsights.test.ts
git commit -m "$(cat <<'EOF'
M9: topPickInsights — life_stage bullet

Matches pet life_stage against product life_stage_claim (falls back to
aafco_statement). Keyword-based matcher handles Puppy/Kitten/Adult/Senior
and "All Life Stages". 6 unit tests cover positive/negative/fallback
branches plus null guards.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `topPickInsights.ts` — macro bullets (DMB conversion, D-016)

**Files:**
- Modify: `src/services/topPickInsights.ts`
- Modify: `__tests__/services/topPickInsights.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `__tests__/services/topPickInsights.test.ts`:

```ts
describe('generateTopPickInsights — macro bullets', () => {
  it('emits "Lower-fat formula (10% DMB)" for weight-loss pet + low-fat wet food', () => {
    // DMB = 2.2 / (100 - 78) * 100 = 10%
    const entry = makeEntry({ ga_fat_pct: 2.2, ga_moisture_pct: 78 });
    const ctx = makeCtx({ weightGoalLevel: -2 });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'macro_fat', text: 'Lower-fat formula (10% DMB)' });
  });

  it('omits low-fat bullet when DMB exceeds 12% threshold', () => {
    // DMB = 3 / 22 * 100 = 13.6% (fails threshold)
    const entry = makeEntry({ ga_fat_pct: 3, ga_moisture_pct: 78 });
    const ctx = makeCtx({ weightGoalLevel: -2 });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'macro_fat')).toBeUndefined();
  });

  it('emits "High protein (40% DMB)" when weight-loss pet + protein-rich wet', () => {
    // DMB = 9 / 22 * 100 ≈ 40.9% → rounds to 40
    const entry = makeEntry({ ga_protein_pct: 9, ga_moisture_pct: 78 });
    const ctx = makeCtx({ weightGoalLevel: -2 });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'macro_protein', text: 'High protein (40% DMB)' });
  });

  it('emits high-protein for high-activity pet even without weight goal', () => {
    const entry = makeEntry({ ga_protein_pct: 36, ga_moisture_pct: 9 });
    // Dry food — DMB ~= as-fed
    const ctx = makeCtx({ weightGoalLevel: 0, activityLevel: 'high' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'macro_protein', text: 'High protein (36% DMB)' });
  });

  it('prefers pre-computed ga_fat_dmb_pct when available (migration 020)', () => {
    const entry = makeEntry({ ga_fat_dmb_pct: 10, ga_fat_pct: 99, ga_moisture_pct: 99 });
    const ctx = makeCtx({ weightGoalLevel: -2 });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'macro_fat', text: 'Lower-fat formula (10% DMB)' });
  });

  it('skips macro bullet for treats', () => {
    const entry = makeEntry({ ga_protein_pct: 36, ga_moisture_pct: 9 });
    const ctx = makeCtx({ category: 'treat', weightGoalLevel: -2 });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'macro_fat' || b.kind === 'macro_protein')).toBeUndefined();
  });

  it('skips macro bullet for toppers (is_supplemental)', () => {
    const entry = makeEntry({ ga_protein_pct: 36, ga_moisture_pct: 9, is_supplemental: true });
    const ctx = makeCtx({ weightGoalLevel: -2 });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'macro_fat' || b.kind === 'macro_protein')).toBeUndefined();
  });

  it('skips macro bullet when DMB unresolvable (no moisture, no pre-computed)', () => {
    const entry = makeEntry({
      ga_fat_pct: 2,
      ga_moisture_pct: null,
      ga_fat_dmb_pct: null,
    });
    const ctx = makeCtx({ weightGoalLevel: -2 });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'macro_fat')).toBeUndefined();
  });

  it('skips macro bullet when weight goal is 0 and activity is moderate', () => {
    const entry = makeEntry({ ga_protein_pct: 36, ga_fat_pct: 5, ga_moisture_pct: 9 });
    const ctx = makeCtx({ weightGoalLevel: 0, activityLevel: 'moderate' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'macro_fat' || b.kind === 'macro_protein')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npx jest __tests__/services/topPickInsights.test.ts`
Expected: FAIL on the 9 new macro tests (no macro bullet path exists yet).

- [ ] **Step 3: Implement the check**

Add to `src/services/topPickInsights.ts` — below the life_stage helpers, above `generateTopPickInsights`:

```ts
// ─── DMB conversion (D-016) ───────────────────────────────

/** Returns DMB percentage, preferring pre-computed (migration 020) when available. */
function resolveDmb(
  asFedPct: number | null,
  preComputedDmbPct: number | null,
  moisturePct: number | null,
): number | null {
  if (preComputedDmbPct != null) return preComputedDmbPct;
  if (asFedPct == null) return null;
  if (moisturePct == null) return null;
  if (moisturePct <= 10) return asFedPct; // kibble — as-fed ≈ DMB
  const denom = 100 - moisturePct;
  if (denom <= 0) return null;
  return (asFedPct / denom) * 100;
}

/** Floor to integer for display (avoids "9.999% DMB" noise) */
function roundForDisplay(n: number): number {
  return Math.floor(n);
}

// ─── Macro checks ──────────────────────────────────────────

const LOW_FAT_DMB_THRESHOLD = 12;   // % DMB — below this = "lower-fat"
const HIGH_PROTEIN_DMB_THRESHOLD = 32; // % DMB — at or above = "high protein"

function wantsLowFat(ctx: InsightContext): boolean {
  return ctx.weightGoalLevel < 0;
}

function wantsHighProtein(ctx: InsightContext): boolean {
  return (
    ctx.weightGoalLevel < 0 ||
    ctx.activityLevel === 'high' ||
    ctx.activityLevel === 'working'
  );
}

function checkMacroFat(entry: TopPickEntry, ctx: InsightContext): InsightBullet | null {
  if (ctx.category === 'treat') return null;
  if (entry.is_supplemental) return null;
  if (!wantsLowFat(ctx)) return null;
  const dmb = resolveDmb(entry.ga_fat_pct, entry.ga_fat_dmb_pct, entry.ga_moisture_pct);
  if (dmb == null) return null;
  if (dmb >= LOW_FAT_DMB_THRESHOLD) return null;
  return { kind: 'macro_fat', text: `Lower-fat formula (${roundForDisplay(dmb)}% DMB)` };
}

function checkMacroProtein(entry: TopPickEntry, ctx: InsightContext): InsightBullet | null {
  if (ctx.category === 'treat') return null;
  if (entry.is_supplemental) return null;
  if (!wantsHighProtein(ctx)) return null;
  const dmb = resolveDmb(entry.ga_protein_pct, entry.ga_protein_dmb_pct, entry.ga_moisture_pct);
  if (dmb == null) return null;
  if (dmb < HIGH_PROTEIN_DMB_THRESHOLD) return null;
  return { kind: 'macro_protein', text: `High protein (${roundForDisplay(dmb)}% DMB)` };
}
```

Update `generateTopPickInsights` to call both — macro_fat first (more specific to weight-loss intent), macro_protein second. Only ONE macro bullet at a time (first hit wins):

```ts
export function generateTopPickInsights(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet[] {
  const bullets: InsightBullet[] = [];

  const allergen = checkAllergenSafe(entry, ctx);
  if (allergen) bullets.push(allergen);

  const lifeStage = checkLifeStageMatch(entry, ctx);
  if (lifeStage) bullets.push(lifeStage);

  // Only one macro bullet — fat takes priority for weight-loss pets
  const macroFat = checkMacroFat(entry, ctx);
  if (macroFat) {
    bullets.push(macroFat);
  } else {
    const macroProtein = checkMacroProtein(entry, ctx);
    if (macroProtein) bullets.push(macroProtein);
  }

  return bullets.slice(0, MAX_BULLETS);
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx jest __tests__/services/topPickInsights.test.ts`
Expected: PASS — all tests green (5 allergen + 6 life_stage + 9 macro = 20).

- [ ] **Step 5: Commit**

```bash
git add src/services/topPickInsights.ts __tests__/services/topPickInsights.test.ts
git commit -m "$(cat <<'EOF'
M9: topPickInsights — macro bullets with DMB conversion

"Lower-fat formula (X% DMB)" for weight-loss pets below 12% DMB fat.
"High protein (X% DMB)" for weight-loss or high-activity pets at ≥32% DMB
protein. Prefers pre-computed ga_*_dmb_pct (migration 020). Skipped for
treats, toppers, and when DMB unresolvable. Floor-rounded for display.
9 unit tests cover all branches.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `topPickInsights.ts` — preservative, quality_tier, priority cap, UPVM sweep, empty tolerance

**Files:**
- Modify: `src/services/topPickInsights.ts`
- Modify: `__tests__/services/topPickInsights.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `__tests__/services/topPickInsights.test.ts`:

```ts
describe('generateTopPickInsights — preservative', () => {
  it('emits "Natural preservatives only" when preservative_type is natural', () => {
    const entry = makeEntry({ preservative_type: 'natural' });
    const bullets = generateTopPickInsights(entry, makeCtx());
    expect(bullets).toContainEqual({ kind: 'preservative', text: 'Natural preservatives only' });
  });

  it.each(['synthetic', 'mixed', 'unknown'] as const)(
    'omits preservative bullet when type is %s',
    (type) => {
      const entry = makeEntry({ preservative_type: type });
      const bullets = generateTopPickInsights(entry, makeCtx());
      expect(bullets.find((b) => b.kind === 'preservative')).toBeUndefined();
    },
  );

  it('omits preservative bullet when type is null', () => {
    const entry = makeEntry({ preservative_type: null });
    const bullets = generateTopPickInsights(entry, makeCtx());
    expect(bullets.find((b) => b.kind === 'preservative')).toBeUndefined();
  });
});

describe('generateTopPickInsights — quality_tier', () => {
  it('emits "Top-tier ingredient quality" when final_score >= 85', () => {
    const entry = makeEntry({ final_score: 86 });
    const bullets = generateTopPickInsights(entry, makeCtx());
    expect(bullets).toContainEqual({ kind: 'quality_tier', text: 'Top-tier ingredient quality' });
  });

  it('emits at the 85 threshold exactly', () => {
    const entry = makeEntry({ final_score: 85 });
    const bullets = generateTopPickInsights(entry, makeCtx());
    expect(bullets).toContainEqual({ kind: 'quality_tier', text: 'Top-tier ingredient quality' });
  });

  it('omits when final_score is 84', () => {
    const entry = makeEntry({ final_score: 84 });
    const bullets = generateTopPickInsights(entry, makeCtx());
    expect(bullets.find((b) => b.kind === 'quality_tier')).toBeUndefined();
  });
});

describe('generateTopPickInsights — priority ordering + cap', () => {
  it('caps at 3 bullets in fixed priority order when all checks match', () => {
    const entry = makeEntry({
      final_score: 90,
      preservative_type: 'natural',
      life_stage_claim: 'Adult Maintenance',
      ga_fat_pct: 2.2,
      ga_moisture_pct: 78,
      top_ingredients: [{ position: 1, canonical_name: 'fish', allergen_group: 'fish' }],
    });
    const ctx = makeCtx({ allergens: ['chicken'], lifeStage: 'adult', weightGoalLevel: -2 });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toHaveLength(3);
    expect(bullets.map((b) => b.kind)).toEqual(['allergen_safe', 'life_stage', 'macro_fat']);
  });

  it('slots in lower-priority bullets when higher ones are absent', () => {
    const entry = makeEntry({
      final_score: 90,
      preservative_type: 'natural',
    });
    const bullets = generateTopPickInsights(entry, makeCtx());
    expect(bullets.map((b) => b.kind)).toEqual(['preservative', 'quality_tier']);
  });
});

describe('generateTopPickInsights — UPVM blocklist sweep', () => {
  const BLOCKLIST = /\b(prescribe|treat|cure|prevent|diagnose|heal|remedy|support|improve|good for|helps with|manages?|reduces|eliminates)\b/i;

  const fixtures = [
    { entry: makeEntry({ preservative_type: 'natural', final_score: 90 }), ctx: makeCtx() },
    { entry: makeEntry({ ga_protein_pct: 9, ga_moisture_pct: 78 }), ctx: makeCtx({ weightGoalLevel: -2 }) },
    { entry: makeEntry({ life_stage_claim: 'All Life Stages' }), ctx: makeCtx({ lifeStage: 'puppy' }) },
    {
      entry: makeEntry({
        top_ingredients: [{ position: 1, canonical_name: 'fish', allergen_group: 'fish' }],
      }),
      ctx: makeCtx({ allergens: ['chicken', 'beef', 'dairy'] }),
    },
  ];

  it.each(fixtures)('emitted bullets contain no UPVM blocklist terms', ({ entry, ctx }) => {
    const bullets = generateTopPickInsights(entry, ctx);
    for (const b of bullets) {
      expect(b.text).not.toMatch(BLOCKLIST);
    }
  });
});

describe('generateTopPickInsights — empty data tolerance', () => {
  it('returns empty array for bare entry + default context', () => {
    const bullets = generateTopPickInsights(makeEntry(), makeCtx());
    expect(bullets).toEqual([]);
  });

  it('does not throw when top_ingredients is undefined (backend regression guard)', () => {
    // @ts-expect-error — intentional: simulate malformed data
    const entry = makeEntry({ top_ingredients: undefined });
    expect(() => generateTopPickInsights(entry, makeCtx({ allergens: ['chicken'] }))).not.toThrow();
  });

  it('does not emit UPVM-risky bullets for a supplement/topper edge case', () => {
    const entry = makeEntry({ is_supplemental: true, final_score: 90, preservative_type: 'natural' });
    const bullets = generateTopPickInsights(entry, makeCtx({ weightGoalLevel: -2, activityLevel: 'working' }));
    // No macro bullet (skipped for toppers), but preservative + quality_tier are valid
    expect(bullets.map((b) => b.kind)).toEqual(['preservative', 'quality_tier']);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npx jest __tests__/services/topPickInsights.test.ts`
Expected: FAIL on preservative + quality_tier + priority/cap + UPVM fixtures (checks don't exist yet).

- [ ] **Step 3: Implement remaining checks**

Add to `src/services/topPickInsights.ts`, below `checkMacroProtein`:

```ts
function checkPreservative(entry: TopPickEntry): InsightBullet | null {
  if (entry.preservative_type !== 'natural') return null;
  return { kind: 'preservative', text: 'Natural preservatives only' };
}

const QUALITY_TIER_THRESHOLD = 85;

function checkQualityTier(entry: TopPickEntry): InsightBullet | null {
  if (entry.final_score == null) return null;
  if (entry.final_score < QUALITY_TIER_THRESHOLD) return null;
  return { kind: 'quality_tier', text: 'Top-tier ingredient quality' };
}
```

Update `generateTopPickInsights` to include them. Final form:

```ts
export function generateTopPickInsights(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet[] {
  const bullets: InsightBullet[] = [];

  const allergen = checkAllergenSafe(entry, ctx);
  if (allergen) bullets.push(allergen);

  const lifeStage = checkLifeStageMatch(entry, ctx);
  if (lifeStage) bullets.push(lifeStage);

  const macroFat = checkMacroFat(entry, ctx);
  if (macroFat) {
    bullets.push(macroFat);
  } else {
    const macroProtein = checkMacroProtein(entry, ctx);
    if (macroProtein) bullets.push(macroProtein);
  }

  const preservative = checkPreservative(entry);
  if (preservative) bullets.push(preservative);

  const qualityTier = checkQualityTier(entry);
  if (qualityTier) bullets.push(qualityTier);

  return bullets.slice(0, MAX_BULLETS);
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx jest __tests__/services/topPickInsights.test.ts`
Expected: PASS — all tests green across allergen + life_stage + macro + preservative + quality_tier + priority + UPVM + empty-tolerance suites.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — no new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/topPickInsights.ts __tests__/services/topPickInsights.test.ts
git commit -m "$(cat <<'EOF'
M9: topPickInsights — preservative, quality_tier, priority cap, UPVM sweep

"Natural preservatives only" when preservative_type=natural.
"Top-tier ingredient quality" at final_score >= 85.
Fixed priority order (allergen_safe > life_stage > macro > preservative >
quality_tier) with cap at 3 bullets. UPVM blocklist sweep fixture asserts
emitted text never matches medical-claim terms. Empty-data tolerance tests.

Insight helper complete — 24+ unit tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `fetchCategoryTopPicks` real implementation

**Files:**
- Modify: `src/services/categoryBrowseService.ts`
- Modify: `__tests__/services/categoryBrowseService.test.ts` (extend or create)

- [ ] **Step 1: Check for existing test file + sample pattern**

Run: `ls __tests__/services/categoryBrowseService.test.ts 2>/dev/null || echo "MISSING"`

If MISSING, create a minimal test file. Otherwise extend it.

- [ ] **Step 2: Write failing tests**

Append to (or create) `__tests__/services/categoryBrowseService.test.ts`:

```ts
import { fetchCategoryTopPicks } from '../../src/services/categoryBrowseService';
import { supabase } from '../../src/services/supabase';

jest.mock('../../src/services/supabase');

describe('fetchCategoryTopPicks', () => {
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('returns TopPickEntry[] with joined macros + AAFCO + preservative + top_ingredients', async () => {
    const scoredRows = [
      {
        product_id: 'p1',
        final_score: 90,
        is_supplemental: false,
        category: 'daily_food',
        products: {
          name: 'Premium Kibble',
          brand: 'BrandA',
          image_url: 'https://example.com/a.jpg',
          product_form: 'dry',
          is_vet_diet: false,
          is_recalled: false,
          target_species: 'dog',
          is_supplemental: false,
          is_variety_pack: false,
          needs_review: false,
          ga_protein_pct: 28,
          ga_fat_pct: 16,
          ga_moisture_pct: 10,
          ga_protein_dmb_pct: null,
          ga_fat_dmb_pct: null,
          preservative_type: 'natural',
          aafco_statement: 'Adult Maintenance',
          life_stage_claim: 'Adult Maintenance',
        },
      },
    ];

    const ingredientRows = [
      { product_id: 'p1', position: 1, canonical_name: 'chicken', ingredients_dict: { allergen_group: 'chicken' } },
      { product_id: 'p1', position: 2, canonical_name: 'brown_rice', ingredients_dict: { allergen_group: null } },
    ];

    // First call: pet_product_scores
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: scoredRows, error: null }),
            }),
          }),
        }),
      }),
    });

    // Second call: product_ingredients
    mockFrom.mockReturnValueOnce({
      select: () => ({
        in: () => ({
          lte: () => ({
            order: () => Promise.resolve({ data: ingredientRows, error: null }),
          }),
        }),
      }),
    });

    const result = await fetchCategoryTopPicks('pet-1', 'daily_food', null, 'dog', 20);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      product_id: 'p1',
      product_name: 'Premium Kibble',
      brand: 'BrandA',
      final_score: 90,
      ga_protein_pct: 28,
      ga_fat_pct: 16,
      preservative_type: 'natural',
      life_stage_claim: 'Adult Maintenance',
      top_ingredients: [
        { position: 1, canonical_name: 'chicken', allergen_group: 'chicken' },
        { position: 2, canonical_name: 'brown_rice', allergen_group: null },
      ],
    });
  });

  it('returns empty array when pet_product_scores query errors', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
            }),
          }),
        }),
      }),
    });

    const result = await fetchCategoryTopPicks('pet-1', 'daily_food', null, 'dog', 20);
    expect(result).toEqual([]);
  });

  it('excludes vet_diet / recalled / variety_pack / needs_review / species-mismatch products', async () => {
    const scoredRows = [
      {
        product_id: 'p1', final_score: 90, is_supplemental: false, category: 'daily_food',
        products: { name: 'vet diet', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: true, is_recalled: false, target_species: 'dog',
          is_supplemental: false, is_variety_pack: false, needs_review: false,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
      {
        product_id: 'p2', final_score: 85, is_supplemental: false, category: 'daily_food',
        products: { name: 'recalled', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: false, is_recalled: true, target_species: 'dog',
          is_supplemental: false, is_variety_pack: false, needs_review: false,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
      {
        product_id: 'p3', final_score: 80, is_supplemental: false, category: 'daily_food',
        products: { name: 'variety', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: false, is_recalled: false, target_species: 'dog',
          is_supplemental: false, is_variety_pack: true, needs_review: false,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
      {
        product_id: 'p4', final_score: 75, is_supplemental: false, category: 'daily_food',
        products: { name: 'needs review', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: false, is_recalled: false, target_species: 'dog',
          is_supplemental: false, is_variety_pack: false, needs_review: true,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
      {
        product_id: 'p5', final_score: 70, is_supplemental: false, category: 'daily_food',
        products: { name: 'cat food', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: false, is_recalled: false, target_species: 'cat',
          is_supplemental: false, is_variety_pack: false, needs_review: false,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
    ];

    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: scoredRows, error: null }),
            }),
          }),
        }),
      }),
    });
    // No 2nd call because no rows survive filtering
    const result = await fetchCategoryTopPicks('pet-1', 'daily_food', null, 'dog', 20);
    expect(result).toEqual([]);
  });

  it('returns [] for supplement category (defensive — caller should route elsewhere)', async () => {
    const result = await fetchCategoryTopPicks('pet-1', 'supplement', null, 'dog', 20);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests — expect failure**

Run: `npx jest __tests__/services/categoryBrowseService.test.ts`
Expected: FAIL — current stub returns `fetchBrowseResults` with narrower shape; new tests expect `TopPickEntry` fields and a 2-query composition.

- [ ] **Step 4: Replace `fetchCategoryTopPicks` implementation**

In `src/services/categoryBrowseService.ts`:

- Add imports at top (add `TopPickEntry` to existing type import):

```ts
import type {
  BrowseCategory,
  BrowseProduct,
  BrowsePage,
  BrowseCounts,
  TopPickEntry,
} from '../types/categoryBrowse';
```

- Replace the existing `fetchCategoryTopPicks` function (at bottom of file) with:

```ts
/**
 * Fetches the top N scored products for a category + optional sub-filter,
 * enriched with insight-source fields (macros, AAFCO, preservative,
 * top-10 ingredient preview). One-shot — no pagination.
 *
 * Supplements return [] (caller should route to CategoryBrowseScreen instead).
 * Inherits bypass filters from fetchScoredResults: vet_diet, recalled,
 * variety_pack, needs_review, species mismatch.
 */
export async function fetchCategoryTopPicks(
  petId: string,
  category: BrowseCategory,
  subFilterKey: string | null,
  species: 'dog' | 'cat',
  limit: number = 20,
): Promise<TopPickEntry[]> {
  if (category === 'supplement') return [];

  const dbCategory: 'daily_food' | 'treat' =
    category === 'treat' ? 'treat' : 'daily_food';
  const isSupplemental: boolean | null =
    category === 'toppers_mixers' ? true : category === 'daily_food' ? false : null;

  // Resolve product_form filter from sub-filter (same mapping as fetchScoredResults)
  let productFormFilter: string | null = null;
  if (category === 'daily_food' || category === 'toppers_mixers') {
    const formMap: Record<string, string> = { dry: 'dry', wet: 'wet', freeze_dried: 'freeze_dried', other: 'other' };
    productFormFilter = subFilterKey ? formMap[subFilterKey] ?? null : null;
  } else if (category === 'treat' && subFilterKey === 'freeze_dried') {
    productFormFilter = 'freeze_dried';
  }

  // Treat name patterns for treats + other sub-filters
  let namePatterns: string[] | null = null;
  if (category === 'treat' && subFilterKey && subFilterKey !== 'freeze_dried') {
    namePatterns = TREAT_NAME_PATTERNS[subFilterKey] ?? null;
  }

  // ── Query 1: pet_product_scores !inner products with expanded SELECT ──
  let q = supabase
    .from('pet_product_scores')
    .select(`
      product_id, final_score, is_supplemental, category,
      products!inner(
        name, brand, image_url, product_form, is_vet_diet, is_recalled,
        target_species, is_supplemental, is_variety_pack, needs_review,
        ga_protein_pct, ga_fat_pct, ga_moisture_pct,
        ga_protein_dmb_pct, ga_fat_dmb_pct,
        preservative_type, aafco_statement, life_stage_claim
      )
    `)
    .eq('pet_id', petId)
    .eq('category', dbCategory)
    .order('final_score', { ascending: false });

  if (isSupplemental !== null) {
    q = q.eq('is_supplemental', isSupplemental);
  }

  // Overfetch 3x to survive post-query filters (vet_diet, variety_pack, etc.)
  const fetchLimit = (productFormFilter || namePatterns) ? limit * 10 : limit * 3;
  q = q.limit(fetchLimit);

  const { data, error } = await q;
  if (error || !data) return [];

  // ── Post-query filtering ──
  const filtered: TopPickEntry[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const p = row.products as Record<string, unknown> | null;
    if (!p) continue;
    if (p.is_vet_diet) continue;
    if (p.is_recalled) continue;
    if (p.is_variety_pack) continue;
    if (p.needs_review) continue;
    if (p.target_species !== species) continue;

    if (productFormFilter) {
      const form = p.product_form as string | null;
      if (productFormFilter === 'other') {
        if (form && ['dry', 'wet', 'freeze_dried', 'freeze-dried'].includes(form)) continue;
      } else if (productFormFilter === 'freeze_dried') {
        if (form !== 'freeze_dried' && form !== 'freeze-dried') continue;
      } else if (form !== productFormFilter) {
        continue;
      }
    }

    if (namePatterns) {
      const nameLower = ((p.name as string) ?? '').toLowerCase();
      const matches = namePatterns.some((pat) =>
        nameLower.includes(pat.replace(/%/g, '').toLowerCase()),
      );
      if (!matches) continue;
    }

    filtered.push({
      product_id: row.product_id as string,
      product_name: (p.name as string) ?? '',
      brand: (p.brand as string) ?? '',
      image_url: (p.image_url as string) ?? null,
      product_form: (p.product_form as string) ?? null,
      final_score: row.final_score as number,
      is_supplemental: (row.is_supplemental as boolean) ?? false,
      is_vet_diet: false,
      ga_protein_pct: (p.ga_protein_pct as number) ?? null,
      ga_fat_pct: (p.ga_fat_pct as number) ?? null,
      ga_moisture_pct: (p.ga_moisture_pct as number) ?? null,
      ga_protein_dmb_pct: (p.ga_protein_dmb_pct as number) ?? null,
      ga_fat_dmb_pct: (p.ga_fat_dmb_pct as number) ?? null,
      preservative_type: (p.preservative_type as TopPickEntry['preservative_type']) ?? null,
      aafco_statement: (p.aafco_statement as string) ?? null,
      life_stage_claim: (p.life_stage_claim as string) ?? null,
      top_ingredients: [],
    });

    if (filtered.length >= limit) break;
  }

  if (filtered.length === 0) return [];

  // ── Query 2: ingredient preview (top 10 per product, allergen_group) ──
  const productIds = filtered.map((e) => e.product_id);
  const { data: ingData } = await supabase
    .from('product_ingredients')
    .select('product_id, position, canonical_name, ingredients_dict!inner(allergen_group)')
    .in('product_id', productIds)
    .lte('position', 10)
    .order('position', { ascending: true });

  if (ingData) {
    for (const row of ingData as Record<string, unknown>[]) {
      const pid = row.product_id as string;
      const target = filtered.find((e) => e.product_id === pid);
      if (!target) continue;
      const dict = row.ingredients_dict as { allergen_group: string | null } | null;
      target.top_ingredients.push({
        position: row.position as number,
        canonical_name: (row.canonical_name as string) ?? '',
        allergen_group: dict?.allergen_group ?? null,
      });
    }
  }

  return filtered;
}
```

- [ ] **Step 5: Run tests — expect pass**

Run: `npx jest __tests__/services/categoryBrowseService.test.ts`
Expected: PASS — 4 tests for `fetchCategoryTopPicks`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/categoryBrowseService.ts __tests__/services/categoryBrowseService.test.ts
git commit -m "$(cat <<'EOF'
M9: fetchCategoryTopPicks — real implementation

Replaces the stub with a 2-query composition:
1. pet_product_scores !inner products with expanded SELECT (macros, AAFCO,
   preservative, life_stage_claim).
2. product_ingredients !inner ingredients_dict for top-10 allergen preview
   on the surviving IDs.

Inherits bypass filters (vet_diet / recalled / variety_pack / needs_review /
species mismatch). Returns [] for supplement category (caller routes
elsewhere). 4 unit tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Navigation scaffolding + placeholder screen

**Files:**
- Modify: `src/types/navigation.ts`
- Create: `src/screens/CategoryTopPicksScreen.tsx` (placeholder)
- Modify: `src/navigation/index.tsx`

- [ ] **Step 1: Add route to `HomeStackParamList`**

In `src/types/navigation.ts`, add `CategoryTopPicks` to `HomeStackParamList`:

```ts
export type HomeStackParamList = {
  HomeMain: undefined;
  CategoryBrowse: { category: import('./categoryBrowse').BrowseCategory; petId: string; subFilter?: string };
  CategoryTopPicks: { category: import('./categoryBrowse').BrowseCategory; petId: string; subFilter?: string };
  Result: { productId: string; petId: string | null; pantryItemIdHint?: string };
  RecallDetail: { productId: string };
  AppointmentDetail: { appointmentId: string };
  Compare: { productAId: string; productBId: string; petId: string };
  SafeSwitchDetail: { switchId: string };
};
```

- [ ] **Step 2: Create placeholder screen**

Create `src/screens/CategoryTopPicksScreen.tsx`:

```ts
// Kiba — Category Top Picks Screen
// Showcase "top 20" experience for {category, petId, subFilter}. Hero + Leaderboard + Escape Hatch.
// D-094: suitability framing. D-095: UPVM compliance. D-096: supplements routed elsewhere.
// Spec: docs/superpowers/specs/2026-04-15-top-picks-dedicated-screen-design.md

import React, { useEffect } from 'react';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canSearch } from '../utils/permissions';
import type { HomeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'CategoryTopPicks'>;

export default function CategoryTopPicksScreen({ navigation, route }: Props) {
  const { category, petId, subFilter } = route.params;

  useEffect(() => {
    if (!canSearch()) navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.placeholder}>
        Top Picks — {category}
        {subFilter ? ` / ${subFilter}` : ''}
        {'\n'}pet: {petId}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  placeholder: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
  },
});
```

- [ ] **Step 3: Register screen in navigation**

In `src/navigation/index.tsx`, add import with the other screen imports (near `CategoryBrowseScreen`):

```ts
import CategoryTopPicksScreen from '../screens/CategoryTopPicksScreen';
```

Then add the screen inside `HomeStackScreen`'s `<HomeStack.Navigator>` (after `CategoryBrowse`, before `Result`):

```tsx
<HomeStack.Screen name="CategoryTopPicks" component={CategoryTopPicksScreen} />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/navigation.ts src/screens/CategoryTopPicksScreen.tsx src/navigation/index.tsx
git commit -m "$(cat <<'EOF'
M9: navigation scaffolding for CategoryTopPicks

New route on HomeStackParamList + placeholder screen + nav registration.
Screen content wired in subsequent commits.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `TopPickRankRow` component (render test)

**Files:**
- Create: `src/components/browse/TopPickRankRow.tsx`
- Create: `__tests__/components/browse/TopPickRankRow.test.tsx`

- [ ] **Step 1: Write failing render test**

Create `__tests__/components/browse/TopPickRankRow.test.tsx`:

```ts
// Render tests — mirror mocks pattern from FeedingIntentSheet.test.tsx.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TopPickRankRow } from '../../../src/components/browse/TopPickRankRow';
import type { TopPickEntry, InsightBullet } from '../../../src/types/categoryBrowse';

const entry: TopPickEntry = {
  product_id: 'p-42',
  product_name: 'Salmon Recipe',
  brand: 'Test Brand',
  image_url: null,
  product_form: 'dry',
  final_score: 88,
  is_supplemental: false,
  is_vet_diet: false,
  ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
  ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
  preservative_type: null, aafco_statement: null, life_stage_claim: null,
  top_ingredients: [],
};

const insight: InsightBullet = { kind: 'allergen_safe', text: 'Free of chicken' };

describe('TopPickRankRow', () => {
  it('renders rank, brand, name, score, and insight text', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <TopPickRankRow pick={entry} rank={2} insight={insight} onPress={onPress} />,
    );
    expect(getByText('#2')).toBeTruthy();
    expect(getByText('Test Brand')).toBeTruthy();
    expect(getByText('Salmon Recipe')).toBeTruthy();
    expect(getByText('88%')).toBeTruthy();
    expect(getByText('Free of chicken')).toBeTruthy();
  });

  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <TopPickRankRow pick={entry} rank={2} insight={insight} onPress={onPress} />,
    );
    fireEvent.press(getByLabelText(/Salmon Recipe/i));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without an insight row when insight is null', () => {
    const { queryByText } = render(
      <TopPickRankRow pick={entry} rank={3} insight={null} onPress={() => {}} />,
    );
    expect(queryByText('Free of chicken')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npx jest __tests__/components/browse/TopPickRankRow.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Build the component**

Create `src/components/browse/TopPickRankRow.tsx`:

```ts
// TopPickRankRow — Leaderboard row (#2-#20) for CategoryTopPicksScreen.
// Prominent rank badge + product image + brand/name + single insight + score pill.
// Matte Premium card anatomy. D-094: "X% match" framing (score pill).

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../../utils/formatters';
import type { TopPickEntry, InsightBullet } from '../../types/categoryBrowse';

interface TopPickRankRowProps {
  pick: TopPickEntry;
  rank: number;
  insight: InsightBullet | null;
  onPress: () => void;
}

export function TopPickRankRow({ pick, rank, insight, onPress }: TopPickRankRowProps) {
  const scoreColor = pick.final_score != null
    ? getScoreColor(pick.final_score, pick.is_supplemental)
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${pick.product_name}, rank ${rank}`}
    >
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>

      <View style={styles.imageStage}>
        {pick.image_url ? (
          <Image source={{ uri: pick.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="cube-outline" size={22} color={Colors.textTertiary} />
          </View>
        )}
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.brand} numberOfLines={1}>{sanitizeBrand(pick.brand)}</Text>
        <Text style={styles.name} numberOfLines={2}>{stripBrandFromName(pick.brand, pick.product_name)}</Text>
        {insight && (
          <View style={styles.insightRow}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.accent} />
            <Text style={styles.insightText} numberOfLines={1}>{insight.text}</Text>
          </View>
        )}
      </View>

      {pick.final_score != null && scoreColor && (
        <View style={[styles.scorePill, { backgroundColor: `${scoreColor}1A` }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{pick.final_score}%</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  rankBadge: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  imageStage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  imagePlaceholder: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  brand: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  insightText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  scorePill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
});
```

- [ ] **Step 4: Run test — expect pass**

Run: `npx jest __tests__/components/browse/TopPickRankRow.test.tsx`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/browse/TopPickRankRow.tsx __tests__/components/browse/TopPickRankRow.test.tsx
git commit -m "$(cat <<'EOF'
M9: TopPickRankRow component — leaderboard row

Matte Premium card anatomy. Rank badge (#N), product image, brand + name,
single insight, score pill. 3 render tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `TopPickHeroCard` component (render test)

**Files:**
- Create: `src/components/browse/TopPickHeroCard.tsx`
- Create: `__tests__/components/browse/TopPickHeroCard.test.tsx`

- [ ] **Step 1: Confirm ScoreRing import path**

Run: `grep -l "export.*ScoreRing" src/components/scoring/`
Expected: `src/components/scoring/ScoreRing.tsx`.

Note the import shape — inspect a caller for the exact API, e.g., `grep -n "import.*ScoreRing" src/screens/ResultScreen.tsx`.

- [ ] **Step 2: Write failing render test**

Create `__tests__/components/browse/TopPickHeroCard.test.tsx`:

```ts
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-svg', () => ({
  Svg: 'Svg', Circle: 'Circle', Path: 'Path', G: 'G',
  Defs: 'Defs', LinearGradient: 'LinearGradient', Stop: 'Stop',
  Text: 'Text', TSpan: 'TSpan',
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TopPickHeroCard } from '../../../src/components/browse/TopPickHeroCard';
import type { TopPickEntry, InsightBullet } from '../../../src/types/categoryBrowse';

const entry: TopPickEntry = {
  product_id: 'p-42',
  product_name: 'Salmon Recipe',
  brand: 'Test Brand',
  image_url: null,
  product_form: 'dry',
  final_score: 93,
  is_supplemental: false,
  is_vet_diet: false,
  ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
  ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
  preservative_type: null, aafco_statement: null, life_stage_claim: null,
  top_ingredients: [],
};

const insights: InsightBullet[] = [
  { kind: 'allergen_safe', text: 'Free of chicken' },
  { kind: 'life_stage', text: 'AAFCO Adult Maintenance' },
  { kind: 'quality_tier', text: 'Top-tier ingredient quality' },
];

describe('TopPickHeroCard', () => {
  it('renders brand, name, "Best overall match for {Pet}" badge, and all 3 insights', () => {
    const { getByText } = render(
      <TopPickHeroCard pick={entry} petName="Troy" insights={insights} onPress={() => {}} />,
    );
    expect(getByText('Test Brand')).toBeTruthy();
    expect(getByText('Salmon Recipe')).toBeTruthy();
    expect(getByText(/Best overall match for Troy/i)).toBeTruthy();
    expect(getByText('Free of chicken')).toBeTruthy();
    expect(getByText('AAFCO Adult Maintenance')).toBeTruthy();
    expect(getByText('Top-tier ingredient quality')).toBeTruthy();
  });

  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <TopPickHeroCard pick={entry} petName="Troy" insights={insights} onPress={onPress} />,
    );
    fireEvent.press(getByLabelText(/Salmon Recipe/i));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test — expect failure**

Run: `npx jest __tests__/components/browse/TopPickHeroCard.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Build the component**

Create `src/components/browse/TopPickHeroCard.tsx`:

```ts
// TopPickHeroCard — Crown Jewel for CategoryTopPicksScreen.
// Featured Action Card anatomy — cardSurface bg, accent-tint border, ScoreRing,
// "Best overall match for {Pet}" badge, up to 3 insight bullets.
// D-094: suitability framing. D-095: UPVM compliance.

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../../utils/formatters';
import { ScoreRing } from '../scoring/ScoreRing';
import type { TopPickEntry, InsightBullet } from '../../types/categoryBrowse';

interface TopPickHeroCardProps {
  pick: TopPickEntry;
  petName: string;
  insights: InsightBullet[];
  onPress: () => void;
}

export function TopPickHeroCard({ pick, petName, insights, onPress }: TopPickHeroCardProps) {
  const scoreColor = pick.final_score != null
    ? getScoreColor(pick.final_score, pick.is_supplemental)
    : Colors.textTertiary;

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: scoreColor }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${pick.product_name}, best overall match`}
    >
      <View style={styles.accentBadge}>
        <Ionicons name="trophy" size={14} color={scoreColor} />
        <Text style={[styles.accentBadgeText, { color: scoreColor }]}>
          Best overall match for {petName}
        </Text>
      </View>

      <View style={styles.topRow}>
        <View style={styles.imageStage}>
          {pick.image_url ? (
            <Image source={{ uri: pick.image_url }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="cube-outline" size={40} color={Colors.textTertiary} />
            </View>
          )}
        </View>

        <View style={styles.ringWrap}>
          {pick.final_score != null && (
            <ScoreRing
              score={pick.final_score}
              isSupplemental={pick.is_supplemental}
              size={92}
            />
          )}
        </View>
      </View>

      <Text style={styles.brand} numberOfLines={1}>{sanitizeBrand(pick.brand)}</Text>
      <Text style={styles.name} numberOfLines={2}>{stripBrandFromName(pick.brand, pick.product_name)}</Text>

      {insights.length > 0 && (
        <View style={styles.insightsList}>
          {insights.slice(0, 3).map((b) => (
            <View key={b.kind} style={styles.insightRow}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
              <Text style={styles.insightText}>{b.text}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 2,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  accentBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.chipSurface,
    borderRadius: 12,
  },
  accentBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  imageStage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  imagePlaceholder: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  ringWrap: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  insightsList: {
    gap: 6,
    marginTop: 4,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
});
```

- [ ] **Step 5: Run test — expect pass**

Run: `npx jest __tests__/components/browse/TopPickHeroCard.test.tsx`
Expected: PASS — 2 tests green. If `ScoreRing` import path is different, adjust import and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/components/browse/TopPickHeroCard.tsx __tests__/components/browse/TopPickHeroCard.test.tsx
git commit -m "$(cat <<'EOF'
M9: TopPickHeroCard component — Crown Jewel for Top Picks screen

Featured Action Card anatomy with accent-tint border. 360° ScoreRing,
white-stage product image, "Best overall match for {Pet}" trophy badge,
up to 3 insight bullets. 2 render tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `resolveSeeAllDestination` helper + TopPicksCarousel branching

**Files:**
- Modify: `src/components/browse/TopPicksCarousel.tsx`
- Create: `__tests__/components/browse/topPicksCarouselHelpers.test.ts`

- [ ] **Step 1: Write failing test for the pure helper**

Create `__tests__/components/browse/topPicksCarouselHelpers.test.ts`:

```ts
import { resolveSeeAllDestination } from '../../../src/components/browse/topPicksCarouselHelpers';

describe('resolveSeeAllDestination', () => {
  it('routes supplement to CategoryBrowse (unscored)', () => {
    expect(resolveSeeAllDestination('supplement')).toBe('CategoryBrowse');
  });

  it('routes daily_food to CategoryTopPicks', () => {
    expect(resolveSeeAllDestination('daily_food')).toBe('CategoryTopPicks');
  });

  it('routes toppers_mixers to CategoryTopPicks', () => {
    expect(resolveSeeAllDestination('toppers_mixers')).toBe('CategoryTopPicks');
  });

  it('routes treat to CategoryTopPicks', () => {
    expect(resolveSeeAllDestination('treat')).toBe('CategoryTopPicks');
  });

  it('defaults to CategoryTopPicks for null (active category fallback)', () => {
    expect(resolveSeeAllDestination(null)).toBe('CategoryTopPicks');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npx jest __tests__/components/browse/topPicksCarouselHelpers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the helper**

Create `src/components/browse/topPicksCarouselHelpers.ts`:

```ts
import type { BrowseCategory } from '../../types/categoryBrowse';

/** Routes See All tap to the right destination — supplements skip Top Picks. */
export function resolveSeeAllDestination(
  category: BrowseCategory | null,
): 'CategoryTopPicks' | 'CategoryBrowse' {
  if (category === 'supplement') return 'CategoryBrowse';
  return 'CategoryTopPicks';
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npx jest __tests__/components/browse/topPicksCarouselHelpers.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Wire the helper into `TopPicksCarousel`**

In `src/components/browse/TopPicksCarousel.tsx`, update the imports to include the new helper:

```ts
import { resolveSeeAllDestination } from './topPicksCarouselHelpers';
```

Replace `handleSeeAll` (currently at line 117-123) with:

```ts
const handleSeeAll = useCallback(() => {
  const category = activeCategory ?? 'daily_food';
  const destination = resolveSeeAllDestination(category);
  navigation.navigate(destination, {
    category,
    petId,
    subFilter: activeSubFilter ?? undefined,
  });
}, [navigation, activeCategory, activeSubFilter, petId]);
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/browse/topPicksCarouselHelpers.ts src/components/browse/TopPicksCarousel.tsx __tests__/components/browse/topPicksCarouselHelpers.test.ts
git commit -m "$(cat <<'EOF'
M9: TopPicksCarousel See All routes to CategoryTopPicks (except supplements)

New pure helper resolveSeeAllDestination(): supplements stay on the flat
CategoryBrowseScreen (alphabetical, unscored per D-096); everything else
routes to the new CategoryTopPicks screen. 5 unit tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `CategoryTopPicksScreen` full wiring

**Files:**
- Modify: `src/screens/CategoryTopPicksScreen.tsx`
- Create: `src/screens/categoryTopPicksHelpers.ts` (pure helpers)
- Create: `__tests__/screens/categoryTopPicksHelpers.test.ts`

- [ ] **Step 1: Write failing tests for title + label helpers**

Create `__tests__/screens/categoryTopPicksHelpers.test.ts`:

```ts
import { getTopPicksTitle, getCategoryTitle, getFilterLabel } from '../../src/screens/categoryTopPicksHelpers';

describe('getCategoryTitle', () => {
  it('maps categories', () => {
    expect(getCategoryTitle('daily_food')).toBe('Daily Food');
    expect(getCategoryTitle('toppers_mixers')).toBe('Toppers & Mixers');
    expect(getCategoryTitle('treat')).toBe('Treats');
    expect(getCategoryTitle('supplement')).toBe('Supplements');
  });
});

describe('getFilterLabel', () => {
  it('returns sub-filter label if found', () => {
    expect(getFilterLabel('daily_food', 'dry')).toBe('Dry');
    expect(getFilterLabel('daily_food', 'freeze_dried')).toBe('Freeze-Dried');
    expect(getFilterLabel('treat', 'jerky_chews')).toBe('Jerky & Chews');
    expect(getFilterLabel('toppers_mixers', 'wet')).toBe('Wet');
  });
  it('returns null for unknown filter', () => {
    expect(getFilterLabel('daily_food', 'nonsense')).toBeNull();
    expect(getFilterLabel('daily_food', null)).toBeNull();
  });
});

describe('getTopPicksTitle', () => {
  it('uses category title when no sub-filter', () => {
    expect(getTopPicksTitle('daily_food', null, 'Troy')).toBe('Top Daily Food for Troy');
    expect(getTopPicksTitle('treat', null, 'Troy')).toBe('Top Treats for Troy');
  });
  it('uses sub-filter + "Food" suffix for daily_food', () => {
    expect(getTopPicksTitle('daily_food', 'dry', 'Troy')).toBe('Top Dry Food for Troy');
    expect(getTopPicksTitle('daily_food', 'freeze_dried', 'Troy')).toBe('Top Freeze-Dried Food for Troy');
  });
  it('uses "Wet Toppers" pattern for toppers_mixers', () => {
    expect(getTopPicksTitle('toppers_mixers', 'wet', 'Troy')).toBe('Top Wet Toppers for Troy');
  });
  it('uses sub-filter label directly for treats', () => {
    expect(getTopPicksTitle('treat', 'jerky_chews', 'Troy')).toBe('Top Jerky & Chews for Troy');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npx jest __tests__/screens/categoryTopPicksHelpers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the helpers**

Create `src/screens/categoryTopPicksHelpers.ts`:

```ts
// Pure helpers for CategoryTopPicksScreen — title + label resolution.
// Extracted for unit testability (keep screen file lean).

import { SUB_FILTERS } from '../types/categoryBrowse';
import type { BrowseCategory } from '../types/categoryBrowse';

export function getCategoryTitle(category: BrowseCategory): string {
  switch (category) {
    case 'daily_food': return 'Daily Food';
    case 'toppers_mixers': return 'Toppers & Mixers';
    case 'treat': return 'Treats';
    case 'supplement': return 'Supplements';
  }
}

export function getFilterLabel(
  category: BrowseCategory,
  subFilterKey: string | null,
): string | null {
  if (!subFilterKey) return null;
  const def = SUB_FILTERS[category].find((f) => f.key === subFilterKey);
  return def?.label ?? null;
}

export function getTopPicksTitle(
  category: BrowseCategory,
  subFilterKey: string | null,
  petName: string,
): string {
  const filterLabel = getFilterLabel(category, subFilterKey);
  if (!filterLabel) {
    return `Top ${getCategoryTitle(category)} for ${petName}`;
  }
  if (category === 'daily_food') {
    return `Top ${filterLabel} Food for ${petName}`;
  }
  if (category === 'toppers_mixers') {
    return `Top ${filterLabel} Toppers for ${petName}`;
  }
  // treats / supplements — sub-filter already reads as a full noun phrase
  return `Top ${filterLabel} for ${petName}`;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx jest __tests__/screens/categoryTopPicksHelpers.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Replace the placeholder screen with full implementation**

Replace contents of `src/screens/CategoryTopPicksScreen.tsx` with:

```ts
// Kiba — Category Top Picks Screen
// Showcase "top 20" experience for {category, petId, subFilter}. Hero + Leaderboard + Escape Hatch.
// Spec: docs/superpowers/specs/2026-04-15-top-picks-dedicated-screen-design.md
// D-094: suitability framing. D-095: UPVM compliance. D-096: supplements routed elsewhere.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, SafeAreaView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canSearch } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { fetchCategoryTopPicks } from '../services/categoryBrowseService';
import { getPetAllergens } from '../services/petService';
import { generateTopPickInsights, type InsightContext } from '../services/topPickInsights';
import { TopPickHeroCard } from '../components/browse/TopPickHeroCard';
import { TopPickRankRow } from '../components/browse/TopPickRankRow';
import { getTopPicksTitle, getCategoryTitle, getFilterLabel } from './categoryTopPicksHelpers';
import type { HomeStackParamList } from '../types/navigation';
import type { TopPickEntry, InsightBullet } from '../types/categoryBrowse';

type Props = NativeStackScreenProps<HomeStackParamList, 'CategoryTopPicks'>;

const HEALTHY_THRESHOLD = 10;

export default function CategoryTopPicksScreen({ navigation, route }: Props) {
  const { category, petId, subFilter } = route.params;
  const pets = useActivePetStore((s) => s.pets);
  const pet = pets.find((p) => p.id === petId);
  const species = pet?.species ?? 'dog';
  const petName = pet?.name ?? 'your pet';

  const [picks, setPicks] = useState<TopPickEntry[]>([]);
  const [insightsMap, setInsightsMap] = useState<Record<string, InsightBullet[]>>({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Paywall gate
  useEffect(() => {
    if (!canSearch()) navigation.goBack();
  }, [navigation]);

  // Hide tab bar on focus (matches CompareScreen pattern)
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  // Fetch picks + compute insights
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      setLoading(true);
      try {
        const [results, allergens] = await Promise.all([
          fetchCategoryTopPicks(petId, category, subFilter ?? null, species, 20),
          getPetAllergens(petId).catch(() => []),
        ]);
        if (!mountedRef.current) return;

        const ctx: InsightContext = {
          lifeStage: pet?.life_stage ?? null,
          weightGoalLevel: pet?.weight_goal_level ?? 0,
          activityLevel: pet?.activity_level ?? 'moderate',
          allergens: allergens.map((a) => a.allergen),
          category,
          petName,
        };

        const map: Record<string, InsightBullet[]> = {};
        for (const entry of results) {
          map[entry.product_id] = generateTopPickInsights(entry, ctx);
        }

        setPicks(results);
        setInsightsMap(map);
      } catch {
        if (mountedRef.current) {
          setPicks([]);
          setInsightsMap({});
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, [petId, category, subFilter, species, petName, pet?.life_stage, pet?.weight_goal_level, pet?.activity_level]);

  const handleProductTap = useCallback(
    (productId: string) => navigation.navigate('Result', { productId, petId }),
    [navigation, petId],
  );

  const handleEscapeTap = useCallback(() => {
    navigation.navigate('CategoryBrowse', { category, petId, subFilter });
  }, [navigation, category, petId, subFilter]);

  const title = getTopPicksTitle(category, subFilter ?? null, petName);
  const categoryTitle = getCategoryTitle(category);
  const filterLabel = getFilterLabel(category, subFilter ?? null) ?? categoryTitle;
  const isPartial = picks.length > 0 && picks.length < HEALTHY_THRESHOLD;
  const isEmpty = !loading && picks.length === 0;

  const subHeaderText = picks.length >= HEALTHY_THRESHOLD
    ? `Ranked 1–${picks.length} matches for ${petName}`
    : `Ranked 1–${picks.length} — limited results for this filter`;

  const escapeCopyHealthy = `Didn't find the right fit? Browse all ${categoryTitle} →`;
  const escapeCopyPartial = `Browse all ${categoryTitle} →`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.petBadge}>
          <Ionicons name="paw" size={12} color={Colors.accent} />
          <Text style={styles.petBadgeText}>{petName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading top picks…</Text>
        </View>
      ) : isEmpty ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.emptyCard}>
            <Ionicons name="sparkles-outline" size={28} color={Colors.accent} />
            <Text style={styles.emptyTitle}>No scored picks yet</Text>
            <Text style={styles.emptyBody}>
              We haven&apos;t scored any {filterLabel.toLowerCase()} for {petName} yet. Browse the full catalog below.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.escapeButton, styles.escapeButtonPrimary]}
            onPress={handleEscapeTap}
            activeOpacity={0.7}
          >
            <Text style={[styles.escapeButtonText, styles.escapeButtonTextPrimary]}>
              {escapeCopyPartial}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.subHeader}>{subHeaderText}</Text>

          <TopPickHeroCard
            pick={picks[0]}
            petName={petName}
            insights={insightsMap[picks[0].product_id] ?? []}
            onPress={() => handleProductTap(picks[0].product_id)}
          />

          {picks.length > 1 && (
            <>
              <Text style={styles.leaderboardLabel}>The Leaderboard</Text>
              {picks.slice(1).map((pick, i) => (
                <TopPickRankRow
                  key={pick.product_id}
                  pick={pick}
                  rank={i + 2}
                  insight={insightsMap[pick.product_id]?.[0] ?? null}
                  onPress={() => handleProductTap(pick.product_id)}
                />
              ))}
            </>
          )}

          <TouchableOpacity
            style={[styles.escapeButton, isPartial && styles.escapeButtonPrimary]}
            onPress={handleEscapeTap}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.escapeButtonText, isPartial && styles.escapeButtonTextPrimary]}
            >
              {isPartial ? escapeCopyPartial : escapeCopyHealthy}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  petBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  petBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  subHeader: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  leaderboardLabel: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  emptyCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  escapeButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  escapeButtonPrimary: {
    borderColor: Colors.accent,
    backgroundColor: `${Colors.accent}1A`,
  },
  escapeButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  escapeButtonTextPrimary: {
    color: Colors.accent,
  },
});
```

- [ ] **Step 6: Typecheck + full test sweep**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npx jest __tests__/services/topPickInsights.test.ts __tests__/services/categoryBrowseService.test.ts __tests__/components/browse/ __tests__/screens/categoryTopPicksHelpers.test.ts`
Expected: PASS on all Top Picks-related tests.

- [ ] **Step 7: Commit**

```bash
git add src/screens/CategoryTopPicksScreen.tsx src/screens/categoryTopPicksHelpers.ts __tests__/screens/categoryTopPicksHelpers.test.ts
git commit -m "$(cat <<'EOF'
M9: CategoryTopPicksScreen full wiring

Hero (TopPickHeroCard) + Leaderboard (TopPickRankRow × 19) + Escape Hatch.
4 states: loading, healthy (≥10), partial (1-9 with primary-tint escape
hatch), empty (empty card + escape hatch). Fetch is 2-query: picks +
pet allergens in parallel, insights computed client-side per pick. Tab
bar hidden on focus. Paywall-gated via canSearch().

Pure title/label helpers extracted to categoryTopPicksHelpers.ts, 11
unit tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Final verification

**Files:** None modified — verification only.

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: PASS — test count goes up by roughly 40–50 new tests. All existing tests still green. No new failures.

- [ ] **Step 2: Regression anchor confirmation**

Run: `npx jest __tests__/services/scoring/`
Expected: PASS — Pure Balance = 61, Temptations = 0, cardiac zero-out = 0, pancreatitis = 53 all green. (This work is display-layer only; anchors should be untouched, but confirm.)

- [ ] **Step 3: Full typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — zero errors.

- [ ] **Step 4: Lint**

Run: `npx eslint src/screens/CategoryTopPicksScreen.tsx src/components/browse/ src/services/topPickInsights.ts src/services/categoryBrowseService.ts`
Expected: PASS — no new warnings in modified files. If the repo uses a different lint script, match the existing pattern.

- [ ] **Step 5: On-device smoke test (manual)**

Start dev server. In Expo Go / dev build, as a premium account:
1. Open HomeScreen → confirm carousel renders, tap **See All** on a Daily Food / Dry pick → lands on new `CategoryTopPicksScreen`.
2. Confirm header title reads `"Top Dry Food for {Pet}"`. Hero renders with `"Best overall match for {Pet}"` badge, score ring, insights, name, brand.
3. Scroll through leaderboard — rank badges `#2`–`#20`, score pills, insights.
4. Tap the escape hatch → lands on existing `CategoryBrowseScreen` with same `{category, subFilter, petId}`.
5. Back out, change category on HomeScreen to `Supplements`. Tap a supplement card then See All. Confirm it skips Top Picks and lands on `CategoryBrowseScreen` directly (D-096).
6. Verify tab bar stays hidden on `CategoryTopPicksScreen`, returns on pop.

- [ ] **Step 6: Push branch + confirm clean state**

```bash
git push -u origin m9-top-picks-screen
git status
```

Expected: `nothing to commit, working tree clean`. Remote tracks `origin/m9-top-picks-screen`.

- [ ] **Step 7: Update status doc**

In `docs/status/CURRENT.md`, add a bullet under "What Works" (or wherever the M9 bullet list lives):

```
- **Top Picks dedicated screen (M9)** — CategoryTopPicksScreen replaces TopPicksCarousel See All destination for scored categories. Hero (rank #1 with ScoreRing + 3 insight bullets) + Leaderboard (#2–20) + Escape Hatch → CategoryBrowseScreen. Static-signal insights (allergen-safe / life stage / macro DMB / preservative / quality tier) — no score_breakdown caching, no new migration. Supplements bypass the new screen and route to CategoryBrowseScreen. Premium-gated via canSearch().
```

Update numbers section (increase test count / suites accordingly based on `npx jest` output).

```bash
git add docs/status/CURRENT.md
git commit -m "M9: top picks screen — update CURRENT.md"
git push
```

---

## Post-implementation: hand-off to Gemini

The spec file explicitly anticipates Gemini refining the UI in mockups. After this plan lands, Gemini can:
- Swap/augment the hero layout (e.g., add explicit "View Details" button)
- Polish rank-row rhythm (image size, badge styling, insight typography)
- Design the empty-state visual treatment beyond the placeholder card
- Align tokens to `.agent/design.md` drift discovered in the sweep

All implemented components are composable — the data contracts (`TopPickEntry`, `InsightBullet`) will not need to change for visual iteration.
