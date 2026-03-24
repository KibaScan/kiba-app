# Session Changes — March 22, 2026

## 1. Create Appointment Screen — Footer hidden behind tab bar

**File:** `src/screens/CreateAppointmentScreen.tsx`

The "Schedule" button footer was hidden behind the absolute-positioned tab bar (height: 88px). Changed footer `paddingVertical` to explicit `paddingTop` + `paddingBottom: 96` to push the button above the tab bar.

---

## 2. Dev Premium Override

**File:** `src/utils/permissions.ts`

Added `__DEV__` override so `isPremium()` returns `true` in dev builds for testing premium features. Production builds are unaffected.

```ts
let _devOverride: boolean | null = __DEV__ ? true : null;
```

---

## 3. Pantry Screen — Compact Pet Carousel

**File:** `src/screens/PantryScreen.tsx`

Redesigned the pet carousel to reduce vertical space consumption. Key style changes:
- Header padding tightened (`paddingTop: 10`, `paddingBottom: 0`)
- Carousel `marginBottom: 0` (flush with filter row)
- Larger avatars for readability: 44x44 active / 36x36 inactive (up from 40/32)
- Filter row margin reduced (`Spacing.xs` instead of `Spacing.sm`)
- Carousel content padding tightened with `paddingTop: 2`, `paddingBottom: Spacing.xs`

Note: Attempted inline header approach broke pet switching; reverted to separate `ScrollView` carousel pattern which is proven working.

---

## 4. SharePantrySheet — UX Fix: Share/Sharing Labels

**File:** `src/components/pantry/SharePantrySheet.tsx`

The blue checkmark toggle was confusing — users interpreted it as "confirm" and tapped it again, which toggled sharing OFF (deleting the assignment). Added text labels next to the checkbox:
- Unshared state: "Share" (gray text) + empty circle
- Shared state: "Sharing" (accent color text) + filled checkmark

New styles: `toggleRow`, `toggleLabelActive`, `toggleLabelInactive`.

---

## 5. SharePantrySheet — Per-Pet DER-Based Serving Size

**File:** `src/components/pantry/SharePantrySheet.tsx`

Previously, sharing copied the active pet's serving size to all shared pets. Now calculates a DER-based serving size per target pet using existing D-165 functions:
- `computePetDer(pet, canUseGoalWeight())` — calculates daily energy requirement
- `computeAutoServingSize(petDer, feedingsPerDay, product)` — converts to cups/units

Fallback: if pet has no weight or product has no calorie data, uses the active pet's serving size or default (1 cup).

---

## 6. Database Migrations 011–019 Applied

Discovered migrations 011–019 had never been applied to Supabase, despite being written. This was the root cause of pantry sharing failures — the `pantry_pet_assignments` table (created in 011) didn't exist. All queries to it failed silently (caught by `try/catch` returning `[]`).

Applied in order:
- **011** — `pantry_items` (new schema) + `pantry_pet_assignments` (junction table)
- **012** — `pet_product_scores` (Top Matches cache)
- **013** — `push_tokens` (Expo push notifications)
- **014** — `user_settings` (notification preferences)
- **015** — `auto_deplete_cron` (30-min pantry depletion)
- **016** — `recall_tables` (recall_log, recall_review_queue, recall_notifications)
- **017** — `pet_appointments` + `pet_health_records`
- **018** — `digest_cron` (weekly/daily digest schedules)
- **019** — `unit_label_servings` (collapse cans/pouches/units to 'servings')

---

## 7. Debug Logging (added then removed)

Temporarily added `console.log` statements to `pantryService.ts` for diagnosing the sharing issue:
- `sharePantryItem` — full Supabase response + verification query
- `getPantryForPet` — Step 1 assignment count + error logging in catch block

The `sharePantryItem` debug logs were removed after confirming the issue was missing migrations + UX toggle confusion. The `getPantryForPet` catch block retains `console.error` (was previously silent `catch {}`).
