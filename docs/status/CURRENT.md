# Project Status — Last updated 2026-03-28

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
- **Vet Report PDF** — 4-page diet-centric report via expo-print (no Kiba scores). Pet profile with BCS gauge, caloric summary, combined nutrition with AAFCO checks, supplemental nutrients, flags, weight tracking, per-product detail, condition management notes, owner dietary cards (28 cards × conflict detection), vet notes. Premium-gated via `canExportVetReport()`.

## What's Broken / Known Issues
- Pre-existing TS errors: SharePantrySheet.tsx (Product type), feedingNotificationScheduler.ts (unit type)

## Numbers
- **Tests:** 1137 passing / 53 suites
- **Decisions:** 129 (D-001 through D-167, non-sequential, all `###` normalized)
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
- **Date:** 2026-03-28
- **Accomplished:** Vet report test suite — 62 tests covering all internal pure functions + owner dietary cards + conflict detection.
  - **vetReportService.test.ts (NEW)** — 62 tests across 11 suites:
    - `formatServing` (3): single/multiple feedings, whole number formatting
    - `getFormLabel` (6): treat/supp/top/dry/wet/fallback
    - `buildDietItems` (4): field mapping, allergen cross-reference, "As needed" fallback, missing ingredients
    - `computeCombinedNutrition` (7): calorie-weighted averages, treat/supplement exclusion, empty nutrition, DMB conversion, AAFCO thresholds (dog+cat), null handling
    - `computeSupplementNutrients` (3): highest value selection, empty array, probiotics presence
    - `generateFlags` (10): all P1-P8 priorities, DCM dogs-only guard, sequential numbering
    - `generateConditionNotes` (13): CKD, pancreatitis (dog vs cat), diabetes (dog vs cat), obesity, hypothyroid, GI, skin, joint, cardiac taurine detection, liver/seizures no-op
    - `computeTreatSummary` (4): battery source, kcalIsEstimated, pantry fallback, null
    - `buildWeightTracking` (5): field defaults, drift calculation, negative drift, all goal labels, null fields
    - `getOwnerDietaryCards` (4): healthy maintenance, allergen trigger, render order, species-specific
    - `detectConflicts` (4): CKD+underweight, pancreatitis+underweight dogs-only, no conflicts, both conflicts
  - Exported 10 internal pure functions from `vetReportService.ts` for testability
- **Files changed:** src/services/vetReportService.ts (added exports), __tests__/services/vetReportService.test.ts (NEW), docs/status/CURRENT.md
- **Not done yet:**
  - Safe Swap recommendations + condition filters
  - Affiliate integration
  - PortionCard: auto-populate feedings_per_day per condition
  - Paywall gate: `canCompare()` currently stubbed true — needs real premium check (M7)
  - Scoring reference docs: scoring-details.md still needs condition scoring + weight management sections
- **Next session should:** Run /boot. Commit + push all changes. Start Safe Swap condition filters.
- **Gotchas for next session:**
  - `expo-print` was installed last session (`npx expo install expo-print`) — verify it's in package.json.
  - BCS gauge uses CSS classes with `!important` + `print-color-adjust: exact` for color rendering in expo-print. If colors stop rendering, check the global style block.
  - `canCompare()` is stubbed to return `true` — don't forget to gate behind real paywall in M7.
  - `liver` and `seizures` tags exist in DOG_CONDITIONS but have NO scoring rules or dietary cards — display-only.
  - `getMaxBucket()` in CompareScreen only handles treat vs daily_food weights.
  - `pantryHelpers.ts:385` `getSystemRecommendation()` missing weight_goal_level param — unused function.
  - Auto-deplete cron `computeInlineDER()` must be synced manually if portionCalculator multiplier tables change.
- **No new decisions, no scoring changes, no new migrations this session.**
