# CLAUDE.md — Kiba Project Context

> Single source of context for Claude Code. Keep lean — details live in spec files.
> Full architecture + common tasks guide: `.cursorrules` (also at `.github/copilot-instructions.md`)
> Last updated: March 20, 2026 — M5 in progress, 862 tests/43 suites.

---

## Project Overview

Kiba (kibascan.com) — pet food scanner iOS app, "Yuka for pets." Scan barcode → ingredient-level safety score 0-100, species-specific for dogs and cats.

**Owner:** Steven (product decisions, non-coder) | **Developer:** Claude Code
**Current phase:** M5 Pantry + Recall Siren

**Tech Stack:** Expo (React Native) + TypeScript strict | Zustand | Supabase (Postgres + Auth + Storage + RLS + pg_cron) | React Navigation | `expo-camera` | RevenueCat | `expo-av` | Jest (862 tests) | `react-native-svg` | `expo-blur` | `@react-native-community/netinfo` | `@react-native-community/datetimepicker`

## Spec Files — Read Before Changing

| File | What it covers |
|------|---------------|
| `DECISIONS.md` | 162 decisions (D-001–D-162) — check before implementing. D-152: pantry depletion (user-set servings, not DER-computed). D-153: pantry paywall (goal-weight DER only). D-154: sharing rules (active pet default, same-species, premium). D-155: empty item (gray out, sink, restock/remove). D-156: score source (live read, not snapshot). D-157: mixed feeding removal (no auto-rebalance, contextual nudge). D-158: recalled product bypass (no score, warning + ingredients). D-160: weight goal slider replaces raw goal weight (D-061 superseded), 7 levels (-3 to +3), cat cap at -2. D-161: caloric accumulator estimates weight drift from feeding data, notify-and-confirm. D-162: BCS reference tool (educational only, not diagnostic, M6+). |
| `ROADMAP.md` | Milestone plan, M5 scope |
| `docs/references/scoring-rules.md` | **Full scoring engine rules** — 3 layers, weights, curves, all mechanics |
| `docs/specs/NUTRITIONAL_PROFILE_BUCKET_SPEC.md` | NP bucket: AAFCO thresholds, DMB, trapezoidal curves |
| `docs/specs/BREED_MODIFIERS_DOGS.md` / `_CATS.md` | Breed data (23 dogs, 21 cats) |
| `docs/specs/PET_PROFILE_SPEC.md` | Profile fields, conditions, allergens |
| `docs/specs/PORTION_CALCULATOR_SPEC.md` | RER/DER math, goal weight, cat safety guards |
| `docs/specs/PANTRY_SPEC.md` | M5 Pantry schema, depletion, UI, edge cases |
| `docs/plans/TOP_MATCHES_PLAN.md` | Top matches recommendation plan |
| `docs/references/dataset-field-mapping.md` | Apify → Supabase field mapping |

**Key code paths:** `src/services/scoring/` (engine.ts orchestrator), `src/utils/constants.ts` (Colors, SCORING_WEIGHTS, SEVERITY_COLORS, getScoreColor()), `src/utils/permissions.ts` (ONLY paywall location), `src/services/pantryService.ts` (pantry CRUD + offline guards), `src/utils/pantryHelpers.ts` (depletion math, calorie context, pure functions), `src/types/pantry.ts` (all pantry types + PantryOfflineError), `src/components/pantry/PantryCard.tsx` (pantry list item card + "Gave a treat" button), `src/components/pantry/AddToPantrySheet.tsx` (add-to-pantry bottom sheet), `src/components/pantry/SharePantrySheet.tsx` (share item with other same-species pets), `src/stores/usePantryStore.ts` (Zustand pantry state + logTreat action), `src/stores/useTreatBatteryStore.ts` (daily treat consumption tracker — per-pet kcal/count, midnight reset, AsyncStorage persist), `src/screens/PantryScreen.tsx` (pantry tab screen — filter/sort, diet banner, pet carousel, remove/restock flows), `src/screens/EditPantryItemScreen.tsx` (edit pantry item — quantity, feeding, schedule, auto-save, recalled/empty states), `src/services/feedingNotificationScheduler.ts` (client-side local feeding notifications, multi-pet grouped), `src/services/topMatches.ts` (Top Matches cache freshness, query, batch trigger), `supabase/functions/batch-score/` (Deno Edge Function — bulk scores all products for a pet, upserts into pet_product_scores; `scoring/` subfolder is verified engine copy), `supabase/functions/auto-deplete/` (Deno Edge Function — 30-min cron deducts pantry quantities, sends low stock/empty push via Expo Push API, daily-total deduction with idempotency guard), `src/services/appointmentService.ts` (appointment CRUD + recurring logic + offline guards), `src/types/appointment.ts` (appointment types), `src/services/appointmentNotificationScheduler.ts` (local one-shot reminders via expo-notifications, DATE trigger, full resync on create/edit/delete/launch), `src/screens/AppointmentsListScreen.tsx` (upcoming/past segmented list, relative dates, paywall gate), `src/screens/CreateAppointmentScreen.tsx` (form with type chips, DateTimePicker, pet multi-select), `src/screens/AppointmentDetailScreen.tsx` (edit, mark complete, delete with confirmation), `src/screens/NotificationPreferencesScreen.tsx` (global + per-category notification toggles, digest frequency, reschedule on toggle), `supabase/functions/weekly-digest/` (Deno Edge Function — weekly/daily digest push via pg_cron, adaptive content from scans/pantry/recalls/appointments, single notification per user), `supabase/migrations/` (001–018)

## Score Framing (D-094)

All scores: `"[X]% match for [Pet Name]"` — NEVER naked scores. Two color scales in `getScoreColor()`: green family (daily food), teal/cyan family (supplemental), converge at yellow/amber/red. 360° ring = daily food + treats, 270° arc = supplemental.

## Scoring Engine — Quick Reference

Full rules in `docs/references/scoring-rules.md`. Read that file before any scoring changes.

| Category | IQ | NP | FC |
|----------|----|----|-----|
| Daily Food | 55% | 30% | 15% |
| Supplemental | 65% | 35% (macro-only) | 0% |
| Treats | 100% | 0% | 0% |

**Regression anchors:** Pure Balance (Dog) = 62, Temptations (Cat Treat) = 9

## Schema Traps

- `pets` table (NOT `pet_profiles`): `weight_current_lbs` (NOT `weight_lbs`), `date_of_birth` (NOT `birth_date`), `is_neutered` (NOT `is_spayed_neutered`), `life_stage` (derived, never user-entered), `health_reviewed_at` (null = never visited). D-160: `weight_goal_lbs` → `weight_goal_level SMALLINT` (-3 to +3, default 0), cat cap at -2. D-161: `caloric_accumulator` + `accumulator_last_reset_at` (estimated weight tracking).
- `product_upcs` — junction table (UPC → product_id), NOT TEXT[] array
- `ingredients_dict` — `is_pulse`/`is_pulse_protein` for DCM (NOT `is_legume`), `position_reduction_eligible`, `cluster_id` for splitting (NEVER string matching)
- `products` — `is_supplemental`, `is_vet_diet`, `affiliate_links` JSONB (invisible to scoring)
- `pantry_items` — user-owned inventory (NO `pet_id`), `serving_mode` ('weight'|'unit'), `unit_label` ('cans'|'pouches'|'units'), soft-delete via `is_active`
- `pantry_pet_assignments` — per-pet serving config, `feeding_times` is JSONB (`string[] | null`), UNIQUE(pantry_item_id, pet_id)
- `push_tokens` — per-device Expo push tokens, UNIQUE(user_id, device_id), `is_active` flag for dead token cleanup
- `user_settings` — per-user notification prefs: global kill switch + per-category toggles (feeding/low_stock/empty/recall/appointment/digest)
- **Pantry offline:** Write functions throw `PantryOfflineError`, reads return `[]` gracefully. Network check via `src/utils/network.ts`.
- **Auto-deplete cron:** `supabase/functions/auto-deplete/` runs every 30 min via pg_cron+pg_net. Daily-total deduction (timezone-agnostic). Unit conversion: cups → kg (calorie-based or 0.1134 fallback) → quantity_unit. Idempotency: `last_deducted_at < todayStartUTC`. Sends push via Expo Push API for low stock (<=5 days/units) and empty transitions.
- `pet_appointments` — `UUID[]` for `pet_ids` (not junction table), `type` CHECK ('vet_visit','grooming','medication','vaccination','other'), `reminder` default '1_day', `recurring` default 'none', hard delete (not soft-delete). RLS on user_id. Free tier: 2 active max (`canCreateAppointment` in permissions.ts).
- **Auth:** Anonymous sign-in via `ensureAuth()`. Storage bucket `pet-photos` (public), path: `{userId}/{petId}.jpg`

## Non-Negotiable Rules

1. Scoring engine is **brand-blind** — no brand-specific modifiers
2. **Affiliate isolated from scoring** — `affiliate_links` invisible to engine
3. **Paywall checks ONLY in `permissions.ts`** — no scattered `if (isPremium)`
4. **Dogs and cats only** — refuse unsupported species
5. **Clinical copy** — objective, citation-backed, never editorial
6. Every penalty has **`citation_source`** — no unattributed claims
7. **Supabase RLS** on every user-data table
8. **No `any` types** in TypeScript core entities
9. **Suitability framing (D-094)** — always "[X]% match for [Pet Name]"
10. **UPVM compliance (D-095)** — never: "prescribe," "treat," "cure," "prevent," "diagnose"
11. **Bypasses:** vet diet (D-135), species mismatch (D-144), variety pack (D-145), recalled product (D-158) — no scoring
12. **API keys server-side only (D-127)** — all external calls via Edge Functions
13. **Recall alerts free (D-125)** — no paywall gate

## Do NOT Build

- Ask AI / chatbot (liability — permanently removed)
- Score supplements (M16+, D-096), grooming/cosmetics, vet diets (D-135 bypass)
- `expo-barcode-scanner` (deprecated), star ratings (→ Kiba Index M8+)
- Compare flow (M6), Vet Report PDF (M6), variety pack scoring (D-145)
- Score recalled products (D-158 — bypass pattern, not score=0)
- BCS questionnaire/diagnostic tool, photo-based BCS estimation (D-162 — educational reference only)
- Raw goal weight input (D-160 supersedes D-061 — use weight goal level slider)

## Workflow

When executing plans, always proceed with implementation without presenting option menus. Keep context unless explicitly told to clear it.

## Commit Convention

```
M5: pantry assignment with multi-pet sharing
```

## Self-Check

□ Scoring deterministic? Pure Balance = 62 after changes?
□ `position_reduction_eligible` checked? DMB for wet food? `cluster_id` for splitting?
□ Score framing + UPVM compliance in UI copy?
□ Paywall in permissions.ts only? RLS on user tables? API keys server-side?
□ Vet diet / species mismatch / variety pack bypasses intact?
□ Aligns with DECISIONS.md? In scope for current milestone?

## When Unsure

1. Check `DECISIONS.md` — follow if answered there
2. Check `ROADMAP.md` — flag if out of scope
3. Scoring math → `docs/references/scoring-rules.md` then `docs/specs/NUTRITIONAL_PROFILE_BUCKET_SPEC.md`
4. Breed logic → `docs/specs/BREED_MODIFIERS_DOGS.md` / `BREED_MODIFIERS_CATS.md`
5. If ambiguous, ask ONE focused question
