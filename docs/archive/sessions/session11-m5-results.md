# Session 11 — M5 Full Regression & Feature Verification

**Date:** 2026-03-20
**Branch:** m4.5-cleanup
**Model:** Claude Opus 4.6 (1M context)

---

## 1. TypeScript Check (`npx tsc --noEmit`)

**Result: 1 ERROR**

```
__tests__/stores/treatBattery.test.ts(173,3): error TS2322:
  Type '{ assignments: ...; }' is not assignable to type 'PantryCardData'.
  Types of property 'resolved_score' are incompatible.
    Type 'number | null | undefined' is not assignable to type 'number | null'.
```

**Cause:** D-156 fix added `resolved_score: number | null` to `PantryCardData`. The treatBattery test fixture builds a PantryCardData object without setting `resolved_score`, so TypeScript sees it as `undefined` (not `null`).

---

## 2. Jest (`npx jest --silent`)

**Result: 862 tests, 43 suites — ALL PASS**

(The TS error is type-only; ts-jest still runs the test successfully.)

---

## 3. Regression Anchors

| Anchor | Expected | Actual | Status |
|--------|----------|--------|--------|
| Pure Balance (Dog) — client engine | 62 | 62 | PASS |
| Temptations (Cat Treat) — client engine | 9 | 9 | PASS |
| Batch-score engine | Same as client | Import-path-only diffs | PASS |

---

## 4. Feature Verification

### PANTRY (28 checks)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | Add dry food (weight mode) | PASS | AddToPantrySheet supports serving_mode='weight' with quantity_unit in lbs/oz/kg/g |
| 2 | Add wet food (unit mode, fractional, dynamic label) | PASS | serving_mode='unit', fractional chips 0.25-2.0, unit_label cans/pouches |
| 3 | Add treat (unit mode, no depletion breakdown) | PASS | Treats force unit mode; calculateDepletionBreakdown returns null for treats |
| 4 | Depletion breakdown: unit mode live update | PASS | calculateDepletionBreakdown computes unit-mode; useMemo in AddToPantrySheet updates reactively |
| 5 | Depletion breakdown: weight mode with/without calorie data | PASS | Weight mode handles both kcal paths; fallback returns rate-only |
| 6 | Vet diet in pantry (badge, no score, countdown) | PASS | ScoreBadge renders "Vet Diet" badge; days_remaining shown |
| 7 | Variety pack in pantry (badge, no score) | N/A | Variety pack detection is scan-time only (pipeline.ts). No is_variety_pack on products table, so pantry shows "No score" badge via null resolved_score. This is by design — D-145 says "can add to pantry" but no dedicated pantry badge exists or is required |
| 8 | Species mismatch blocked | PASS | ResultScreen checks target_species !== pet.species, shows alert |
| 9 | Duplicate UPC -> restock prompt | PASS | checkDuplicateUpc returns existing itemId; alert with "Restock" option |
| 10 | Edit item (quantity, serving, schedule, unit label) | PASS | EditPantryItemScreen edits all 4 fields |
| 11 | Restock empty item | PASS | restockPantryItem sets quantity_remaining = quantity_original, is_active=true |
| 12 | Remove single-pet / shared item | PASS | Shared items show modal vs inline alert for single-pet |
| 13 | Mixed feeding removal -> D-157 nudge | PASS | shouldShowD157Nudge checks remaining daily food assignments |
| 14 | Share (same-species, naturally gated) | PASS | SharePantrySheet filters by target_species, no premium check |
| 15 | Share sheet species message (no eligible pets) | PASS | Empty state: "No other {speciesLabel} to share with..." |
| 16 | Share sheet per-pet scores | PASS | petScores via resolveScoreForPets D-156 cascade, displayed per row |
| 17 | Filter chips | PASS | 7 filter types: all, dry, wet, treats, supplemental, recalled, running_low |
| 18 | Sort menu | PASS | 4 sort options: default, name, score, days_remaining |
| 19 | Progress bar (green/amber/red) | PASS | getDepletionBarColor: >20% green, >5% amber, <=5% red |
| 20 | Treats: no bar, calorie context | PASS | Bar hidden for treats; calorie context line shown |
| 21 | Diet completeness states | PASS | evaluateDietCompleteness: complete / amber_warning / red_warning / empty |
| 22 | Low stock at <=5 days/units | PASS | isLowStock: weight <=5 days, unit <=5 qty or <=5 days |
| 23 | Empty: grayed, bottom, notification | PASS | opacity 0.4; sort priority 3 (bottom); auto-deplete sends push |
| 24 | Calorie context line | PASS | Conditional render; source: 'label' / 'estimated' / null |
| 25 | Goal weight DER (premium) vs current (free) | PASS | canUseGoalWeight() gates in AddToPantrySheet |
| 26 | Offline write blocked with toast | PASS | requireOnline() throws PantryOfflineError |
| 27 | Offline read from cache | PASS | getPantryForPet try/catch returns [] gracefully |
| 28 | Per-pet isolation on pet switch | PASS | usePantryStore tracks _petId, reloads on change |

**Pantry: 27 PASS, 0 FAIL, 1 N/A**

---

### TOP MATCHES (5 checks)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | First load triggers batch scoring | PASS | triggerBatchScore() invokes 'batch-score' Edge Function |
| 2 | Scores sorted by match % | PASS | .order('final_score', { ascending: false }) |
| 3 | Category filter, text search | PASS | Category chips + client-side text filter in SearchScreen |
| 4 | Tap -> ResultScreen with fresh score | PASS | Navigation passes productId; ResultScreen calls scoreProduct() |
| 5 | Cache invalidation | PASS | Checks life stage drift, pet.updated_at, health_reviewed_at, engine version |

**Top Matches: 5/5 PASS**

---

### RECALL SIREN (8 checks)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | D-158 pipeline bypass | PASS | pipeline.ts returns bypass='recalled' before scoring |
| 2 | ResultScreen: no score, red badge + ingredients | PASS | Dedicated recalled render path with red badge, FDA button, ingredient list |
| 3 | Recalled pantry item: no score, red badge, top of list | PASS | ScoreBadge "Recalled" badge; sort priority 0 (top) in pantryService.ts:406-408 |
| 4 | Pantry alert bar | PASS | PantryCard alert bar + PantryScreen top-of-list recall banner |
| 5 | HomeScreen recall card | PASS | recallCard rendered for each recalled pantry item |
| 6 | RecallDetailScreen with FDA link | PASS | "View FDA Notice" button calls Linking.openURL(recall.fda_url) |
| 7 | Recall push notification (free) | PASS | No premium checks in recall-check Edge Function |
| 8 | Recall matching: 10 test fixtures | PASS | recallMatching.test.ts has 10 fixtures, all pass |

**Recall Siren: 8/8 PASS**

---

### APPOINTMENTS (7 checks)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | Create all types | PASS | TYPE_OPTIONS: vet_visit, grooming, medication, vaccination, deworming, other |
| 2 | Multi-pet assignment | PASS | togglePet() with selectedPetIds array |
| 3 | Recurring: complete -> next auto-created | PASS | completeAppointment() calls getNextDate(), inserts next |
| 4 | Local reminder at correct interval | PASS | REMINDER_OFFSETS (1_hour/1_day/3_days/1_week) subtracted from scheduled_at |
| 5 | Free tier: 2 active max | PASS | canCreateAppointment checks activeCount < freeAppointmentsMax |
| 6 | Past appointments archived | PASS | Segmented "Upcoming" / "Past" tabs |
| 7 | PetHubScreen shows upcoming | FAIL | PetHubScreen only has a "Settings" row linking to Appointments screen; no upcoming appointment widget rendered |

**Appointments: 6/7 PASS, 1 FAIL**

---

### NOTIFICATIONS (9 checks)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | Local feeding reminders at scheduled times | PASS | Schedules DAILY notifications with hour/minute from feeding_times |
| 2 | Multi-pet grouped feeding notification | PASS | Groups by time; single vs multi-pet titles |
| 3 | Auto-depletion cron ticks correctly | PASS | Deduction logic with idempotency guard (last_deducted_at < todayStartISO) |
| 4 | Low stock push (once per crossing) | PASS | Detects !wasLow && isLow transition |
| 5 | Empty push at 0 | PASS | Detects oldRemaining > 0 && newRemaining <= 0 |
| 6 | Local appointment reminders | PASS | DATE trigger at calculated triggerDate |
| 7 | Notification preferences toggles | PASS | Per-category toggles with reschedule on change |
| 8 | Global kill switch | PASS | Cancels all local notifications + server checks notifications_enabled |
| 9 | Dead token cleanup (410) | PASS | 'DeviceNotRegistered' -> is_active = false |

**Notifications: 9/9 PASS**

---

### TREAT BATTERY (5 checks)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | "Gave a treat" deducts from pantry | PASS | logTreat deducts quantity_remaining via updatePantryItem |
| 2 | kcal deducted from gauge | PASS | addTreatConsumption updates consumedByPet[petId].kcal |
| 3 | Null kcal: qty deducts, gauge skips | PASS | resolveTreatKcal returns null; kcal adds 0; gauge skips on null calorieSource |
| 4 | Daily reset of consumed kcal | PASS | resetIfNewDay compares lastResetDate to getTodayStr() |
| 5 | Gauge shows correct remaining % | PASS | getBarPercent: (consumed / budget) * 100 |

**Treat Battery: 5/5 PASS**

---

### HOME SCREEN (5 checks)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | Recall alert card (top) | PASS | recallCard loop for recalled pantry items, positioned before pantry summary |
| 2 | Pantry summary card | PASS | Shows total items, low stock count, empty count |
| 3 | Upcoming appointment row | PASS | Next appointment with type icon, pet name, relative date |
| 4 | Scan counter (unchanged) | PASS | weeklyCard displays weeklyCount from useScanStore |
| 5 | Recent scans (unchanged) | FAIL | No recent scan history component on HomeScreen |

**Home Screen: 4/5 PASS, 1 FAIL**

---

### WEEKLY DIGEST (5 checks)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | Active user message with scan count | PASS | Message includes scan count with pluralization |
| 2 | Inactive user re-engagement nudge | PASS | Fallback "Haven't scanned in a while?" + cold-start message |
| 3 | Recall included regardless of activity | PASS | P1 priority recall message even when scanCount=0 |
| 4 | Upcoming appointment included | PASS | P2 message with nearest appointment |
| 5 | Frequency preference respected | PASS | Queries digest_frequency=mode; controls lookback window |

**Weekly Digest: 5/5 PASS**

---

## 5. Summary

| Category | Pass | Fail | N/A | Total |
|----------|------|------|-----|-------|
| TypeScript | — | 1 error | — | 1 error |
| Jest | 862 | 0 | — | 862 |
| Regression Anchors | 2/2 | 0 | — | 2 |
| Pantry | 27 | 0 | 1 | 28 |
| Top Matches | 5 | 0 | — | 5 |
| Recall Siren | 8 | 0 | — | 8 |
| Appointments | 6 | 1 | — | 7 |
| Notifications | 9 | 0 | — | 9 |
| Treat Battery | 5 | 0 | — | 5 |
| Home Screen | 4 | 1 | — | 5 |
| Weekly Digest | 5 | 0 | — | 5 |
| **TOTAL** | **69** | **2** | **1** | **72** |

## 6. Issues Found (Do NOT Fix)

### ISSUE 1: TypeScript Error in treatBattery.test.ts
- **File:** `__tests__/stores/treatBattery.test.ts:173`
- **Problem:** Test fixture builds PantryCardData without `resolved_score` field (added by D-156 fix). TypeScript sees `undefined` instead of required `number | null`.
- **Fix needed:** Add `resolved_score: null` to the test fixture object.

### ISSUE 2: PetHubScreen — No Upcoming Appointment Widget
- **File:** `src/screens/PetHubScreen.tsx:681`
- **Problem:** PetHubScreen only has a navigation row ("Appointments") linking to AppointmentsListScreen. No inline upcoming appointment display.
- **Expected:** Show next upcoming appointment with date/type directly on PetHubScreen.

### ISSUE 3: HomeScreen — No Recent Scans Section
- **File:** `src/screens/HomeScreen.tsx`
- **Problem:** HomeScreen shows recall cards, pantry summary, upcoming appointment, and weekly scan counter — but no recent scan history list.
- **Note:** May be intentional design choice (scans accessible via scan tab). Verify with product owner whether "recent scans" was ever part of HomeScreen spec.
