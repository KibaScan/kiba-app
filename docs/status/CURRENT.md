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
- No pre-existing TS errors (all 7 fixed this session)

## Numbers
- **Tests:** 1178 passing / 54 suites
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
- **Accomplished:** Safe Swap recommendations — Plan 1 (core service + UI + tests). Also fixed all 7 pre-existing TS errors.
  - **safeSwapService.ts (NEW)** — full query + filter pipeline:
    - Pure functions: `toDMB`, `inferMoisture`, `applyConditionHardFilters`, `generateSwapReason`, `dcmPulsePatternFires`
    - 6 condition hard filters: pancreatitis (dog fat >15% DMB), CKD (phosphorus), diabetes (cat carb >25% DMB), obesity (kcal density), cardiac (DCM pulse pattern), underweight (name keywords)
    - 5 exclusion queries (parallel): allergen, severity, pantry, recent scans, cardiac DCM
    - `fetchSafeSwaps()` — base query on `pet_product_scores` + products join, returns top 3 candidates with swap reasons
  - **SafeSwapSection.tsx (NEW)** — UI component:
    - Premium users: 3-card row with product image, brand, name, score + "for [petName]" (D-094), swap reason, Compare link
    - Free users: blurred placeholder with paywall tap (migrated from ResultScreen)
    - Bypassed products: hidden. Empty results: hidden.
  - **ResultScreen.tsx** — replaced 34-line placeholder with SafeSwapSection component, lifted petAllergenGroups to state
  - **ResultScreenStyles.ts** — removed 8 unused placeholder styles
  - **safeSwapService.test.ts (NEW)** — 41 tests across 5 suites:
    - `toDMB` (2), `inferMoisture` (4), `applyConditionHardFilters` (18), `dcmPulsePatternFires` (6), `generateSwapReason` (11)
  - **Pre-existing TS error fixes (7 errors → 0):**
    - CreatePetScreen, OnboardingScreen, ScanScreen: added missing migration 022 fields to createPet() calls
    - WeightGoalSlider: cast currentLevel to ALL_LEVELS literal union
    - feedingNotificationScheduler: removed stale 'units' comparison (D-164)
    - SharePantrySheet: cast item.product as Product for computeAutoServingSize
- **Files changed:** src/services/safeSwapService.ts (NEW), src/components/result/SafeSwapSection.tsx (NEW), __tests__/services/safeSwapService.test.ts (NEW), src/screens/ResultScreen.tsx, src/screens/result/ResultScreenStyles.ts, src/screens/CreatePetScreen.tsx, src/screens/OnboardingScreen.tsx, src/screens/ScanScreen.tsx, src/components/WeightGoalSlider.tsx, src/services/feedingNotificationScheduler.ts, src/components/pantry/SharePantrySheet.tsx, docs/status/CURRENT.md
- **Not done yet:**
  - Safe Swap Plan 2: curated layout (Top Pick / Fish-Based / Great Value) — needs migration 023 + price backfill rework. Curated layout is daily dry food only; other categories use top-3-by-score.
  - Safe Swap Plan 3: multi-pet chip row (Buster / Milo / All Dogs)
  - Affiliate integration
  - PortionCard: auto-populate feedings_per_day per condition
  - Paywall gate: `canCompare()` currently stubbed true — needs real premium check (M7)
  - Scoring reference docs: scoring-details.md still needs condition scoring + weight management sections
- **Next session should:** Run /boot. Commit + push. Review Safe Swap Plan 2 (curated layout + price migration) or start affiliate integration.
- **Gotchas for next session:**
  - `safe swaps/` folder still exists with draft files — can be cleaned up or used as reference for Plan 2.
  - Safe Swap relies on `pet_product_scores` cache being populated. If empty for a pet, section silently hides. Batch score must have run first (via topMatches.ts triggerBatchScore).
  - `canCompare()` is stubbed to return `true` — don't forget to gate behind real paywall in M7.
  - `liver` and `seizures` tags exist in DOG_CONDITIONS but have NO scoring rules or dietary cards — display-only.
  - `getMaxBucket()` in CompareScreen only handles treat vs daily_food weights.
  - `pantryHelpers.ts:385` `getSystemRecommendation()` missing weight_goal_level param — unused function.
  - Auto-deplete cron `computeInlineDER()` must be synced manually if portionCalculator multiplier tables change.
- **No new decisions, no scoring changes, no new migrations this session.**
