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
- **Vet Report PDF** — 4-page diet-centric report via expo-print (no Kiba scores). Pet profile with BCS gauge, caloric summary, combined nutrition with AAFCO checks, supplemental nutrients, flags, weight tracking, per-product detail, condition management notes, owner dietary cards (28 cards × conflict detection), vet notes. Premium-gated via `canExportVetReport()`.

## What's Broken / Known Issues
- Pre-existing TS errors: SharePantrySheet.tsx (Product type), feedingNotificationScheduler.ts (unit type)

## Numbers
- **Tests:** 1075 passing / 52 suites
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
- **Accomplished:** Vet Report PDF review + bug fixes + layout alignment + polish. Also D-167 allergen score cap and CompareScreen review earlier in session.
  - **Vet Report code review** — reviewed all 5 files (4 new, 1 modified). Found 3 critical, 3 medium issues.
  - **Bug fixes applied:**
    - BCS gauge triangle marker math (zone-aware positioning for flex 3:2:2:2)
    - Ca/P fields added to VetReportDietItem type + populated in buildDietItems + AAFCO checks added (dog: Ca>=0.5%, P>=0.4%; cat: Ca>=0.6%, P>=0.5%)
    - Removed unsafe `as unknown as` casts for calcium/phosphorus
    - Hypothyroidism observation text fixed ("exceeds threshold" not "preferred")
    - 3x D-095 "preferred" violations reworded to observational language
    - Footer disclaimer added to all 4 pages
  - **Layout alignment (3 phases):**
    - Phase 1: Title "KIBA — Diet Report for [Name]" centered, Pet Profile bordered box with 4-column grid, medications as bullet lists, caloric summary above diet table, dropped AAFCO column from diet table
    - Phase 2: Unified nutrition table (Nutrient/As-Fed/DMB/AAFCO), inline supplemental nutrients, "Weight Tracking" section simplified
    - Phase 3: Per-product numbered inline format with Category/AAFCO/macros/kcal/ingredients
  - **Polish:** BCS 9-cell gauge with color-coded zones (CSS classes + print-color-adjust), section headers with gray background bars, bordered-section wrappers, brand stripped from diet table product names, treat row hidden when kcal unknown, AAFCO shows "—" when no DMB data, footer bumped to 8px
  - **ownerDietaryCards.ts** — wrote 28 clinical dietary cards (14 conditions × 2 species) from Spec §17
  - **D-167 + CompareScreen** — allergen score cap at 50, CompareScreen cleanup (earlier in session)
- **Files changed:** src/utils/vetReportHTML.ts, src/types/vetReport.ts, src/services/vetReportService.ts, src/data/ownerDietaryCards.ts (NEW), src/services/scoring/personalization.ts, __tests__/services/scoring/personalization.test.ts, __tests__/services/scoring/allergenOverride.test.ts, src/screens/CompareScreen.tsx, src/services/scoring/pipeline.ts, src/services/scoring/CLAUDE.md, DECISIONS.md, docs/references/scoring-rules.md, docs/references/scoring-details.md, docs/plans/vet_report_plan_review.md (NEW), docs/status/CURRENT.md
- **Not done yet:**
  - Safe Swap recommendations + condition filters
  - Affiliate integration
  - PortionCard: auto-populate feedings_per_day per condition
  - Paywall gate: `canCompare()` currently stubbed true — needs real premium check (M7)
  - Scoring reference docs: scoring-details.md still needs condition scoring + weight management sections
  - Vet report tests not yet written (25+ planned in vetReportService.test.ts)
- **Next session should:** Run /boot. Commit + push all changes. Write vet report tests. Start Safe Swap condition filters.
- **Gotchas for next session:**
  - Vet report has no automated tests yet — `vetReportService.test.ts` needs to be created with combined nutrition math, AAFCO checks, flag generation, condition notes, owner dietary cards, treat waterfall, weight drift tests.
  - `expo-print` was installed this session (`npx expo install expo-print`) — verify it's in package.json.
  - BCS gauge uses CSS classes with `!important` + `print-color-adjust: exact` for color rendering in expo-print. If colors stop rendering, check the global style block.
  - `canCompare()` is stubbed to return `true` — don't forget to gate behind real paywall in M7.
  - `liver` and `seizures` tags exist in DOG_CONDITIONS but have NO scoring rules or dietary cards — display-only.
  - `getMaxBucket()` in CompareScreen only handles treat vs daily_food weights.
  - `pantryHelpers.ts:385` `getSystemRecommendation()` missing weight_goal_level param — unused function.
  - Auto-deplete cron `computeInlineDER()` must be synced manually if portionCalculator multiplier tables change.
- **New decision this session: D-167 (Allergen Score Cap). Scoring logic changed (personalization.ts Layer 3). No new migrations.**
