# Project Status — Last updated 2026-04-02 (session 14)

## Active Milestone
**M9 — UI Polish & Search** (search UX overhaul, general polish, UX friction fixes)

## Last Completed
**M8 — Kiba Index** (April 1, 2026, branch `m5-complete`)

## What Works
- Scan-to-score pipeline: barcode → 3-layer scoring (IQ/NP/FC) → result screen
- 19,058 products (v7 reimport, Chewy + Amazon + Walmart)
- Pet profiles, pantry (auto-deplete, budget-aware servings), treat battery
- Appointments (CRUD, recurring, reminders, health records)
- Push notifications (feeding, low stock, empty, recall, appointment, medication, weight estimate, digest)
- HomeScreen v2, Community tab, Top Matches, RevenueCat paywall
- **Health condition scoring** — 12 conditions (P0-P3), Layer 3 adjustments, cardiac+DCM zero-out
- **Health condition UI** — expanded condition picker (mutual exclusions, sub-types), ResultScreen advisories, medication tracking
- **Weight goal slider (D-160)** — 7-position discrete slider (-3 to +3), cat -3 absent, condition-blocked positions, premium-gated, auto-reset on conflict
- **Caloric accumulator (D-161)** — daily delta tracking in auto-deplete cron, weight estimate push notifications, WeightEstimateSheet (confirm/enter/dismiss), PetHubScreen banner
- **BCS reference (D-162)** — 9-point educational guide, species tabs, tappable selection saves to pet profile, cat primordial pouch callout, free for all users
- **Compare flow** — 9-rule key differences engine, two-column CompareScreen (score breakdown, nutrition table, ingredients), CompareProductPickerSheet (search, recent scans, camera), kcal/cup estimation fallback (DB → kcal/kg × 110g → Atwater), PortionCard kcal/cup display. **"Your Other Pets" section** — collapsible, lazy-loaded scores for other same-species pets on CompareScreen
- **Vet Report PDF** — 4-page diet-centric report via expo-print (no Kiba scores). Pet profile with BCS gauge, caloric summary, combined nutrition with AAFCO checks, supplemental nutrients, flags, weight tracking, per-product detail, condition management notes, owner dietary cards (28 cards × conflict detection), vet notes. Premium-gated via `canExportVetReport()`.
- **Safe Swap curated layout (Plan 2)** — daily dry food gets curated 3-pick (Top Pick / Fish-Based / Great Value). Fish-Based uses `allergen_group = 'fish'` from `ingredients_dict` (not regex). Great Value uses `price / product_size_kg` (migration 023). Fish allergy → Fish-Based replaced with "Another Pick" (2nd highest score). Falls back to generic top-3 if < 2 curated slots fill. All other categories unchanged (generic top-3).
- **Safe Swap simplified** — removed multi-pet chip row, active pet only. Collapsible (default closed), free users see inline premium CTA. Life stage hard filter. Great Value fallback to "Another Pick" when no price data.
- **Batch scoring — Approach F (Delta Scoring + Two-Phase Edge)** — `batchScoreHybrid()` tries Edge Function first (1000 products, two-phase), falls back to client-side (200 products). **Delta scoring:** checks cache maturity (≥80% of products scored) → only fetches new/updated products (near-instant). **Two-Phase Edge:** Phase 1 scores 200 products synchronously (~10s), Phase 2 scores remaining ~800 in background via `EdgeRuntime.waitUntil()` (chunked at 200 with 50ms GC yields). **Cache maturity check:** prevents "delta trap" when Phase 2 fails — triggers healing full batch on next scan. **Per-category rate limit** (scoring treats no longer blocks scoring dry food). All product queries ordered by `updated_at DESC`. Architecture doc: `docs/references/batch-scoring-architecture.md`.
- **Safe Swap filter hardening** — `CANDIDATE_POOL_SIZE` raised from 50 to 300 (6x buffer for exclusion filters). Exclusion queries chunked at 100 IDs (prevents 414 URI Too Long). `fetchBasePool()` filters by cached `is_supplemental` from `pet_product_scores` (D-146 aware, not raw DB value). Supplement category guard (`category = 'supplement'` → excluded). Runtime `isSupplementalByName()` safety net catches future data gaps. `tagFishBased()` also chunked.
- **Supplemental data patch (migration 024)** — 124 products flagged `is_supplemental = true` (toppers, mixers, lickables, sprinkles missed by enrichment pipeline). 2 oil products recategorized from `daily_food` to `supplement` (Pure Balance Salmon Oil, Raw Paws Coconut Oil). AAFCO cleared for supplemental products. Stale `pet_product_scores` cache invalidated.
- **Supplemental classifier expanded** — added `/topping/i` and `/lickable/i` to `SUPPLEMENTAL_NAME_PATTERNS` in `supplementalClassifier.ts`.
- **Price backfill** — 15,781 products updated with price + product_size_kg from v7 dataset. 74.6% of daily food now has price data for Great Value slots.
- **Affiliate link infrastructure (dormant)** — `AffiliateBuyButtons` component on ResultScreen (between PortionCard and Compare button). PantryCard "Reorder" button on low-stock items. `affiliateService.ts` generates Chewy/Amazon URLs from `source_url`/`chewy_sku`/`asin`/`affiliate_links` JSONB. D-020 compliant (zero scoring imports, buttons hidden when score < 50). D-053 compliant (Chewy shows estimated price, Amazon hides price). Config: `enabled: false` — flip on after affiliate program enrollment.
- **Condition-aware feeding frequency** — auto-populate `feedings_per_day` based on pet health conditions when adding to pantry.
- **Safe Switch Guide (M7)** — guided 7-day (dogs) / 10-day (cats) food transition with daily mix ratios (75/25 → 50/50 → 25/75 → 100%). `SafeSwitchSetupScreen` (preview + start), `SafeSwitchDetailScreen` (daily command center with proportion bar, tummy check pills, vertical timeline). `SafeSwitchBanner` on PantryScreen (day ring + mix ratio) and HomeScreen (compact status card). Entry points: "Switch to this" on Safe Swap cards, "Find a replacement" on low-scoring (<60%) daily food PantryCards. Daily notifications (9 AM mix reminder, 7 PM tummy check nudge). Upset advisory (2+ consecutive "upset" logs → informational card, D-095 compliant, no auto-action). One active switch per pet enforced at DB level (partial unique index). Free feature (no paywall gate). Migration 025.
- **Vet diet data fix (migration 027)** — restored 483 `is_vet_diet` flags lost during v7 reimport. D-135 bypass operational again. `import_products.py` updated to map `_is_vet_diet`.
- **MeScreen overhaul** — unified "Medical Records" card (vaccines + dewormings chronological, micro-icons, top 3 truncation + "See All"). `MedicalRecordsScreen` full-screen timeline. `HealthRecordDetailSheet` for edit/delete. `updateHealthRecord()` + `deleteHealthRecord()` service functions. Appointments card: persistent "+ Schedule" and "See All" links. Medication rows: chevrons. Matte Premium visual polish (`cardSurface`, `hairlineBorder` tokens). Score accuracy bar gradient.
- **SwipeableRow component** — reusable swipe-to-reveal wrapper (`src/components/ui/SwipeableRow.tsx`). Swipe left → delete (with confirmation alert + `deleteConfirm()` haptic). Swipe right → edit. Applied to: health record rows, medication rows, appointment rows on PetHubScreen, MedicalRecordsScreen, MedicationsListScreen, and AppointmentsListScreen.
- **MedicationsListScreen** — full-screen medication list with Current/Past segmented tabs, SwipeableRow (delete + edit), status dots. Access: PetHubScreen Medications card → chevron or "See All".
- **PetHubScreen card reorder** — Health Conditions → Appointments → Medications → Medical Records. All three data cards follow consistent pattern: title+chevron header, truncated list (max 3), "See All" link, bottom-anchored add CTA.
- **Medication reminders + duration** — MedicationFormScreen: up to 4 daily reminder times via DateTimePicker, duration presets (7/14/30/90 days + Ongoing + custom). `medicationNotificationScheduler.ts` (full-resync pattern, groups same-time reminders, skips expired meds). `medication_reminder` notification type + tap routing. NotificationPreferencesScreen toggle. Migration 028 (`reminder_times TEXT[]`, `duration_days INTEGER`, `medication_reminders_enabled BOOLEAN`).
- **Matte Premium design system** — `.agent/design.md` established. Tokens, card anatomy, typography, spacing, bottom sheet specs, anti-patterns, screen polish checklist. Referenced in CLAUDE.md spec table — read before touching any screen UI.

## What's Broken / Known Issues
- No pre-existing TS errors

## Numbers
- **Tests:** 1320 passing / 61 suites
- **Decisions:** 129 (D-001 through D-167, non-sequential, D-053 revised)
- **Migrations:** 28 (001–028)
- **Products:** 19,058 (483 vet diets, 1716 supplemental-flagged)

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 57 (fat >12% DMB penalty)

## Up Next
- Pantry polish — SwipeableRow on PantryCards, legacy token migration
- Legacy token migration across remaining screens (HomeScreen, ResultScreen, CompareScreen, etc.)
- Search UX overhaul on HomeScreen
- Enroll in Chewy Affiliate Partners + Amazon Associates → flip `affiliateConfig.ts` enabled: true
- M10: Community points (XP engine, streaks, product submissions — lite scope)
- M11: Symptom Detective (deferred — major App Store update feature)

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-04-02 (session 14)
- **Accomplished:** M9 — PetHubScreen card fixes, MedicationsListScreen, medication reminders + duration, design system integration.
  - **Medications card alignment:** Replaced header `add-circle-outline` icon with `chevron-forward` navigating to MedicationsListScreen. Added persistent bottom-anchored `+ Add Medication` CTA. Truncated current meds to 3 with "See All" link. Removed inline past meds toggle.
  - **Card reorder:** PetHubScreen cards now: Health Conditions → Appointments → Medications → Medical Records.
  - **MedicationsListScreen:** New `src/screens/MedicationsListScreen.tsx` — Current/Past segmented tabs, SwipeableRow (delete + edit), status dots (green/amber/gray), empty states per tab.
  - **AppointmentsListScreen SwipeableRow:** Added SwipeableRow wrapping — swipe-left to delete, swipe-right to edit.
  - **MedicationForm button fix:** `paddingBottom: 88` to clear tab bar scan button.
  - **Medication reminders + duration:** Up to 4 daily reminder times via DateTimePicker (iOS spinner + Android modal). Duration presets (7/14/30/90 days, Ongoing) + custom days input. Reminders/duration only shown when status is Current or As Needed. Auto-clear on Past status.
  - **Medication notification scheduler:** `src/services/medicationNotificationScheduler.ts` — full-resync pattern (cancel + rebuild), groups same-time reminders across pets, skips expired medications, DAILY repeating triggers.
  - **Notification type + routing:** Added `medication_reminder` to `NotificationType`, tap routes to Me tab.
  - **Notification preferences:** Added `medication_reminders_enabled` toggle to NotificationPreferencesScreen + UserSettings type + migration 028.
  - **Design system integration:** Added `.agent/design.md` to CLAUDE.md spec table as mandatory pre-read for UI work. Updated SwipeableRow tables and legacy token migration lists.
  - **Legacy token migration:** MedicationFormScreen inputs migrated from `Colors.card`/`Colors.cardBorder` to `cardSurface`/`hairlineBorder`.
  - **Files created:** `src/screens/MedicationsListScreen.tsx`, `src/services/medicationNotificationScheduler.ts`, `supabase/migrations/028_medication_reminders.sql`
  - **Files modified:** `src/screens/PetHubScreen.tsx`, `src/screens/MedicationFormScreen.tsx`, `src/screens/AppointmentsListScreen.tsx`, `src/screens/NotificationPreferencesScreen.tsx`, `src/types/navigation.ts`, `src/types/pet.ts`, `src/types/notifications.ts`, `src/utils/notifications.ts`, `src/navigation/index.tsx`, `App.tsx`, `CLAUDE.md`, `.agent/design.md`, `src/screens/CLAUDE.md`, `__tests__/services/petService.conditionDetails.test.ts`, `docs/status/CURRENT.md`
- **Not done yet:**
  - Pantry polish (SwipeableRow on PantryCards, legacy token migration)
  - Legacy token migration on remaining screens (AppointmentsListScreen, HomeScreen, ResultScreen, CompareScreen, EditPantryItemScreen)
  - Search UX overhaul on HomeScreen
  - Kiba Index end-to-end testing on iOS simulator
  - Affiliate buttons still dormant — waiting on Chewy/Amazon enrollment
  - Migration 028 needs to be applied to production Supabase (3 ALTER TABLE statements)
- **Next session should:** Apply migration 028 to Supabase. Polish Pantry screen (SwipeableRow on PantryCards + Matte Premium tokens). Migrate legacy tokens on AppointmentsListScreen. Define search UX scope.
- **Gotchas for next session:**
  - `.agent/design.md` is now in CLAUDE.md spec table — read before touching any screen UI.
  - `Colors.card` and `Colors.cardBorder` are legacy tokens — grep and migrate when touching a screen.
  - SwipeableRow: only PantryScreen remains in "Still Needs" table.
  - Migration 028 adds `reminder_times TEXT[]`, `duration_days INTEGER` to `pet_medications` and `medication_reminders_enabled BOOLEAN` to `user_settings`. Must be applied before medication reminders work.
  - Affiliate buttons still dormant — waiting on Chewy/Amazon enrollment.
  - `life_stage_claim` still free text (no enum validation) — deferred as tech debt.
- **Decision/scoring changes:** No new decisions. No scoring logic changed. Migration 028 is schema-only (new columns with defaults).
