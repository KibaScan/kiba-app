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

## What's Broken / Known Issues
- Pre-existing TS errors: SharePantrySheet.tsx (Product type), feedingNotificationScheduler.ts (unit type)

## Numbers
- **Tests:** 1056 passing / 51 suites
- **Decisions:** 128 (D-001 through D-166, non-sequential, all `###` normalized)
- **Migrations:** 22 (001–022)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 57 (fat >12% DMB penalty)

## Up Next (M6)
- Compare flow, Safe Swap recommendations
- Vet Report PDF, affiliate integration
- PortionCard: auto-populate feedings_per_day per condition
- Safe Swap condition filters (topMatches.ts hard filters per condition)

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-27
- **Accomplished:** M6 Weight Management — full D-160/D-161/D-162 implementation + post-ship fixes. No scoring files touched.
  - **Phase 1–5: Core implementation**
    - Migration 022: weight_goal_level, caloric_accumulator, accumulator_last_reset_at, accumulator_notification_sent, bcs_score, bcs_assessed_at on pets; weight_estimate_alerts_enabled on user_settings
    - `src/utils/weightGoal.ts` (NEW): 5 pure functions + constants (getAdjustedDER, getAvailableLevels, estimateWeeklyChange, getCalorieContext, shouldClampLevel)
    - `src/components/WeightGoalSlider.tsx` (NEW): swipeable pan-gesture slider with haptic detent feedback (react-native-gesture-handler + reanimated), tap fallback, premium gate, blocked positions
    - Replaced old goal weight section in PortionCard with slider, wired getAdjustedDER into all DER consumers (pantryHelpers, EditPantryItemScreen, AddToPantrySheet, SharePantrySheet)
    - HealthConditionsScreen auto-resets weight_goal_level to 0 on condition conflict
    - Auto-deplete cron extended: inline DER computation (`computeInlineDER`), per-pet caloric accumulator, weight estimate push notifications
    - `src/components/WeightEstimateSheet.tsx` (NEW): confirm estimate / enter actual weight / dismiss, all reset accumulator
    - PetHubScreen: weight estimate banner, D-117 stale weight suppressed when accumulator active
    - `src/screens/BCSReferenceScreen.tsx` (NEW): 9 BCS cards, species tabs, tappable selection, cat primordial pouch callout, saves bcs_score+bcs_assessed_at. Entry points from PortionCard, PetHubScreen, WeightEstimateSheet.
    - NotificationPreferencesScreen: weight_estimate_alerts_enabled toggle
    - `src/types/notifications.ts`: added weight_estimate_alerts_enabled to UserSettings, weight_estimate to NotificationType
    - 44 new tests (weightGoal.test.ts), jest mocks for reanimated + gesture-handler
  - **Post-ship fixes:**
    - Pantry calorie target now shows adjusted DER (getCalorieContext uses computePetDer with weight_goal_level)
    - Treat battery budget uses adjusted DER (replaced local computeDER with computePetDer)
    - Slider rebuilt from tappable circles to swipeable pan gesture with haptic detents (worklet error fixed by inlining math in worklet, using runOnJS for snap+commit)
    - Pantry serving sizes proportionally scale when slider moves (ratio = newMult/oldMult, await all updates before reload)
    - SharePantrySheet now passes weight_goal_level to computePetDer (was using maintenance DER)
  - **Migrations 021 + 022 applied to production, auto-deplete Edge Function deployed**
- **Files changed:** supabase/migrations/022_weight_management.sql (NEW), src/types/pet.ts, src/types/notifications.ts, src/types/navigation.ts, src/utils/weightGoal.ts (NEW), __tests__/utils/weightGoal.test.ts (NEW), src/components/WeightGoalSlider.tsx (NEW), src/components/WeightEstimateSheet.tsx (NEW), src/components/PortionCard.tsx, src/utils/pantryHelpers.ts, src/utils/haptics.ts, src/screens/EditPantryItemScreen.tsx, src/components/pantry/AddToPantrySheet.tsx, src/components/pantry/SharePantrySheet.tsx, src/screens/HealthConditionsScreen.tsx, supabase/functions/auto-deplete/index.ts, src/screens/PetHubScreen.tsx, src/screens/pethub/PetHubStyles.ts, src/screens/pethub/petHubHelpers.ts (import only), src/services/petService.ts, src/screens/BCSReferenceScreen.tsx (NEW), src/navigation/index.tsx, src/screens/NotificationPreferencesScreen.tsx, __mocks__/react-native-reanimated.js (NEW), __mocks__/react-native-gesture-handler.js (NEW), package.json (jest moduleNameMapper), docs/status/CURRENT.md
- **Not done yet:**
  - PortionCard: auto-populate feedings_per_day per condition (gi_sensitive=3, pancreatitis dogs=3-4, diabetes=2 locked)
  - Safe Swap condition filters (topMatches.ts hard filters per condition)
  - Scoring reference docs: scoring-rules.md + scoring-details.md need condition scoring + weight management sections
  - scoring-details.md bypass order is wrong (variety pack #3 vs recalled #3 — needs swap)
  - Remaining M6: compare flow, vet report PDF, affiliate integration
- **Next session should:** Run /boot. Start compare flow or Safe Swap condition filters. Weight management is fully shipped and tested.
- **Gotchas for next session:**
  - `liver` and `seizures` tags exist in DOG_CONDITIONS but have NO scoring rules in conditionScoring.ts — display-only for now.
  - HealthConditionAdvisories matches personalizations to conditions via keyword matching in labels — fragile but functional.
  - `scoring-details.md` Section 2 bypass order still wrong (variety pack/recalled swapped).
  - Batch-score server copy generated via sed transform — verify import paths if Deno complains.
  - Auto-deplete cron `computeInlineDER()` is a simplified copy of the client-side DER math — if portionCalculator.ts multiplier tables change, the cron must be updated manually.
  - Jest now has `moduleNameMapper` for react-native-reanimated + gesture-handler mocks in `__mocks__/`. Any new component using these libraries will work in tests automatically.
  - PortionCard `handleLevelChange` proportionally scales pantry serving sizes + reloads pantry. If user reports stale pantry data after slider change, check that `Promise.allSettled` completes before `loadPantry`.
- **No new decisions added. No scoring logic changed. Migrations 021 + 022 applied to production.**
