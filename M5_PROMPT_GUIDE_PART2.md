# Kiba M5 — Claude Code Prompt Guide (Part 2 of 2)

> **Purpose:** Step-by-step prompts for push notifications, auto-depletion, Recall Siren, Pet Appointments, Weekly Digest, Treat Battery, and M5 completion.
> **Prerequisite:** Phase 1 complete (Sessions 1–6 from Part 1). Pantry CRUD, pantry UI, Top Matches, and gram toggle all working.
> **Updated:** March 19, 2026 — v2: local notifications for feeding/appointment reminders, FDA matching test fixtures, Treat Battery wired in Phase 2, migrations split (013–016).

---

## Pre-Session: Verify Phase 1

Before starting Phase 2:

1. All Phase 1 checklist items pass (see Part 1 bottom)
2. Migrations 011 (pantry tables) + 012 (pet_product_scores) applied
3. Pantry add/remove/restock/edit/share working
4. Top Matches batch scoring producing correct results (Pure Balance = 62)
5. `npx jest --silent` — all tests pass (641 + Phase 1 additions)
6. `npx tsc --noEmit` — 0 errors
7. Tested on iOS device: pantry tab renders, add-to-pantry sheet works

---

## Session Map — Quick Reference

| Session | Domain | Deliverables | Context Mgmt |
|---------|--------|-------------|--------------|
| 7 | Push Tokens + Local Notifications + Auto-Depletion | Migration 013 (push_tokens), migration 014 (user_settings), local feeding notification scheduler, auto-depletion cron Edge Function | `/clear` after — backend infra ≠ UI |
| 8 | Recall Siren | Migration 015 (recall tables), FDA RSS Edge Function, recall bypass on ResultScreen (D-158), recall detail screen, pantry recall surfacing | `/clear` after — recall ≠ appointments |
| 9 | Pet Appointments | Migration 016 (appointments), appointment CRUD, local appointment reminder scheduler, recurring logic, appointment UI | `/clear` after — appointments ≠ digest |
| 10 | Weekly Digest + Home Screen + Treat Battery | Digest Edge Function, notification preferences screen, HomeScreen updates, Treat Battery pantry integration | `/clear` after — features ≠ audit |
| 11 | Compliance Audit + M5 Wrap | Full D-number audit, regression verification, integration testing, M5 summary doc | Final session |

**Cron vs Local notification strategy:**
- **Server-side cron (3 Edge Functions):** auto-deplete (writes to DB), recall-check (reads FDA RSS), weekly-digest (aggregates across tables). These genuinely need server context.
- **Client-side local notifications (2 schedulers):** feeding reminders, appointment reminders. Scheduled via `Notifications.scheduleNotificationAsync()` on device. Works offline, zero infrastructure, fires reliably on iOS.

---

## Session 7: Push Tokens + Local Notifications + Auto-Depletion

**Context is fresh. Start with Plan Mode.**

---

### Prompt 1 — Push Token Migration + User Settings Migration

```
/plan

@CLAUDE.md @PANTRY_SPEC.md

Starting M5 Phase 2, Session 7: Push notification infrastructure.

Before this session, read:
- D-101 (feeding schedule + auto-depletion)
- D-084 (zero emoji in notifications)
- D-095 (no health claims in notification copy)
- D-125 (recalls not paywalled — recall push is free)

Two migrations (separate concerns, separate files):

1. Migration 013: push_tokens

   File: supabase/migrations/013_push_tokens.sql

   Table: push_tokens
   - id UUID PK
   - user_id UUID FK → auth.users(id) ON DELETE CASCADE
   - expo_push_token TEXT NOT NULL
   - device_id TEXT NOT NULL
   - platform TEXT CHECK IN ('ios', 'android') DEFAULT 'ios'
   - is_active BOOLEAN DEFAULT true
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - updated_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(user_id, device_id)

   RLS: user_id = auth.uid() for ALL operations.

2. Migration 014: user_settings

   File: supabase/migrations/014_user_settings.sql

   Table: user_settings
   - id UUID PK
   - user_id UUID FK → auth.users(id) ON DELETE CASCADE UNIQUE
   - notifications_enabled BOOLEAN DEFAULT true
   - feeding_reminders_enabled BOOLEAN DEFAULT true
   - low_stock_alerts_enabled BOOLEAN DEFAULT true
   - empty_alerts_enabled BOOLEAN DEFAULT true
   - recall_alerts_enabled BOOLEAN DEFAULT true
   - appointment_reminders_enabled BOOLEAN DEFAULT true
   - digest_frequency TEXT DEFAULT 'weekly' CHECK IN
     ('weekly', 'daily', 'off')
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - updated_at TIMESTAMPTZ DEFAULT NOW()

   RLS: user_id = auth.uid() for ALL operations.

   Separate from push_tokens because notification preferences
   and token management are different concerns with different
   change frequencies.

Also build:

3. src/services/pushService.ts

   registerPushToken():
   - Request notification permissions
   - Get Expo push token
   - Upsert into push_tokens (device_id as conflict key)
   - Upsert user_settings row (create if not exists)
   - Called on app launch after auth

   unregisterPushToken():
   - Set is_active = false for current device
   - Called on logout

   updateNotificationPreference(key: string, value: boolean | string):
   - Updates a specific column in user_settings
   - key: any column name (e.g., 'notifications_enabled',
     'recall_alerts_enabled', 'digest_frequency')

   getNotificationPreferences(userId: string):
     Promise<UserSettings>
   - Returns current user_settings row

4. src/utils/notifications.ts

   Expo notification setup:
   - registerForPushNotificationsAsync() — permissions + token
   - Handle notification received (foreground)
   - Handle notification tapped (navigate to relevant screen):
     * Feeding reminder → PantryScreen
     * Low stock / empty alert → PantryScreen
     * Recall alert → RecallDetailScreen (Session 8)
     * Appointment reminder → AppointmentDetailScreen (Session 9)
     * Weekly digest → HomeScreen
   - Notification channel setup for Android (future-proofing)

   Platform: Expo Notifications (direct). NOT OneSignal.

Constraints:
- Token registration must be idempotent
- D-084: no emoji in any notification content constant

Show me the plan before writing code.
```

**Review checkpoint:** Verify two separate migration files, not one combined. Verify `user_settings` has its own RLS policy. Verify `registerPushToken()` upserts both tables.

```
/execute
```

---

### Prompt 2 — Local Feeding Notification Scheduler

```
/plan

@CLAUDE.md @PANTRY_SPEC.md @src/utils/notifications.ts

Build the client-side feeding notification scheduler.

WHY LOCAL (not server cron): Feeding reminders are time-sensitive,
user-facing alerts that don't require server context. Local
scheduling via Expo Notifications works offline, has zero
infrastructure cost, and fires reliably on iOS. The server-side
cron is reserved for operations that need DB access (auto-depletion,
recall checking, weekly digest).

File: src/services/feedingNotificationScheduler.ts

Functions:

scheduleFeedingReminders(petId: string):
  - Query all pantry_pet_assignments for this pet WHERE
    feeding_frequency = 'daily' AND notifications_on = true
  - For each assignment, for each feeding_time:
    Schedule a daily repeating local notification via
    Notifications.scheduleNotificationAsync({
      content: { title, body, data: { type: 'feeding', pantryItemId } },
      trigger: { hour, minute, repeats: true }
    })
  - Store scheduled notification IDs in AsyncStorage keyed by
    assignment ID (for cancellation on changes)

cancelFeedingReminders(assignmentId: string):
  - Retrieve stored notification IDs for this assignment
  - Cancel each via Notifications.cancelScheduledNotificationAsync()
  - Remove from AsyncStorage

rescheduleAllFeeding(petId: string):
  - Cancel all existing feeding notifications for this pet
  - Re-schedule from current pantry data
  - Called when: pantry item added/removed, feeding times edited,
    notifications toggled, active pet switched

Notification content (D-084 + D-095 compliant):

  Single pet:
  "Time for [Pet Name]'s [meal_label] — [Product Name]
  ([serving_size] [unit])"

  [unit] uses unit_label from pantry_items for unit-mode items:
  "½ can", "1 pouch" — never "0.5 units". For weight-mode:
  "1.5 cups", "2 scoops".

  meal_label from time of day:
  - 5:00–10:59 AM → "breakfast"
  - 11:00 AM–1:59 PM → "lunch"
  - 2:00–8:59 PM → "dinner"
  - 9:00 PM–4:59 AM → "evening meal"

  Product name truncation: 30 chars max after stripBrandFromName().

Multi-pet grouping:
  If Buster and Milo both eat at 7 AM, schedule ONE notification:
  "Morning feeding — Buster (2 cups Pro Plan) + Milo (1.5 cups
  Pro Plan)"
  Group by matching feeding_times across assignments for the same
  user. This requires querying all pets' assignments, not just
  active pet.

Preference check:
  Before scheduling, check user_settings.feeding_reminders_enabled
  AND user_settings.notifications_enabled. If either is false,
  don't schedule.

Integration points:
  Call rescheduleAllFeeding() from:
  - usePantryStore.addItem() (after successful add)
  - usePantryStore.removeItem() (after successful remove)
  - EditPantryItemScreen (on feeding time or frequency change)
  - NotificationPreferencesScreen (on toggle change)
  - App launch (re-sync scheduled notifications)

Tests: __tests__/services/feedingNotificationScheduler.test.ts
- Schedules correct number of notifications for 2 daily feedings
- Cancels notifications when assignment removed
- Groups multi-pet notifications at same time
- Skips scheduling when notifications disabled
- Uses unit_label for display ("can" not "units")
- Reschedule clears old + creates new

Show me the plan before writing code.
```

```
/execute
```

---

### Prompt 3 — Auto-Depletion Cron

```
/plan

@CLAUDE.md @PANTRY_SPEC.md

Build the auto-depletion Edge Function — the server-side cron that
ticks down pantry quantities. This MUST be server-side because it
writes to the database.

File: supabase/functions/auto-deplete/index.ts

Trigger: Supabase cron — runs every 30 minutes

Logic:
1. Query all pantry_pet_assignments WHERE:
   - feeding_frequency = 'daily'
   - pantry_item.is_active = true
   - pantry_item.quantity_remaining > 0
   - There exists a feeding_time in feeding_times JSONB that falls
     within the current 30-minute window
   - (last_deducted_at IS NULL OR the relevant feeding_time hasn't
     been deducted today)

2. For each qualifying assignment:
   - deduction = serving_size (in the assignment's serving_size_unit)
   - Convert to quantity_unit if needed:
     * cups → lbs: standard approximation 1 cup ≈ 0.25 lbs
       (known limitation — varies by kibble density)
     * units → units: direct subtraction
     * scoops: treat as cups (1 scoop ≈ 1 cup)
   - UPDATE pantry_items SET
     quantity_remaining = MAX(0, quantity_remaining - deduction),
     last_deducted_at = NOW()

3. After deductions, check for state transitions:
   - quantity_remaining = 0 → send empty push notification
   - quantity_remaining / daily_rate ≤ 5 days → send low stock
     push notification (once per threshold crossing)

4. Push notifications for state transitions:
   - Check user_settings: notifications_enabled = true
   - Check user_settings: empty_alerts_enabled / low_stock_alerts_enabled
   - Check assignment: notifications_on = true
   - Use push token from push_tokens WHERE is_active = true

Notification content (D-084 + D-095 compliant):
- Empty: "[Pet Name]'s [Product Name] is empty"
- Low stock (weight mode): "Running low — ~[X] days of [Product Name] remaining"
- Low stock (unit mode): "Running low — [X] [unit_label] of [Product Name] remaining"
  (uses unit_label: "3 cans" or "5 pouches", never "3 units")

Error handling:
- Individual deduction failures: log, skip, continue batch
- Push send failures: log, don't retry (next run catches)
- Dead push tokens (410 from Expo): set is_active = false

Cron config:
  SELECT cron.schedule('auto-deplete', '*/30 * * * *', ...);

Show me the plan. The unit conversion between serving_size_unit
and quantity_unit is the trickiest part — call it out explicitly.
```

**Review checkpoint:** The cups-to-lbs conversion is approximate. For v1, the standard approximation is fine. If Claude proposes a density system, push back. Simplicity wins.

```
/execute
```

**`/clear` after this prompt.** Push infrastructure + local notifications + depletion done. Session 8 is Recall Siren.

---

## Session 8: Recall Siren

**Context is fresh.**

---

### Prompt 1 — Recall Detection Edge Function

```
/plan

@CLAUDE.md @DECISIONS.md

Starting M5 Session 8: Recall Siren.

Read D-158 in DECISIONS.md and D-125 (recalls free). Key rules:
- D-125: Recall alerts are FREE — never paywalled
- D-158: Recalled products are a pipeline bypass — no score computed,
  same pattern as vet diet (D-135). Overrides ROADMAP language that
  says "score → 0." The correct behavior is: no score at all.
- FDA recall RSS: https://www.fda.gov/about-fda/contact-fda/stay-informed
- Push notification to affected users

Build the recall detection pipeline. Three deliverables:

1. Edge Function: supabase/functions/recall-check/index.ts

   Trigger: Supabase cron — runs daily at 6:00 AM UTC

   Logic:
   a. Fetch FDA animal food recall RSS feed
   b. Parse recall entries — extract: recall date, brand, product
      names, reason, FDA link, lot numbers (when available)
   c. Match against products table using confidence tiers:

      HIGH confidence (auto-flag):
      - Exact brand match (case-insensitive) AND
      - Product name overlap ≥60% of words (excluding common
        stopwords: "recipe", "formula", "for", "with", "adult",
        "dog", "cat", "food")

      MEDIUM confidence (queue for review):
      - Brand match but name overlap <60%
      - OR parent company match (e.g., FDA says "Midwestern Pet
        Foods" but DB has "Sportmix" which is their brand)

      LOW confidence (skip):
      - No brand match
      - OR single-word brand match that's too generic ("Natural")

   MATCHING TEST FIXTURES — the algorithm MUST produce these results:

   | FDA Entry | DB Product | Expected |
   |---|---|---|
   | "Blue Buffalo Wilderness Rocky Mountain Recipe" | "Blue Buffalo Wilderness Rocky Mountain Recipe with Red Meat for Dogs" | HIGH |
   | "Blue Buffalo Wilderness" | "Blue Buffalo Life Protection Formula Adult" | MEDIUM (same brand, different line) |
   | "Purina Pro Plan Veterinary Diets HA" | "Purina Pro Plan Complete Essentials Chicken" | MEDIUM (same parent brand, different product) |
   | "Midwestern Pet Foods, Inc." | "Sportmix Original Cat 15lb" | MEDIUM (parent company, needs review) |
   | "Natural Balance L.I.D. Sweet Potato & Fish" | "Natural Balance L.I.D. Limited Ingredient Sweet Potato & Fish Formula" | HIGH |
   | "Sunshine Mills Nurture Farms" | "Purina ONE SmartBlend" | LOW (no brand match) |
   | "Bravo Packing, Inc. Ground Beef" | "Bravo Homestyle Complete Beef Dinner" | MEDIUM (brand match, different product type) |
   | "Hill's Science Diet Adult 7+" | "Hill's Science Diet Adult 7+ Chicken Recipe" | HIGH |
   | "Natural" (generic term in FDA listing) | "Natural Balance LID Fish" | LOW (single generic word) |
   | "Carnivore Meat Company — Vital Essentials" | "Vital Essentials Freeze-Dried Mini Nibs" | HIGH (sub-brand match) |

   Include these as test cases in the Edge Function's test suite.

   d. For HIGH confidence matches:
      - UPDATE products SET is_recalled = true WHERE id = matched_id
      - INSERT into recall_log
   e. For MEDIUM confidence matches:
      - INSERT into recall_review_queue for Steven to verify
   f. Cross-reference recalled products against active pantry items:
      SELECT DISTINCT pi.user_id, p.name, p.brand
      FROM pantry_items pi
      JOIN products p ON pi.product_id = p.id
      JOIN user_settings us ON pi.user_id = us.user_id
      WHERE p.is_recalled = true
      AND pi.is_active = true
      AND us.notifications_enabled = true
      AND us.recall_alerts_enabled = true
      AND pi.user_id NOT IN (
        SELECT user_id FROM recall_notifications
        WHERE product_id = p.id
      )
   g. Send push notification to affected users:
      "Recall Alert: [Brand] [Product Name] has been recalled by
      the FDA. Tap for details."
   h. Log in recall_notifications to prevent duplicates

2. Migration 015: recall tables

   File: supabase/migrations/015_recall_tables.sql

   recall_log:
   - id UUID PK
   - product_id UUID FK → products(id) ON DELETE CASCADE
   - recall_date DATE
   - reason TEXT
   - fda_url TEXT
   - lot_numbers TEXT[]
   - detected_at TIMESTAMPTZ DEFAULT NOW()
   - INDEX on product_id

   recall_review_queue:
   - id UUID PK
   - fda_entry_title TEXT
   - fda_entry_url TEXT
   - matched_product_id UUID FK → products(id) (nullable)
   - match_confidence TEXT CHECK IN ('medium', 'low')
   - reviewed BOOLEAN DEFAULT false
   - reviewed_at TIMESTAMPTZ
   - created_at TIMESTAMPTZ DEFAULT NOW()

   recall_notifications:
   - id UUID PK
   - user_id UUID FK → auth.users(id) ON DELETE CASCADE
   - product_id UUID FK → products(id) ON DELETE CASCADE
   - notified_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(user_id, product_id)

   No RLS on recall_log or recall_review_queue (system tables).
   RLS on recall_notifications (user_id = auth.uid()).

3. Types: src/types/recall.ts

   RecallEntry, RecallNotification interfaces.

Constraints:
- D-125: no premium checks anywhere in recall pipeline
- D-084: no emoji in push notification content
- D-095: factual — "has been recalled by the FDA"
- Conservative matching — false positive recall alerts destroy trust

Show me the plan. Pay special attention to the matching algorithm
and verify it passes all 10 test fixtures.
```

**Review checkpoint:** The matching test fixtures are the contract. If Claude's algorithm doesn't produce the expected confidence for each pair, iterate until it does. This is the most important test suite in the entire Recall Siren.

```
/execute
```

---

### Prompt 2 — Recall UI (ResultScreen Bypass + Detail Screen)

```
/plan

@CLAUDE.md @src/screens/ResultScreen.tsx @src/types/recall.ts

Build the recall UI layer. Two deliverables:

1. Recall bypass on ResultScreen (D-158):

   When a scanned product has is_recalled = true, the scoring
   pipeline returns early with bypass = 'recalled' — same pattern
   as vet diet (D-135) and species mismatch (D-144).

   The bypass chain order becomes:
   vet diet → species mismatch → recalled → variety pack → supplemental → normal

   Add 'recalled' to the BypassReason type union in scoring types.

   In pipeline.ts: add recalled check after species mismatch:
   if (product.is_recalled) return makeBypassResult('recalled')

   ResultScreen recalled bypass view (same visual tier as vet diet):
   - Red recall badge at top (larger/more prominent than vet diet's
     medkit badge)
   - "This product has been recalled by the FDA"
   - Ionicon alert-circle icon
   - "Tap for recall details" → navigates to RecallDetailScreen
   - NO score ring, NO waterfall, NO benchmark bar
   - Ingredient list with severity dots (same as vet diet view)
   - Allergen warnings still shown (safety-critical)
   - "Remove from Pantry" action if product is in active pantry

2. RecallDetailScreen: src/screens/RecallDetailScreen.tsx

   Route: RecallDetail in the navigation stack
   Params: { productId: string }

   Layout:
   - Header: "Recall Alert" with red accent
   - Product info: image + brand + name
   - Recall date
   - Reason for recall (from recall_log)
   - "View FDA Notice" button → opens fda_url in system browser
   - Lot numbers (if available): displayed as a list
   - Actions:
     * "Remove from Pantry" (if product is in active pantry)
     * "Find Alternatives" (navigates to SearchScreen / Top Matches)
   - Disclaimer: "This information is from the FDA's official
     recall database. Contact the manufacturer for return or
     refund instructions."

Design:
- Dark theme, red accent for recall-related elements
- D-084: no emoji
- D-095: factual tone throughout
- RecallDetailScreen accessible from:
  * ResultScreen recall bypass view tap
  * PantryCard recall badge tap
  * Push notification tap (via navigation handler from Session 7)

Show me the plan before writing code.
```

**Review checkpoint:** Verify the recalled bypass follows the same pattern as vet diet (D-135): pipeline returns early, ResultScreen renders the bypass view, no scoring happens. Verify `'recalled'` is added to the `BypassReason` type union.

```
/execute
```

---

### Prompt 3 — Pantry Recall Integration

```
@CLAUDE.md @src/components/pantry/PantryCard.tsx @src/screens/PantryScreen.tsx

Wire recall data into the pantry UI.

Three changes:

1. PantryCard: recalled state already defined in Phase 1 (red badge,
   pushed to top). Verify it reads products.is_recalled and:
   - Renders red "Recalled" badge
   - Left border accent or full-width red bar
   - No score shown (recalled products are bypassed — D-158)
   - Tap navigates to RecallDetailScreen (not EditPantryItemScreen)

2. PantryScreen: if ANY active pantry item is recalled, show a
   persistent alert bar at the very top (above diet completeness
   banner):
   "Recall Alert: [N] product(s) in [Pet Name]'s pantry have been
   recalled. Tap to review."

3. HomeScreen: add a recall alert card to the dashboard (top priority).
   "Recall Alert: [Product Name] has been recalled. [Pet Name]
   may be affected."
   Tap → RecallDetailScreen.

All recall UI is FREE (D-125). No premium checks anywhere.
```

**`/clear` after this prompt.** Recall Siren complete. Session 9 is Pet Appointments.

---

## Session 9: Pet Appointments

**Context is fresh.**

---

### Prompt 1 — Appointment Schema + Service

```
/plan

@CLAUDE.md @DECISIONS.md

Starting M5 Session 9: Pet Appointments (D-103).

Read D-103 in DECISIONS.md fully before planning.

Two deliverables:

1. Migration 016: appointments table

   File: supabase/migrations/016_appointments.sql

   pet_appointments:
   - id UUID PK
   - user_id UUID FK → auth.users(id) ON DELETE CASCADE
   - type TEXT NOT NULL CHECK IN ('vet_visit', 'grooming',
     'medication', 'vaccination', 'other')
   - custom_label TEXT (only when type = 'other')
   - scheduled_at TIMESTAMPTZ NOT NULL
   - pet_ids UUID[] NOT NULL
   - location TEXT
   - notes TEXT
   - reminder TEXT DEFAULT '1_day' CHECK IN ('off', '1_hour',
     '1_day', '3_days', '1_week')
   - recurring TEXT DEFAULT 'none' CHECK IN ('none', 'monthly',
     'quarterly', 'biannual', 'yearly')
   - is_completed BOOLEAN DEFAULT false
   - completed_at TIMESTAMPTZ
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - updated_at TIMESTAMPTZ DEFAULT NOW()

   RLS: user_id = auth.uid()

   Indexes:
   - idx_appointments_user_upcoming ON (user_id, scheduled_at)
     WHERE is_completed = false
   - idx_appointments_pet ON pet_appointments USING GIN(pet_ids)

   NOTE: UUID[] for pet_ids instead of junction table. Simple enough
   that array storage is cleaner.

2. src/services/appointmentService.ts

   createAppointment(input): Promise<Appointment>
   updateAppointment(id, updates): Promise<Appointment>
   deleteAppointment(id): Promise<void> (hard delete)
   completeAppointment(id): Promise<Appointment>
     - Sets is_completed = true, completed_at = NOW()
     - If recurring: auto-creates next occurrence
   getUpcomingAppointments(userId, petId?): Promise<Appointment[]>
   getPastAppointments(userId, petId?): Promise<Appointment[]>

   Recurring logic:
   - On complete, if recurring !== 'none': calculate next date,
     create new appointment, completed stays in history.

   Types: src/types/appointment.ts

Premium gating (D-103):
- Free: 2 active appointments max
- Premium: unlimited
- Add canCreateAppointment() to permissions.ts

Show me the plan before writing code.
```

```
/execute
```

---

### Prompt 2 — Appointment UI + Local Reminder Scheduling

```
/plan

@CLAUDE.md @src/types/appointment.ts @src/services/appointmentService.ts

Build appointment UI and local reminder notifications. Four deliverables:

1. AppointmentsListScreen: src/screens/AppointmentsListScreen.tsx

   Accessed from PetHubScreen (Me tab).
   - Segmented control: "Upcoming" | "Past"
   - Each row: type icon (Ionicons), type label, date/time
     (relative for near dates), pet names, location, recurring badge
   - Swipe: complete (upcoming), delete
   - Empty state + "Add Appointment" CTA
   - FAB or header "+" button

2. CreateAppointmentScreen: src/screens/CreateAppointmentScreen.tsx

   Form: type chips (5), date/time picker, pet multi-select
   (default: active pet), location, notes, reminder dropdown,
   recurring dropdown. "Schedule" button.
   Paywall: canCreateAppointment() before opening.

3. AppointmentDetailScreen: src/screens/AppointmentDetailScreen.tsx

   Full detail view, editable. "Save Changes" + "Delete" +
   "Mark Complete" (upcoming only).

4. Local appointment reminder scheduler:
   src/services/appointmentNotificationScheduler.ts

   WHY LOCAL: Same rationale as feeding reminders — appointment
   reminders are time-based alerts that don't need server context.
   The appointment data is on-device.

   scheduleAppointmentReminder(appointment: Appointment):
   - If reminder === 'off': skip
   - Calculate trigger time: scheduled_at - reminder interval
     ('1_hour' = -1h, '1_day' = -24h, '3_days' = -72h, '1_week' = -168h)
   - If trigger time is in the past: skip (appointment is imminent)
   - Schedule via Notifications.scheduleNotificationAsync({
       content: { title, body, data: { type: 'appointment', id } },
       trigger: { date: triggerDate }
     })
   - Store notification ID in AsyncStorage keyed by appointment ID

   cancelAppointmentReminder(appointmentId: string):
   - Cancel scheduled notification, remove from AsyncStorage

   rescheduleAllAppointments(userId: string):
   - Cancel all existing appointment notifications
   - Re-schedule from current appointments
   - Called on: appointment create/edit/delete, app launch

   Notification content (D-084 + D-095):
   - Single pet: "[Pet Name]'s [type] [time_label] at [time]"
   - Multi pet: "[Pet1] & [Pet2]'s [type] [time_label] at [time]"
   - time_label: "in 1 hour" / "tomorrow" / "in 3 days" / "next week"
   - If location: append " — [location]"
   - Examples:
     "Mochi's vet visit tomorrow at 2:00 PM — Paws & Claws"
     "Buster & Milo's grooming in 3 days — March 25 at 10:00 AM"

   Preference check: user_settings.appointment_reminders_enabled AND
   user_settings.notifications_enabled.

Navigation:
- PetHubScreen → AppointmentsListScreen
- Create/detail screens as stack navigation
- Push notification tap → AppointmentDetailScreen

Design: Dark theme, D-084 Ionicons, relative date formatting.

Show me the plan before writing code.
```

```
/execute
```

**`/clear` after this prompt.** Appointments complete. Session 10 is Weekly Digest + HomeScreen + Treat Battery.

---

## Session 10: Weekly Digest + Home Screen + Treat Battery

**Context is fresh.**

---

### Prompt 1 — Weekly Digest Edge Function

```
/plan

@CLAUDE.md @ROADMAP.md

Starting M5 Session 10: Weekly Digest (D-130), HomeScreen updates,
and Treat Battery integration.

Build the weekly digest Edge Function.

File: supabase/functions/weekly-digest/index.ts

Trigger: Supabase cron — Sunday at 9:00 AM UTC
(timezone handling is UTC for v1 — local time is v2 improvement)

Logic:
1. Query all users via user_settings WHERE digest_frequency != 'off'
   AND notifications_enabled = true
   AND has at least one active push token in push_tokens

2. For each user, gather data:
   a. Scan activity: COUNT scans in last 7 days
   b. Pantry state: products running low or empty
   c. Recall alerts: active pantry items with is_recalled = true
   d. Upcoming appointments: next 7 days

3. Build adaptive content:

   ACTIVE user (≥1 scan):
   "[Pet Name] had a busy week! [N] products scanned.
   [Low stock summary]. [Recall alert]."

   INACTIVE user (0 scans):
   "Haven't scanned in a while? [Pet Name]'s pantry has
   [N] items tracked. [Low stock summary]."

   Recall (always include if present):
   "Recall Alert: [Product Name] in [Pet Name]'s pantry."

   Appointments: "[Pet Name]'s [type] coming up on [date]."

4. Single notification per user. Multi-pet: first pet name +
   "and [N] other pets."

5. Daily digest: same logic, "today/yesterday" framing.

Content rules: D-084, D-095, under 200 chars, tap → HomeScreen.

Edge cases:
- No pets → skip
- No pantry, no scans → "Scan your pet's food to see how it
  scores for [Pet Name]."
- Account < 3 days old → skip (don't spam during onboarding)
```

```
/execute
```

---

### Prompt 2 — HomeScreen Dashboard Updates

```
/plan

@CLAUDE.md @src/screens/HomeScreen.tsx @src/stores/usePantryStore.ts

Update HomeScreen to surface pantry, recall, and appointment data.

Add sections (priority order, top to bottom):

1. RECALL ALERT CARD (top if present):
   Red card (#EF4444 at 10% opacity).
   "Recall Alert: [Product Name] has been recalled."
   "[Pet Name] may be affected."
   Tap → RecallDetailScreen. FREE (D-125).

2. PANTRY SUMMARY CARD:
   "[Pet Name]'s Pantry" + pet photo (32×32).
   "[N] items tracked" + low stock / empty callouts.
   Tap → PantryScreen. Empty: "Start tracking" + scan CTA.

3. UPCOMING APPOINTMENT (if any):
   Single row: "[Icon] [Pet Name]'s [type] — [relative date]"
   Soonest appointment only. Tap → AppointmentDetailScreen.
   If none: don't render section.

4. SCAN COUNTER (existing — keep position).

5. RECENT SCANS (existing — keep).

Data: load on screen focus, skeleton while loading.
Design: #242424 cards, red accent for recall, D-084 Ionicons.
```

```
/execute
```

---

### Prompt 3 — Treat Battery Pantry Integration

```
@CLAUDE.md @src/components/TreatBatteryGauge.tsx @src/stores/usePantryStore.ts

Wire pantry treat logging into TreatBatteryGauge.

Currently, treats added to pantry are inventory tracking only —
the TreatBatteryGauge doesn't know about them. This prompt
connects the two.

Behavior:
When a user taps "Gave a treat" on a pantry treat card (or
logs a treat via Me tab D-124 flow):
1. Deduct 1 unit from pantry_items.quantity_remaining
2. Resolve kcal_per_unit for the product (from label or D-149
   Atwater). If null → skip step 3 (can't deduct what we can't
   measure).
3. Deduct kcal_per_unit from TreatBatteryGauge's remaining
   daily budget.

Implementation:

1. Add to usePantryStore (or a new useTreatBatteryStore):
   logTreat(pantryItemId: string): Promise<void>
   - Calls updatePantryItem to deduct 1 from quantity_remaining
   - Resolves product's kcal_per_unit via resolveCalories()
   - If kcal available: deducts from daily treat budget
   - Updates TreatBatteryGauge display

2. TreatBatteryGauge additions:
   - New prop or store value: consumedTreatKcal (number)
   - Gauge renders: (budget - consumed) / budget as remaining %
   - "consumed" resets daily (midnight or first app open of day)
   - Display: "3 of 5 treats today" or "120 of 200 kcal today"
     (whichever is more meaningful — if kcal_per_unit known,
     show kcal; if not, show count)

3. PantryCard for treats:
   - Add "Gave a treat" button (small, below unit count)
   - On tap: calls logTreat(), shows brief toast confirmation
   - Decrements the unit count on the card immediately (optimistic)

4. Daily reset:
   - consumedTreatKcal resets to 0 at midnight
   - Simple: check last_reset_date in AsyncStorage on app launch.
     If it's a new day, reset consumed to 0.

Premium: TreatBatteryGauge with pantry integration is premium
(already gated — free users have 1 pet and basic gauge).

Do NOT modify scoring engine. This is UI + pantry service only.

Tests:
- logTreat deducts from quantity_remaining
- logTreat resolves kcal and deducts from battery
- logTreat with null kcal: deducts quantity, skips battery
- Daily reset clears consumed kcal
- Gauge renders correct remaining percentage
```

**`/clear` after this prompt.** Session 11 is the final audit.

---

### Prompt 4 — Notification Preferences Screen

```
@CLAUDE.md @src/services/pushService.ts

Build notification preferences screen.

Screen: src/screens/NotificationPreferencesScreen.tsx

Layout:
- Header: "Notifications"

- GLOBAL TOGGLE: "Enable Notifications" — master switch.
  "Turn off all Kiba notifications including feeding reminders,
  recall alerts, and appointment reminders."

- FEEDING SECTION (when global = on):
  "Feeding Reminders" — toggle
  "Low Stock Alerts" — toggle
  "Empty Alerts" — toggle

- RECALL SECTION (when global = on):
  "Recall Alerts" — toggle. Confirmation on disable:
  "Recall alerts help protect [Pet Name] from unsafe food.
  Are you sure?"

- APPOINTMENTS SECTION (when global = on):
  "Appointment Reminders" — toggle

- DIGEST SECTION (when global = on):
  "Weekly Digest" — selector: Weekly / Daily / Off

Persistence:
- Reads/writes user_settings table (migration 014).
- Each toggle maps to a column.
- On feeding_reminders_enabled change: call
  rescheduleAllFeeding() (local notifications)
- On appointment_reminders_enabled change: call
  rescheduleAllAppointments() (local notifications)
- Global kill switch overrides all — both server-side
  (Edge Functions check) and client-side (cancel all local
  notifications when disabled).

Navigation: PetHubScreen → Settings → NotificationPreferencesScreen
```

After execution, verify all toggles work and preferences persist.

**`/clear` after this prompt.** Session 11 is the compliance audit.

---

## Session 11: Compliance Audit + M5 Wrap

**Context is fresh. This is the final session.**

---

### Prompt 1 — Compliance Audit

```
/plan

M5 is feature-complete. Run a full compliance audit across ALL M5
files (everything created or modified in Sessions 1–10).

Audit each D-number. For each, report PASS or FAIL with evidence.

D-084 — Zero Emoji:
  grep -rn '[\x{1F600}-\x{1F9FF}]' src/
  Check all notification content strings — both local notification
  schedulers (feedingNotificationScheduler, appointmentNotificationScheduler)
  AND server-side Edge Functions (auto-deplete, recall-check, weekly-digest).

D-094 — Suitability Framing:
  Every score display in M5 must include pet name context.
  Grep for score rendering in: PantryCard, PantryScreen,
  SearchScreen (Top Matches), HomeScreen pantry summary.
  Scores must show "[X]% match" — never a naked number.

D-095 — UPVM Compliance:
  grep -rni "prescribe\|treat\|cure\|prevent\|diagnose" src/
  grep -rni "you should\|we recommend\|avoid\|must feed" src/
  Check diet completeness, recall, appointment, and digest copy.

D-125 — Recalls Free:
  grep -rn "canSearch\|isPremium\|canHave\|paywall" in all recall-
  related files. ZERO premium checks on recall features.

D-129 — Allergen Override:
  Verify pantry uses per-pet scores (not base_score from products).

D-135 — Vet Diet Bypass:
  Verify vet diet in pantry shows badge, no score.
  Verify excluded from batch scoring.

D-136 — Supplemental:
  Verify supplemental badge, diet completeness logic,
  Top Matches includes supplementals (65/35/0).

D-144 — Species Mismatch:
  Verify add-to-pantry blocked. Share picker same-species only.

D-145 — Variety Pack:
  Verify can add to pantry. Excluded from batch scoring.

D-151 — Nursing Advisory:
  Verify suppression for pets under 4 weeks.

D-158 — Recalled Product Bypass:
  Verify pipeline bypass in pipeline.ts.
  Bypass chain: vet diet → species mismatch → recalled → variety pack →
  supplemental → normal.
  Verify 'recalled' in BypassReason type.
  Verify ResultScreen recalled view: no score ring, red badge +
  ingredients.
  Verify excluded from batch scoring.
  Verify pantry cards: no score.

D-152 through D-157 — Pantry Decisions:
  Verify each per PANTRY_SPEC.md §13.

After audit, report PASS/FAIL per D-number with file:line evidence.
Fix violations immediately. Report grep commands used.
```

```
/execute
```

---

### Prompt 2 — Regression + Integration Verification

```
Run full regression and integration verification:

1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all tests pass. Report total count.
3. Pure Balance regression = 62 (client + batch)
4. Temptations regression = 9

5. Full feature verification (PASS/FAIL each):

   PANTRY:
   - Add dry food (weight mode)
   - Add wet food (unit mode, fractional, dynamic label)
   - Add treat (unit mode, no depletion breakdown)
   - Depletion breakdown: unit mode live update
   - Depletion breakdown: weight mode with/without calorie data
   - Vet diet in pantry (badge, no score, countdown)
   - Variety pack in pantry (badge, no score)
   - Species mismatch blocked
   - Duplicate UPC → restock prompt
   - Edit item (quantity, serving, schedule, unit label)
   - Restock empty item
   - Remove single-pet / shared item
   - Mixed feeding removal → D-157 nudge
   - Share (premium, same-species)
   - Share blocked for free users
   - Filter chips filter correctly
   - Sort menu changes order
   - Progress bar on cards (green/amber/red)
   - Treats: no progress bar, calorie context, depletion
   - Diet completeness: no warning / amber / red
   - Low stock at ≤5 days/units
   - Empty: grayed, bottom, notification
   - Calorie context line (shown / hidden / estimated)
   - Goal weight DER (premium) vs current weight DER (free)
   - Offline write blocked with toast
   - Offline read from cache
   - Per-pet isolation on pet switch

   TOP MATCHES:
   - First load triggers batch scoring (4-6 sec)
   - Scores sorted by match %
   - Category filter, text search
   - Tap → ResultScreen with fresh score
   - Cache invalidation: life stage, profile edit, health change

   RECALL SIREN:
   - Recalled product → D-158 pipeline bypass
   - ResultScreen: no score, red badge + ingredients
   - Recalled pantry item: no score, red badge, top of list
   - Pantry alert bar for recalled items
   - HomeScreen recall card
   - RecallDetailScreen with FDA link
   - Recall push notification (free)
   - Recall matching: passes all 10 test fixtures

   APPOINTMENTS:
   - Create all types
   - Multi-pet assignment
   - Recurring: complete → next auto-created
   - Local reminder notification at correct interval
   - Free tier: 2 active max
   - Past appointments archived
   - PetHubScreen shows upcoming

   NOTIFICATIONS:
   - Local feeding reminders at scheduled times
   - Multi-pet grouped feeding notification
   - Auto-depletion cron ticks correctly
   - Low stock push notification (once per crossing)
   - Empty push notification at 0
   - Local appointment reminders fire correctly
   - Notification preferences toggles work
   - Global kill switch disables all (local + server)
   - Dead token cleanup (410 → is_active = false)

   TREAT BATTERY:
   - "Gave a treat" deducts from pantry quantity
   - kcal deducted from TreatBatteryGauge
   - Null kcal: quantity deducts, gauge skips
   - Daily reset of consumed kcal
   - Gauge shows correct remaining %

   HOME SCREEN:
   - Recall alert card (top)
   - Pantry summary card
   - Upcoming appointment row
   - Scan counter (unchanged)
   - Recent scans (unchanged)

   WEEKLY DIGEST:
   - Active user message with scan count
   - Inactive user re-engagement nudge
   - Recall included regardless of activity
   - Upcoming appointment included
   - Frequency preference respected

6. Document ALL results in session11-m5-results.md
Do NOT fix failures — document only.
```

---

### Prompt 3 — M5 Summary Document

```
M5 is complete and audit-verified. Write two documents:

1. session11-m5-progress.md — standard session progress doc

2. M5-SUMMARY.md — comprehensive milestone summary:

## M5 Completion Status
- Total files created/modified
- Total test count
- All tests passing: yes/no
- Migrations: 011 (pantry), 012 (pet_product_scores), 013 (push_tokens),
  014 (user_settings), 015 (recall), 016 (appointments)

## Screen Inventory
- PantryScreen, EditPantryItemScreen, RecallDetailScreen,
  AppointmentsListScreen, CreateAppointmentScreen,
  AppointmentDetailScreen, NotificationPreferencesScreen,
  SearchScreen (Top Matches)
For each: route, key features, decisions implemented.

## Component Library (M5 additions)
- PantryCard, AddToPantrySheet, SharePantrySheet, DietCompletenessBanner

## Service Layer
- pantryService, topMatches, appointmentService, pushService, pantryHelpers
- feedingNotificationScheduler, appointmentNotificationScheduler

## Store Changes
- usePantryStore, useTopMatchesStore

## Edge Functions (3 server-side cron)
- auto-deplete: 30min cron, depletion + empty/low stock push
- recall-check: daily cron, FDA RSS + matching + push
- weekly-digest: weekly cron, adaptive content push

## Local Notification Schedulers (2 client-side)
- feedingNotificationScheduler: daily repeating, multi-pet grouped
- appointmentNotificationScheduler: one-shot per reminder interval

## Compliance Audit
D-084, D-094, D-095, D-125, D-129, D-135, D-136, D-144, D-145,
D-151, D-152–D-157, D-158: [pass/fail per decision]

## Regression Targets
- Pure Balance (client): 62, (batch): 62
- Temptations: 9

## M6 Dependencies
- Pantry data, Top Matches cache, score data, recall data

## Known Limitations
- Cups-to-lbs: standard approximation (no per-product density)
- FDA matching: conservative (medium queued for review)
- Timezone: UTC for cron functions (v2 improvement)
- Scoops ≈ cups in depletion math
- Auto-depletion may drift vs actual feeding
```

Final commit: `M5: Session 11 — compliance audit, integration verification, milestone summary`
Tag: `m5-complete`

---

## M5 Polish (After All Sessions)

- **Per-product density data:** Replace cups-to-lbs approximation.
- **Timezone-aware cron:** Local time scheduling for weekly digest.
- **Loading screen polish:** Data-driven terminal sequence.

---

## Phase 2 Summary Checklist

After Sessions 7–11:

- [ ] Push token registration + user_settings tables working
- [ ] Local feeding reminders fire at scheduled times with multi-pet grouping
- [ ] Auto-depletion cron ticks quantities for daily items
- [ ] Low stock + empty push notifications fire at correct thresholds
- [ ] Recall Siren: FDA RSS, matching (10 test fixtures pass), pantry cross-reference, push
- [ ] Recalled products use pipeline bypass (D-158)
- [ ] RecallDetailScreen with FDA link
- [ ] HomeScreen: recall card, pantry summary, upcoming appointment
- [ ] Pet Appointments: CRUD, recurring, local reminders, premium gate (2 free)
- [ ] Weekly Digest: adaptive content, frequency preference
- [ ] Notification preferences screen with per-category toggles
- [ ] Treat Battery wired: "Gave a treat" deducts quantity + kcal from gauge
- [ ] D-158 implemented in pipeline.ts
- [ ] All D-number compliance verified via grep audit
- [ ] Pure Balance = 62 (client + batch), Temptations = 9
- [ ] `npx tsc --noEmit` = 0, all tests pass

---

## Full M5 Decision Reference

| D-Number | Topic | Used In |
|----------|-------|---------|
| D-052 | Multi-pet premium gate | S2-P2, S3-P2, S3-P3, S9-P1 |
| D-065 | Bag countdown + low stock | S1-P4, S3-P1, S7-P3 |
| D-084 | Zero emoji | All sessions — audit in S11-P1 |
| D-094 | Suitability framing | S3-P1, S6-P1, S11-P1 |
| D-095 | UPVM / Clinical Copy | S3-P2, S7-P2, S7-P3, S8-P2, S9-P2, S10-P1, S11-P1 |
| D-101 | Feeding schedule + auto-depletion | S1-P3 (schema), S7-P2 (local scheduler), S7-P3 (cron) |
| D-103 | Pet Appointments | S9-P1, S9-P2 |
| D-124 | Treat logging entry point | S2-P2, S10-P3 |
| D-125 | Recalls free | S8-P1, S8-P2, S8-P3, S11-P1 |
| D-129 | Allergen override | S5-P1, S11-P1 |
| D-130 | Weekly Digest | S10-P1 |
| D-135 | Vet diet bypass | S2-P2, S5-P1, S11-P1 |
| D-136 | Supplemental + diet completeness | S1-P4, S3-P1, S3-P2, S11-P1 |
| D-144 | Species mismatch | S2-P1, S3-P3, S11-P1 |
| D-145 | Variety pack | S2-P1, S5-P1, S11-P1 |
| D-146 | Supplemental name detection | S5-P1 |
| D-149 | Atwater calorie estimation | S1-P4, S2-P1, S6-P2, S10-P3 |
| D-150 | Life stage mismatch | S4-P1 |
| D-151 | Nursing advisory | S1-P4, S11-P1 |
| D-152 | Pantry depletion model | S1-P4, S2-P1, S7-P3 |
| D-153 | Pantry paywall scope | S2-P1, S3-P3 |
| D-154 | Sharing rules | S3-P3 |
| D-155 | Empty item behavior | S3-P1, S3-P2, S7-P3 |
| D-156 | Score source | S1-P4, S3-P1 |
| D-157 | Mixed feeding removal | S3-P2 |
| D-158 | Recalled product bypass | S5-P1 (batch), S8-P2 (pipeline + UI) |

---

## Notes for Steven

**Session 7 is the infrastructure session.** Two migrations (push_tokens + user_settings — separate files), push service, local feeding notification scheduler, and the auto-depletion cron. Test the local notifications by setting a feeding time 2 minutes in the future and waiting.

**Session 8 (Recall Siren) — the 10 matching test fixtures are the contract.** If Claude's algorithm doesn't produce the expected confidence for each pair, iterate until it does. The review queue for medium-confidence catches is your safety net. You'll need to periodically check `recall_review_queue` for entries needing manual verification.

**Session 8 Prompt 2 — D-158 uses the pipeline bypass pattern.** Recalled products are treated like vet diets — pipeline returns early, no scoring. Bypass chain: vet diet → species mismatch → recalled → variety pack → supplemental → normal. Verify `'recalled'` in the `BypassReason` type union.

**Session 9 (Appointments) is self-contained.** Can reorder if needed. Local reminder scheduling replaces the server-side cron approach — simpler, works offline, no Edge Function to maintain.

**Session 10 — Treat Battery integration is the payoff.** This is what makes treats in pantry useful instead of a stub. The work is small (deduct quantity + kcal, daily reset) but the UX impact is significant. If this session runs long, the notification preferences screen (S10-P4) can move to Session 11.

**Session 11 is audit-only.** No new features. Fix failures in follow-up prompts, not in the audit session.

**After M5:** You'll have 3 server-side cron Edge Functions (auto-deplete, recall-check, weekly-digest) and 2 client-side local notification schedulers (feeding, appointments). Monitor Edge Function logs for the first week. The local schedulers are maintenance-free but verify they re-sync on app launch after force-quit.

**Cron function count: 3, not 6.** Feeding reminders and appointment reminders are now local notifications — no server infrastructure. This cuts your operational surface area in half compared to the original plan.
