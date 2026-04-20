# D-168 Accessibility Backfill — Shipped

> **Status:** Shipped in commit `8f9bb3e` on branch `m9-reduce-score-noise` (2026-04-17).
> **Scope:** 7 in-app score surfaces + 2 call sites + 1 test file + 1 enforcement-doc tightening + D-168 body update.
> **Tests:** 1596 → 1597 passing / 71 suites. Typecheck clean on all touched files.
> **Outstanding:** on-device VoiceOver QA across all 7 surfaces (not yet verified).

---

## Why this exists

D-168 (landed in commit `92a58f9`) superseded D-094 and codified a tiered score-framing rule:

| Tier | Visible text | Where |
|------|--------------|-------|
| Outbound share | `{score}% match for {petName}` | `PetShareCard` only |
| In-app, moderate space | `{score}% match` | `ScanHistoryCard`, `PantryCard`, `TopPickRankRow`, `SharePantrySheet` |
| In-app, dense or hero-minimal | `{score}%` | `ScoreRing`, `BrowseProductRow`, `TopPicksCarousel`, `TopPickHeroCard`, `ScoreWaterfall`, `SafeSwapSection` rows |

The **accessibility invariant** of D-168 requires every score element to expose the full `{score}% match for {petName}` phrase to assistive tech, regardless of its visible tier. The landing commit only backfilled `ScanHistoryCard` and `PantryCard`, leaving 7 in-app surfaces without an `accessibilityLabel`. D-168's body flagged these as a known compliance gap.

This commit closes that gap.

---

## Reference pattern (discovered during the sweep)

React Native flattens inner `accessibilityLabel` inside a `TouchableOpacity` or `Pressable` by default — VoiceOver announces the parent's label and ignores inner Text-level labels. This matters because the obvious instinct ("put the label on the score `<Text>`") silently fails on every card-style component.

**The correct placement rule:**

| Hierarchy | Where the `accessibilityLabel` goes |
|-----------|-----|
| Score is inside a `TouchableOpacity` / `Pressable` card | On the **outer pressable**, including product name + score + pet |
| Score is in a plain `View` / `Text` hierarchy (no outer pressable) | Directly on the score `<Text>` |
| Outer pressable already has a semantic label (e.g., "rank N") | **Extend** the existing label with score + pet, don't add a conflicting inner element |

This rule is now codified in three places so it doesn't re-lapse:
- D-168's body (`DECISIONS.md` — "Reference pattern for future score surfaces")
- `.claude/agents/kiba-code-reviewer.md` rule #9 (describes where to look)
- This doc (audit trail)

---

## Per-surface changes

All file paths absolute to repo root.

### 1. `src/components/browse/BrowseProductRow.tsx`

**Before:** No `accessibilityLabel`. VoiceOver auto-generated a label from visible text ("Chicken & Rice, 85%"). No pet name reached assistive tech.

**Change:**
- Added `petName: string` to the `Props` interface.
- Added destructured `petName` to the function signature.
- Built an `a11yLabel` string: `"${brand} ${displayName}, ${score}% match for ${petName}"` (or `"..., no score yet"` for unscored products).
- Set `accessibilityLabel={a11yLabel}` on the outer `<Pressable>`.

**Caller update:** `src/screens/CategoryBrowseScreen.tsx:166–172` — `renderItem` now passes `petName={petName}` and its `useCallback` deps now include `petName` (was `[handleProductPress]`, now `[handleProductPress, petName]`).

---

### 2. `src/components/browse/TopPicksCarousel.tsx`

**Before:** No `accessibilityLabel`. `petName` was already a prop.

**Change:**
- Computed `cardA11y` in the `renderItem` callback (outside JSX for readability).
- Set `accessibilityLabel={cardA11y}` on the outer per-card `<TouchableOpacity>`.
- Format: `"${brand} ${productName}, ${score}% match for ${petName}"` when scored; `"${brand} ${productName}"` when not.

---

### 3. `src/components/browse/TopPickHeroCard.tsx`

**Before:** Outer `TouchableOpacity` already had `accessibilityLabel={`${pick.product_name}, best overall match`}` on line 34. No pet or score info.

**Change:**
- Extended the existing label to conditionally include score + pet:
  - Scored: `"${productName}, best overall match, ${score}% match for ${petName}"`
  - Unscored: `"${productName}, best overall match"` (unchanged)
- Reverted an earlier experimental `accessible={true}` + `accessibilityLabel` on the inner score badge `View` (would have been flattened; replaced by the outer-label extension).

---

### 4. `src/components/browse/TopPickRankRow.tsx`

**Before:** Outer `TouchableOpacity` had `accessibilityLabel={`${pick.product_name}, rank ${rank}`}`. No pet or score.

**Change:**
- Added `petName: string` to `TopPickRankRowProps`.
- Added destructured `petName` to the function signature.
- Extended outer `accessibilityLabel`:
  - Scored: `"${productName}, rank ${rank}, ${score}% match for ${petName}"`
  - Unscored: `"${productName}, rank ${rank}"` (unchanged)

**Caller update:** `src/screens/CategoryTopPicksScreen.tsx:172–180` — the `.map()` loop now passes `petName={petName}`.

---

### 5. `src/components/scoring/ScoreWaterfall.tsx`

**Before:** No `accessibilityLabel`. `petName` was already a prop (line 34).

**Change:**
- Added `accessibilityLabel={`${scoredResult.finalScore}% match for ${petName}`}` directly on the `finalScore` `<Text>` (lines 605–611).
- Text-level label is reliable here because the final-score row is inside a plain `<View>` hierarchy with no outer `TouchableOpacity` / `Pressable`.

---

### 6. `src/components/result/SafeSwapSection.tsx`

**Before:** No `accessibilityLabel`. `petName` was already a prop (line 37). Per-candidate cards are `<TouchableOpacity>` inside a `.map()` over `result.candidates`.

**Change:**
- Added `accessibilityLabel={`${c.brand} ${c.product_name}, ${Math.round(c.final_score)}% match for ${petName}`}` on the per-candidate `<TouchableOpacity>` (line ~204).
- Reverted an earlier `accessible={true}` + `accessibilityLabel` on the inner score-pill `<View>` (flattened; replaced by outer label).

---

### 7. `src/components/pantry/SharePantrySheet.tsx`

**Before:** Per-pet row is a `<TouchableOpacity>` with no `accessibilityLabel`. `petScore` was computed inside an IIFE nested in the JSX — only reachable from visible text, not from the outer pressable's attributes.

**Change:**
- Hoisted `petScore` out of the IIFE to the top of the `.map(pet => { ... })` callback so both the visible `<Text>` and the outer `<TouchableOpacity>`'s `accessibilityLabel` can read it.
- Built an `a11yLabel`:
  - Scored: `"${pet.name}, ${petScore}% match for ${pet.name}, ${assigned ? 'sharing' : 'not sharing'}"`
  - Unscored: `"${pet.name}, not scored, ${assigned ? 'sharing' : 'not sharing'}"`
- Set `accessibilityLabel={a11yLabel}` on the outer `<TouchableOpacity>`.
- Kept visible text `{petScore}% match` unchanged.

---

## Test coverage

Added one render-level assertion to `__tests__/components/browse/TopPickRankRow.test.tsx`:

```tsx
it('accessibility label includes full "{score}% match for {petName}" phrase (D-168)', () => {
  const { getByLabelText } = render(
    <TopPickRankRow pick={entry} rank={2} petName="Buster" insight={insight} onPress={() => {}} />,
  );
  expect(getByLabelText(/88% match for Buster/i)).toBeTruthy();
});
```

Existing tests in the file were also updated to pass the new required `petName` prop (3 render sites — TypeScript would not compile without).

**Test count:** 1596 → 1597 / 71 suites. All passing.

**Not covered by render tests:** the 6 other surfaces. `BrowseProductRow`, `TopPicksCarousel`, `TopPickHeroCard`, `ScoreWaterfall`, `SafeSwapSection`, `SharePantrySheet` don't have render tests today. Adding them is out of scope for this commit — the D-168 a11y assertion on `TopPickRankRow` serves as the regression anchor for the pattern.

---

## Doc / enforcement updates

- `DECISIONS.md` D-168 body — "Known compliance gap at landing" section renamed to "**Compliance backfill (completed)**" with per-surface notes. New "**Reference pattern for future score surfaces**" subsection codifies the outer-pressable rule.
- `.claude/agents/kiba-code-reviewer.md` rule #9 — guidance updated to describe where `accessibilityLabel` should live based on component hierarchy. The stale "Known backfill gap: 7 terse-tier surfaces" line was removed.

---

## What's left before merging the branch

**On-device VoiceOver QA:** Every touched surface needs physical-device verification. iOS Simulator can run VoiceOver but physical device is the source of truth. Steps:

1. Enable VoiceOver (Settings → Accessibility → VoiceOver → On).
2. Navigate to each of the 7 backfilled surfaces + the 4 from earlier commits (ScanHistoryCard, PantryCard, ScoreRing, SafeSwitchSetup badges).
3. Swipe right to focus each score element; confirm the full `"{score}% match for {petName}"` phrase is announced.
4. Especially verify:
   - `TopPicksCarousel` cards — outer TouchableOpacity label announces the full phrase.
   - `TopPickHeroCard` — existing "best overall match" label now also carries score + pet.
   - `TopPickRankRow` — "rank N" label now also carries score + pet.
   - `SharePantrySheet` per-pet row — the `petScore` hoist works and the sharing-state suffix reads naturally.
5. Layout sanity (non-a11y) on ScoreRing without the caption: confirm the large score number + pet photo still read as a cohesive hero.

**If any surface fails VoiceOver QA:** the outer-pressable-label approach failed for that particular hierarchy, and the fix is surface-specific (e.g., wrapping with `accessible={true}` + explicit child-hiding). Document the exception in D-168 and iterate.

---

## Git state

**Branch:** `m9-reduce-score-noise` (off `m5-complete` at `a79d43b`).

**Commits:**
```
8f9bb3e M9: D-168 a11y backfill — 7 score surfaces expose full phrase to VoiceOver
144d2e0 M9: strip pet name from ScoreRing + SafeSwitchSetup (D-168 noise pass)
92a58f9 M9: retire D-094, add D-168 tiered score framing
a79d43b handoff: session 55 (base)
```

**Files touched in this commit (12):**
- `DECISIONS.md`
- `.claude/agents/kiba-code-reviewer.md`
- `__tests__/components/browse/TopPickRankRow.test.tsx`
- `src/components/browse/BrowseProductRow.tsx`
- `src/components/browse/TopPickHeroCard.tsx`
- `src/components/browse/TopPickRankRow.tsx`
- `src/components/browse/TopPicksCarousel.tsx`
- `src/components/pantry/SharePantrySheet.tsx`
- `src/components/result/SafeSwapSection.tsx`
- `src/components/scoring/ScoreWaterfall.tsx`
- `src/screens/CategoryBrowseScreen.tsx`
- `src/screens/CategoryTopPicksScreen.tsx`

**Diff size:** +64 / −31.

---

## Review checklist for Steven

- [ ] D-168's "Compliance backfill (completed)" section reads cleanly.
- [ ] The outer-pressable placement rule makes sense as a reference pattern (vs. the instinct of "put it on the score Text").
- [ ] `BrowseProductRow` + `TopPickRankRow` prop addition is acceptable (both required one new prop threaded through one call site).
- [ ] `SharePantrySheet`'s IIFE → hoisted `petScore` refactor preserves identical visible behavior.
- [ ] VoiceOver QA plan above is practical.
- [ ] Commit message captures all notable decisions.
