# Project Status — Last updated 2026-03-26

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

## What's Broken / Known Issues
- Pre-existing TS errors: SharePantrySheet.tsx (Product type), feedingNotificationScheduler.ts (unit type)

## Numbers
- **Tests:** 977 passing / 48 suites
- **Decisions:** 128 (D-001 through D-166, non-sequential, all `###` normalized)
- **Migrations:** 20 (001–020)
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
- **Date:** 2026-03-26
- **Accomplished:** M6 Health Condition Scoring — complete implementation of scoring rules for all 12 conditions. Also performed onboarding audit fixing documentation gaps.
  - Created `src/utils/conditionScoring.ts` — 12 condition rule sets (62 rules total), cap logic, cardiac+DCM zero-out
  - Created `src/data/conditionAdvisories.ts` — D-095 compliant UI advisory text for all 12 conditions
  - Updated `personalization.ts` — replaced M1 stub with real condition scoring, zeroOut handling
  - Migrated obesity fiber suppression + CKD protein gate from `nutritionalProfile.ts` to Layer 3
  - Mirrored all changes to `supabase/functions/batch-score/` (conditionScoring + personalization + nutritionalProfile)
  - Added Section 0 (Pipeline Bypasses) to `scoring-rules.md`
  - Added 4 missing pitfalls to `docs/errors.md` (timezone drift, scanner timeout, Zustand stale closure, carb NaN)
  - Annotated M6-pending schema fields in CLAUDE.md
  - Added partial supersession markers to DECISIONS.md header
  - 37 new condition scoring tests + 1 advisory test suite
- **Files changed:** src/utils/conditionScoring.ts (NEW), src/data/conditionAdvisories.ts (NEW), __tests__/utils/conditionScoring.test.ts (NEW), supabase/functions/batch-score/utils/conditionScoring.ts (NEW), src/services/scoring/personalization.ts, src/services/scoring/nutritionalProfile.ts, supabase/functions/batch-score/scoring/personalization.ts, supabase/functions/batch-score/scoring/nutritionalProfile.ts, __tests__/services/scoring/personalization.test.ts, __tests__/services/scoring/nutritionalProfile.test.ts, CLAUDE.md, DECISIONS.md, docs/errors.md, docs/references/scoring-rules.md, docs/specs/M6_HEALTH_CONDITION_SCORING_SPEC.md
- **Not done yet:**
  - ResultScreen UI: render condition adjustment cards + advisory text (conditionAdvisories.ts ready)
  - PortionCard: auto-populate feedings_per_day per condition (gi_sensitive=3, pancreatitis dogs=3-4, diabetes=2 locked)
  - HealthConditionsScreen: sub-type questions (hyperthyroid: iodine-restricted vs medication)
  - Safe Swap condition filters (topMatches.ts hard filters per condition)
  - Migration 021: pet_condition_details table (sub_type, severity, diagnosed_at)
  - Scoring reference docs: scoring-rules.md + scoring-details.md need condition scoring sections
  - scoring-details.md bypass order is wrong (variety pack #3 vs recalled #3 — needs swap)
  - Remaining M6: compare flow, weight goal slider (D-160), caloric accumulator (D-161), BCS reference (D-162), vet report PDF, affiliate integration
- **Next session should:** Run /boot. Continue M6 — either wire condition scoring into ResultScreen UI (Part 2) or start another M6 feature (compare flow, weight goal slider). The scoring engine work is complete; remaining condition work is UI + Safe Swaps.
- **Gotchas for next session:**
  - Condition adjustments are flat points on the final score, NOT weighted bucket adjustments. This was a deliberate choice to avoid touching engine.ts.
  - The `hypothyroid` tag exists in conditionScoring.ts rules but is NOT in `src/data/conditions.ts` DOG_CONDITIONS yet — needs adding when UI is wired.
  - `scoring-details.md` Section 2 bypass order is wrong (variety pack/recalled swapped) — fix when auditing docs.
  - Batch-score server copy generated via sed transform — verify import paths if Deno complains.
- **No new decisions added. Scoring logic changed (Layer 3 condition scoring). No migrations added.**
