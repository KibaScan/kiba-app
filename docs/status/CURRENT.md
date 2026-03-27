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
- Push notifications (feeding, low stock, empty, recall, appointment, digest)
- HomeScreen v2, Community tab, Top Matches, RevenueCat paywall
- **Health condition scoring** — 12 conditions (P0-P3), Layer 3 adjustments, cardiac+DCM zero-out
- **Health condition UI** — expanded condition picker (mutual exclusions, sub-types), ResultScreen advisories, medication tracking

## What's Broken / Known Issues
- Pre-existing TS errors: SharePantrySheet.tsx (Product type), feedingNotificationScheduler.ts (unit type)

## Numbers
- **Tests:** 1012 passing / 50 suites
- **Decisions:** 128 (D-001 through D-166, non-sequential, all `###` normalized)
- **Migrations:** 21 (001–021)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 57 (fat >12% DMB penalty)

## Up Next (M6)
- Compare flow, Safe Swap recommendations, Weight goal slider (D-160)
- Caloric accumulator (D-161), BCS reference (D-162), Vet Report PDF

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-27
- **Accomplished:** M6 Health Conditions Part 2 — schema, types, CRUD, expanded condition picker, medication tracking, ResultScreen advisories. No scoring files touched.
  - Migration 021: `pet_condition_details` + `pet_medications` tables with RLS
  - Added `PetConditionDetail` + `PetMedication` types to `src/types/pet.ts`
  - Added 7 CRUD functions to `petService.ts` (getConditionDetails, upsertConditionDetail, deleteConditionDetail, getMedications, createMedication, updateMedication, deleteMedication) — all with offline guards
  - Added `hypothyroid` to DOG_CONDITIONS in `src/data/conditions.ts`
  - Expanded `conditionLogic.ts`: hypothyroid↔hyperthyroid mutual exclusion, `getConditionToast()` for species-rarity warnings
  - Updated `HealthConditionsScreen.tsx`: mutual exclusion toasts, hyperthyroid sub-type question for cats (iodine_restricted vs medication_managed), condition detail sync on save
  - Created `MedicationFormScreen.tsx`: add/edit/delete medication form with status chips, dosage, prescribed-for condition picker
  - Added Medications section to `PetHubScreen.tsx`: current meds with green dot, past meds collapsed, empty state
  - Created `HealthConditionAdvisories.tsx` component: per-condition advisory cards with score impact, cardiac+DCM zero-out warning, D-095 disclaimer
  - Wired `HealthConditionAdvisories` into `ResultScreen.tsx` between Advisories and Safe Swap CTA
  - 35 new tests across 3 new test files
- **Files changed:** supabase/migrations/021_condition_details_medications.sql (NEW), src/types/pet.ts, src/types/navigation.ts, src/services/petService.ts, src/data/conditions.ts, src/utils/conditionLogic.ts, src/screens/HealthConditionsScreen.tsx, src/screens/MedicationFormScreen.tsx (NEW), src/screens/PetHubScreen.tsx, src/screens/ResultScreen.tsx, src/navigation/index.tsx, src/components/result/HealthConditionAdvisories.tsx (NEW), __tests__/services/petService.conditionDetails.test.ts (NEW), __tests__/utils/conditionLogic.test.ts, __tests__/data/conditions.test.ts, __tests__/components/result/HealthConditionAdvisories.test.ts (NEW)
- **Not done yet:**
  - PortionCard: auto-populate feedings_per_day per condition (gi_sensitive=3, pancreatitis dogs=3-4, diabetes=2 locked)
  - Safe Swap condition filters (topMatches.ts hard filters per condition)
  - Scoring reference docs: scoring-rules.md + scoring-details.md need condition scoring sections
  - scoring-details.md bypass order is wrong (variety pack #3 vs recalled #3 — needs swap)
  - Apply migration 021 to production database
  - Remaining M6: compare flow, weight goal slider (D-160), caloric accumulator (D-161), BCS reference (D-162), vet report PDF, affiliate integration
- **Next session should:** Run /boot. Either start Part 3 (Safe Swap condition filters + PortionCard feeding defaults) or move to another M6 feature (compare flow, weight goal slider). Health conditions scoring + UI are both complete.
- **Gotchas for next session:**
  - Migration 021 creates `pet_condition_details` + `pet_medications` — needs applying to production.
  - `weight_goal_lbs` is always null — no UI to set it yet. D-160 weight goal slider still M6-pending.
  - `liver` and `seizures` tags exist in DOG_CONDITIONS but have NO scoring rules in conditionScoring.ts — display-only for now.
  - HealthConditionAdvisories matches personalizations to conditions via keyword matching in labels — fragile but functional for placeholder. Designer will replace the component.
  - `scoring-details.md` Section 2 bypass order still wrong (variety pack/recalled swapped).
  - Batch-score server copy generated via sed transform — verify import paths if Deno complains.
- **No new decisions added. No scoring logic changed. Migration 021 added.**
