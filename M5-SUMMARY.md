# M5 Milestone Summary — Pantry + Recall Siren

**Completed:** 2026-03-20
**Branch:** m4.5-cleanup
**Sessions:** 6-11

---

## M5 Completion Status

| Metric | Value |
|--------|-------|
| Files created | 88 |
| Files modified | 36 |
| Total files touched | 124 |
| Total tests | 862 (43 suites) |
| All tests passing | Yes |
| TypeScript errors | 0 |
| Migrations added | 8 (011-018) |
| Edge Functions added | 3 (+ batch-score from M4.5) |
| New screens | 7 |
| New components | 5 |
| New services | 7 |
| New stores | 3 |

### Migrations

| # | File | Purpose |
|---|------|---------|
| 011 | `011_pantry_tables.sql` | `pantry_items` + `pantry_pet_assignments` tables with RLS |
| 012 | `012_pet_product_scores.sql` | `pet_product_scores` cache for batch scoring + D-156 resolution |
| 013 | `013_push_tokens.sql` | `push_tokens` table (per-device Expo tokens, dead token cleanup) |
| 014 | `014_user_settings.sql` | `user_settings` table (notification prefs, digest frequency) |
| 015 | `015_auto_deplete_cron.sql` | pg_cron + pg_net setup for 30-min auto-depletion |
| 016 | `016_recall_tables.sql` | `recall_log`, `recall_review_queue`, `recall_notifications` tables |
| 017 | `017_appointments.sql` | `pet_appointments` + `pet_health_records` tables with RLS |
| 018 | `018_digest_cron.sql` | pg_cron setup for weekly/daily digest push |

---

## Screen Inventory

### PantryScreen
- **Route:** `PantryMain` (PantryStack, bottom tab "Pantry")
- **Key features:** Pet carousel with switching, filter chips (7 types: all/dry/wet/treats/supplemental/recalled/running_low), sort menu (4 options: default/name/score/days_remaining), diet completeness banner, recalled items alert banner, "Gave a treat" inline action
- **Decisions:** D-084, D-094, D-095, D-125, D-155, D-157

### EditPantryItemScreen
- **Route:** `EditPantryItem` (PantryStack)
- **Key features:** Edit quantity/feeding/schedule with auto-save, share sheet for multi-pet assignment, depletion breakdown display, remove/restock actions, recalled/empty state indicators
- **Decisions:** D-084, D-094, D-095, D-155, D-157, D-158

### RecallDetailScreen
- **Route:** `RecallDetail` (shared across ScanStack, HomeStack, PantryStack, SearchStack)
- **Key features:** Full recall info display, "View FDA Notice" button (Linking.openURL), "Remove from Pantry" action, factual objective tone
- **Decisions:** D-084, D-095, D-125, D-158

### AppointmentsListScreen
- **Route:** `Appointments` (MeStack)
- **Key features:** Segmented tabs (Upcoming/Past), type icons with relative dates, free tier gate (2 active max), create button with paywall check
- **Decisions:** D-103, D-153

### CreateAppointmentScreen
- **Route:** `CreateAppointment` (MeStack)
- **Key features:** Type chips (vet_visit/grooming/medication/vaccination/deworming/other), DateTimePicker, multi-pet selector, reminder picker (off/1hr/1day/3days/1week), recurring options (none/monthly/quarterly/biannual/yearly)
- **Decisions:** D-103, D-153

### AppointmentDetailScreen
- **Route:** `AppointmentDetail` (MeStack)
- **Key features:** Full edit form, "Mark Complete" with auto-next for recurring, delete with confirmation, Health Record Log Sheet (D-163)
- **Decisions:** D-103, D-163

### NotificationPreferencesScreen
- **Route:** `NotificationPreferences` (MeStack)
- **Key features:** Global kill switch, per-category toggles (feeding/low_stock/empty/recall/appointment), digest frequency selector (weekly/daily/off), reschedules local notifications on toggle change
- **Decisions:** M5 notification preferences

### SearchScreen (Top Matches)
- **Route:** `SearchMain` (SearchStack, bottom tab "Search")
- **Key features:** Premium paywall gate, scored product rankings per pet, category filter (Daily Food/Treats/All), text search, pet carousel switcher
- **Decisions:** D-055, D-084, D-094, D-095, D-153

---

## Component Library (M5 Additions)

| Component | Location | Purpose |
|-----------|----------|---------|
| PantryCard | `src/components/pantry/PantryCard.tsx` | Pantry list item: product info, ScoreBadge (resolved_score), depletion bar, alert bars (recalled/low stock), "Gave a treat" button, empty state with restock/remove |
| AddToPantrySheet | `src/components/pantry/AddToPantrySheet.tsx` | Bottom sheet: serving mode (weight/unit), fractional chips, unit label picker, feeding schedule, depletion breakdown preview, DER recommendation (premium goal weight) |
| SharePantrySheet | `src/components/pantry/SharePantrySheet.tsx` | Bottom sheet: same-species pet list, per-pet resolved scores (D-156), checkbox toggle with inline serving editor, species mismatch explanation |
| HealthRecordLogSheet | `src/components/appointments/HealthRecordLogSheet.tsx` | Modal: log vaccination/deworming records from appointment completion (D-163), auto-create follow-up |
| TreatBatteryGauge | `src/components/TreatBatteryGauge.tsx` | Visual gauge: daily treat kcal consumed vs budget, per-pet, midnight reset |

---

## Service Layer

### pantryService.ts
Pantry CRUD + offline guards. Exports: `addToPantry`, `removePantryItem`, `restockPantryItem`, `updatePantryItem`, `updatePetAssignment`, `sharePantryItem`, `resolveScoresForPet` (D-156 cascade), `resolveScoreForPets`, `getPantryForPet`, `checkDuplicateUpc`, `evaluateDietCompleteness`.

### topMatches.ts
Cache freshness + batch scoring trigger. Exports: `checkCacheFreshness` (5 conditions: life stage, profile edits, health updates, engine version, timestamp), `fetchTopMatches`, `triggerBatchScore`.

### appointmentService.ts
Appointment CRUD + recurring logic + D-163 health records. Exports: `createAppointment`, `updateAppointment`, `deleteAppointment`, `completeAppointment` (auto-next for recurring), `getUpcomingAppointments`, `getPastAppointments`, `logHealthRecord`, `getHealthRecords`, `addManualHealthRecord`.

### pushService.ts
Expo push token management + notification preferences. Exports: `registerPushToken`, `unregisterPushToken`, `updateNotificationPreference`, `getNotificationPreferences`.

### pantryHelpers.ts
Pure functions (no Supabase). Exports: `calculateDaysRemaining`, `isLowStock`, `getCalorieContext`, `getSystemRecommendation`, `calculateDepletionBreakdown`, `defaultServingMode`.

### feedingNotificationScheduler.ts
Client-side local feeding notifications. Exports: `cancelAllFeedingNotifications`, `rescheduleAllFeeding`. Multi-pet grouping (single notification per time slot), daily repeating via expo-notifications.

### appointmentNotificationScheduler.ts
Client-side local appointment reminders. Exports: `cancelAllAppointmentReminders`, `rescheduleAllAppointments`. One-shot DATE-triggered, reminder offsets (1hr/1day/3days/1week).

---

## Store Changes

### usePantryStore (new)
**State:** `items`, `dietStatus`, `loading`, `error`, `_petId`
**Actions:** `loadPantry`, `addItem`, `removeItem`, `restockItem`, `updateItem`, `shareItem`, `logTreat` (deduct qty + track in battery), `refreshDietStatus`

### useTopMatchesStore (new)
**State:** `scores`, `loading`, `refreshing`, `error`, `categoryFilter`, `searchQuery`
**Actions:** `loadTopMatches`, `refreshScores`, `setFilter`, `setSearch`

### useTreatBatteryStore (new)
**State:** `consumedByPet` (per-pet kcal/count), `lastResetDate`
**Actions:** `addTreatConsumption`, `resetIfNewDay`
**Helpers:** `getTodayStr`, `resolveTreatKcal`
**Persistence:** AsyncStorage, midnight auto-reset

---

## Edge Functions (3 Server-Side Cron)

### auto-deplete
- **Interval:** Every 30 minutes (pg_cron + pg_net)
- **Behavior:** Query active assignments with remaining > 0, compute daily deduction per item (unit: direct sum; weight: cups-to-kg via calorie density or 0.1134 fallback), apply with idempotency guard (`last_deducted_at < todayStartUTC`), detect empty/low-stock transitions, send push via Expo Push API
- **Notifications:** Low stock (<=5 days/units, once per crossing), empty (quantity reaches 0)
- **Respects:** `user_settings.notifications_enabled`, `low_stock_alerts_enabled`, `empty_alerts_enabled`
- **Dead tokens:** Deactivate on `DeviceNotRegistered`

### recall-check
- **Interval:** Daily at 6:00 AM UTC (pg_cron + pg_net)
- **Behavior:** Fetch FDA animal/veterinary food recall RSS, parse + filter for pet-related entries, deduplicate against `recall_log`/`recall_review_queue`, match via 5-step algorithm (segment brand -> parent company -> substring -> generic guard -> word overlap)
- **Confidence levels:** HIGH = auto-flag `is_recalled` + insert `recall_log`; MEDIUM = queue for manual review; LOW = skip
- **Notifications:** Push to affected pantry users (D-125: no premium gate), dedup via `recall_notifications` table
- **Copy:** D-084 (no emoji), D-095 (factual: "has been recalled by the FDA")

### weekly-digest
- **Interval:** Weekly (Sunday 9 AM UTC) + Daily (9 AM UTC), mode in POST body
- **Behavior:** Filter users by `notifications_enabled` + `digest_frequency` + account age >= 3 days. Parallel fetch: tokens, pets, scans (lookback window), pantry items, upcoming appointments. Build prioritized message (max 200 chars): P1 recall alerts, P2 upcoming appointments, P3 activity summary, P4 stock status
- **Title:** "{Pet}'s Weekly/Daily Summary" (single pet) or "Weekly/Daily Summary" (multi-pet)
- **Dead tokens:** Deactivate on `DeviceNotRegistered`

---

## Local Notification Schedulers (2 Client-Side)

### feedingNotificationScheduler
- **Type:** Daily repeating via expo-notifications
- **Trigger:** DAILY at configured `feeding_times` hour/minute
- **Grouping:** Same-time feedings across pets consolidated into single notification
- **Resync:** Full cancel + rebuild on: add/edit/remove pantry item, toggle preference, app launch
- **Storage:** Notification IDs in AsyncStorage for cleanup

### appointmentNotificationScheduler
- **Type:** One-shot per appointment via expo-notifications
- **Trigger:** DATE trigger at `scheduled_at` minus reminder offset
- **Offsets:** 1 hour, 1 day, 3 days, 1 week (user-selectable)
- **Resync:** Full cancel + rebuild on: create/edit/delete appointment, toggle preference, app launch
- **Storage:** Notification IDs in AsyncStorage for cleanup

---

## Compliance Audit

| Decision | Status | Summary |
|----------|--------|---------|
| D-084 Zero Emoji | PASS | No emoji in src/ or Edge Functions |
| D-094 Suitability Framing | PASS | All score displays use "[X]% match" with pet name |
| D-095 UPVM Compliance | PASS | Zero prohibited medical terms |
| D-125 Recalls Free | PASS | No premium checks on recall features |
| D-129 Allergen Override | PASS | D-156 cascade includes pet_product_scores (allergen-aware) |
| D-135 Vet Diet Bypass | PASS | Badge shown, no score, excluded from batch-score |
| D-136 Supplemental | PASS | Badge + 65/35/0 weights + diet completeness |
| D-144 Species Mismatch | PASS | Blocked at add-to-pantry, filtered in share picker |
| D-145 Variety Pack | PASS | Can add to pantry, excluded from batch-score |
| D-151 Nursing Advisory | PASS | Under-4-weeks detection, penalty suppressed |
| D-152 Pantry Depletion | PASS | User-set servings, not DER-computed |
| D-153 Pantry Paywall | PASS | Only goal-weight DER gated |
| D-154 Sharing Rules | PASS | Active pet default, same-species, natural premium gate |
| D-155 Empty Item | PASS | Grayed, sorted bottom, restock/remove offered |
| D-156 Score Source | PASS | pet_product_scores -> scan_history -> base_score -> null |
| D-157 Mixed Feeding Removal | PASS | Contextual nudge, no auto-rebalance |
| D-158 Recalled Bypass | PASS | No score, warning + ingredients, all 6 requirements verified |
| D-163 Health Records | PASS | No UPVM violations, no emoji, no premium checks, RLS enforced |

**18/18 decisions PASS**

---

## Regression Targets

| Anchor | Engine | Expected | Actual | Status |
|--------|--------|----------|--------|--------|
| Pure Balance (Dog) | Client | 62 | 62 | PASS |
| Pure Balance (Dog) | Batch | 62 | 62 | PASS |
| Temptations (Cat Treat) | Client | 9 | 9 | PASS |

Batch-score engine verified as logic-identical to client engine (import-path-only diffs).

---

## Feature Verification (72 Checks)

| Category | Pass | Fail | N/A | Total |
|----------|------|------|-----|-------|
| Pantry | 27 | 0 | 1 | 28 |
| Top Matches | 5 | 0 | 0 | 5 |
| Recall Siren | 8 | 0 | 0 | 8 |
| Appointments | 6 | 1 | 0 | 7 |
| Notifications | 9 | 0 | 0 | 9 |
| Treat Battery | 5 | 0 | 0 | 5 |
| Home Screen | 4 | 1 | 0 | 5 |
| Weekly Digest | 5 | 0 | 0 | 5 |
| **Total** | **69** | **2** | **1** | **72** |

**Open items (not blockers):**
- PetHubScreen: no inline upcoming appointment widget (navigates to full list instead)
- HomeScreen: no recent scans section (may be by design — scans accessible via Scan tab)

---

## M6 Dependencies

M5 provides the data foundation for M6 features:

| M5 Output | M6 Consumer |
|-----------|-------------|
| `pantry_items` + `pantry_pet_assignments` | Compare flow (side-by-side pantry items) |
| `pet_product_scores` cache | Vet Report PDF (pre-computed scores for all products) |
| D-156 score resolution | Compare flow (per-pet scores in comparison view) |
| `recall_log` + `recall_notifications` | Recall history in Vet Report |
| `pet_appointments` + `pet_health_records` | Vet Report (appointment/vaccination history) |
| Notification infrastructure | M6+ notification expansion (compare alerts, report ready) |

---

## Known Limitations

| Limitation | Impact | Future Fix |
|------------|--------|------------|
| Cups-to-lbs conversion | Uses standard approximation (0.1134 kg/cup or calorie-based). No per-product density data. | v2: product-specific density if dataset available |
| FDA recall matching | Conservative — HIGH auto-flags, MEDIUM queued for manual review. May miss unusual brand names. | Ongoing: review queue for MEDIUM matches |
| Timezone handling | Cron functions use UTC. Auto-deplete idempotency is daily-total, not per-feeding. | v2: user timezone in depletion math |
| Scoops approximation | Scoops treated as equivalent to cups in depletion math. | v2: scoop-to-cup ratio if measurable |
| Auto-depletion drift | Estimated consumption may diverge from actual feeding patterns over time. | User can manually adjust quantity_remaining |
| Variety pack pantry display | No dedicated badge — shows "No score" via null resolved_score. Detection is scan-time only. | D-145: variety pack scoring deferred |
