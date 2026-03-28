# Project Status — Last updated 2026-03-27

## Active Milestone
**M6 — Alternatives Engine** (compare flow, safe swaps, weight management, BCS reference, vet report PDF)

## Last Completed
**M5 — Pantry + Appointments + HomeScreen v2** (March 26, 2026, branch `m5-complete`)

## What Works
- Scan-to-score pipeline: barcode → 3-layer scoring (IQ/NP/FC) → result screen
- 19,058 products (v7 reimport, Chewy + Amazon + Walmart)
- Pet profiles, pantry (auto-deplete, budget-aware servings), treat battery
- Appointments (CRUD, recurring, reminders, health records)
- Push notifications (feeding, low stock, empty, recall, appointment, weight estimate, digest)
- HomeScreen v2, Community tab, Top Matches, RevenueCat paywall
- **Health condition scoring** — 12 conditions (P0-P3), Layer 3 adjustments, cardiac+DCM zero-out
- **Health condition UI** — expanded condition picker (mutual exclusions, sub-types), ResultScreen advisories, medication tracking
- **Weight goal slider (D-160)** — 7-position discrete slider (-3 to +3), cat -3 absent, condition-blocked positions, premium-gated, auto-reset on conflict
- **Caloric accumulator (D-161)** — daily delta tracking in auto-deplete cron, weight estimate push notifications, WeightEstimateSheet (confirm/enter/dismiss), PetHubScreen banner
- **BCS reference (D-162)** — 9-point educational guide, species tabs, tappable selection saves to pet profile, cat primordial pouch callout, free for all users
- **Compare flow** — 9-rule key differences engine, two-column CompareScreen (score breakdown, nutrition table, ingredients), CompareProductPickerSheet (search, recent scans, camera), kcal/cup estimation fallback (DB → kcal/kg × 110g → Atwater), PortionCard kcal/cup display

## What's Broken / Known Issues
- Pre-existing TS errors: SharePantrySheet.tsx (Product type), feedingNotificationScheduler.ts (unit type)

## Numbers
- **Tests:** 1070 passing / 52 suites
- **Decisions:** 128 (D-001 through D-166, non-sequential, all `###` normalized)
- **Migrations:** 22 (001–022)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 57 (fat >12% DMB penalty)

## Up Next (M6)
- Safe Swap recommendations + condition filters (topMatches.ts hard filters per condition)
- Vet Report PDF, affiliate integration
- PortionCard: auto-populate feedings_per_day per condition
- Paywall gate: replace `canCompare()` stub with real premium check (M7)
- `aafco_inference` on Product type (low priority — Rule 5 uses aafco_statement only)

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-27
- **Accomplished:** Code review of M6 CompareScreen implementation + 3 cleanup fixes.
  - **Reviewed all 11 files** (4 new, 7 modified) — see walkthrough.md and implementation_plan.md for full inventory
  - **New files reviewed clean:** keyDifferences.ts (9-rule engine), keyDifferences.test.ts (14 tests), CompareScreen.tsx, CompareProductPickerSheet.tsx
  - **Modified files reviewed clean:** ScoreRing.tsx, PortionCard.tsx, ResultScreen.tsx, AddToPantrySheet.tsx, navigation.ts, index.tsx, calorieEstimation.ts
  - **DER bug fixes verified correct** in all 4 sites (ResultScreen ×2, AddToPantrySheet ×2)
  - **3 fixes applied to CompareScreen.tsx:**
    1. Removed unused `getScoreColor` import
    2. Replaced `.length` dependency proxies with `.join()` for stable reactivity
    3. Typed `KEY_DIFF_ICONS` with `ComponentProps<typeof Ionicons>['name']`, dropped `as any`
- **Files changed:** src/screens/CompareScreen.tsx (3 edits), docs/status/CURRENT.md
- **Not done yet:**
  - Safe Swap recommendations + condition filters
  - Vet Report PDF, affiliate integration
  - PortionCard: auto-populate feedings_per_day per condition
  - Paywall gate: `canCompare()` currently stubbed true — needs real premium check (M7)
  - `aafco_inference` not on Product type (Rule 5 uses aafco_statement only for now)
  - Scoring reference docs still need condition scoring + weight management sections
  - `scoring-details.md` bypass order still wrong (variety pack/recalled swapped)
- **Next session should:** Run /boot. Start Safe Swap condition filters or vet report PDF. Compare flow is shipped and reviewed.
- **Gotchas for next session:**
  - `canCompare()` is stubbed to return `true` — don't forget to gate behind real paywall in M7.
  - `getMaxBucket()` in CompareScreen only handles treat vs daily_food weights — if supplemental products reach CompareScreen, breakdown denominator will be wrong. Low risk since picker filters by category.
  - SafeSwapSection referenced in M6 prompt doesn't exist — `src/components/result/` only has HealthConditionAdvisories.tsx. Separate build needed.
  - `liver` and `seizures` tags exist in DOG_CONDITIONS but have NO scoring rules in conditionScoring.ts — display-only.
  - `scoring-details.md` Section 2 bypass order still wrong (variety pack/recalled swapped).
  - Auto-deplete cron `computeInlineDER()` is a simplified copy of client-side DER math — if portionCalculator.ts multiplier tables change, cron must be updated manually.
  - `pantryHelpers.ts:385` `getSystemRecommendation()` missing weight_goal_level param — function is unused but worth fixing preemptively.
- **No new decisions added. No scoring logic changed. No new migrations.**
