# CLAUDE.md — Kiba Project Context

> Single source of context for Claude Code. Keep lean — details live in spec files.
> Full architecture + common tasks guide: `.cursorrules` (also at `.github/copilot-instructions.md`)
> Last updated: April 2, 2026 — M9 in progress. Test count and numbers in `docs/status/CURRENT.md`.

---

## Project Overview

Kiba (kibascan.com) — pet food scanner iOS app, "Yuka for pets." Scan barcode → ingredient-level safety score 0-100, species-specific for dogs and cats.

**Owner:** Steven (product decisions, non-coder) | **Developer:** Claude Code
**Current phase:** M9 in progress — UI Polish & Search

**Environment:** Expo SDK 55, React Native 0.83, TypeScript 5.9 (strict), Node 25.x, npm
**Key deps:** `expo-camera` (NOT expo-barcode-scanner), `expo-audio` (NOT expo-av), `react-native-purchases` (RevenueCat), Zustand 5, Supabase JS 2.98, `react-native-svg`, `expo-blur`, `@react-native-community/netinfo`
**Infra:** Supabase (Postgres + Auth + Storage + RLS + pg_cron) | React Navigation | Jest via jest-expo

## Spec Files — Read Before Changing

| File | What it covers |
|------|---------------|
| `DECISIONS.md` | 129 decisions (D-001–D-167, gaps) — always check before implementing. See header for supersession pairs and recent additions. |
| `ROADMAP.md` | Milestone plan, current scope |
| `docs/references/scoring-rules.md` | **Full scoring engine rules** — 3 layers, weights, curves, all mechanics |
| `docs/specs/NUTRITIONAL_PROFILE_BUCKET_SPEC.md` | NP bucket: AAFCO thresholds, DMB, trapezoidal curves |
| `docs/specs/BREED_MODIFIERS_DOGS.md` / `_CATS.md` | Breed data (23 dogs, 21 cats) |
| `docs/specs/PET_PROFILE_SPEC.md` | Profile fields, conditions, allergens |
| `docs/specs/PORTION_CALCULATOR_SPEC.md` | RER/DER math, goal weight, cat safety guards |
| `docs/specs/PANTRY_SPEC.md` | M5 Pantry schema, depletion, UI, edge cases |
| `docs/plans/TOP_MATCHES_PLAN.md` | Top matches recommendation plan |
| `docs/references/dataset-field-mapping.md` | Apify → Supabase field mapping |
| `.agent/design.md` | **Matte Premium design system** — tokens, card anatomy, typography, spacing, SwipeableRow, legacy token migration. **Read before touching any screen UI.** |

**Key areas:** `src/services/scoring/` (engine), `src/utils/constants.ts` (Colors, SCORING_WEIGHTS, SEVERITY_COLORS, getScoreColor()), `src/utils/permissions.ts` (ONLY paywall location), `src/services/pantryService.ts` + `src/utils/pantryHelpers.ts` (pantry), `src/services/kibaIndexService.ts` (Kiba Index voting), `src/utils/weightGoal.ts` (D-160 slider math), `supabase/functions/` (Edge Functions), `supabase/migrations/` (001–034). See scoped CLAUDE.md files in subdirectories for details.

**Current status:** `docs/status/CURRENT.md` | **Error lookup:** `docs/errors.md`

## Score Framing (D-094)

All scores: `"[X]% match for [Pet Name]"` — NEVER naked scores. Two color scales in `getScoreColor()`: green family (daily food), teal/cyan family (supplemental), converge at yellow/amber/red. 360° ring = daily food + treats, 270° arc = supplemental.

## Scoring Engine — Quick Reference

Full rules in `docs/references/scoring-rules.md`. Read that file before any scoring changes.

| Category | IQ | NP | FC |
|----------|----|----|-----|
| Daily Food | 55% | 30% | 15% |
| Supplemental | 65% | 35% (macro-only) | 0% |
| Treats | 100% | 0% | 0% |

**Regression anchors:** Pure Balance (Dog) = 61, Temptations (Cat Treat) = 0

## Schema Traps

- `pets` table (NOT `pet_profiles`): `weight_current_lbs` (NOT `weight_lbs`), `date_of_birth` (NOT `birth_date`), `is_neutered` (NOT `is_spayed_neutered`), `life_stage` (derived, never user-entered), `health_reviewed_at` (null = never visited). D-160: `weight_goal_level SMALLINT` (-3 to +3, default 0) — slider-based, replaces raw `weight_goal_lbs`. D-161: `caloric_accumulator` + `accumulator_last_reset_at` + `accumulator_notification_sent` (estimated weight tracking). D-162: `bcs_score` + `bcs_assessed_at` (owner-reported BCS, educational only). *(Migration 022 — all columns exist.)*
- `product_upcs` — junction table (UPC → product_id), NOT TEXT[] array
- `ingredients_dict` — `is_pulse`/`is_pulse_protein` for DCM (NOT `is_legume`), `position_reduction_eligible`, `cluster_id` for splitting (NEVER string matching)
- `products` — `is_supplemental`, `is_vet_diet`, `is_variety_pack` (migration 029, ~1,706 flagged), `affiliate_links` JSONB (invisible to scoring). v7 enrichment (migration 020): `ga_*_dmb_pct` (pre-computed DMB), `aafco_inference` (derivation audit trail), `chewy_sku`/`asin`/`walmart_id` (retailer dedup), `image_url`, `source_url`. 19,058 products from Chewy + Amazon + Walmart.
- `pantry_items` — user-owned inventory (NO `pet_id`), `serving_mode` ('weight'|'unit'), `unit_label` ('servings') (D-164: collapsed from cans/pouches/units), soft-delete via `is_active`
- `pantry_pet_assignments` — per-pet serving config, `feeding_times` is JSONB (`string[] | null`), UNIQUE(pantry_item_id, pet_id)
- `push_tokens` — per-device Expo push tokens, UNIQUE(user_id, device_id), `is_active` flag for dead token cleanup
- `user_settings` — per-user notification prefs: global kill switch + per-category toggles (feeding/low_stock/empty/recall/appointment/digest)
- **Pantry offline:** Write functions throw `PantryOfflineError`, reads return `[]` gracefully. Network check via `src/utils/network.ts`.
- **Auto-deplete cron:** `supabase/functions/auto-deplete/` runs every 30 min via pg_cron+pg_net. Daily-total deduction (timezone-agnostic). Unit conversion: cups → kg (calorie-based or 0.1134 fallback) → quantity_unit. Idempotency: `last_deducted_at < todayStartUTC`. Sends push via Expo Push API for low stock (<=5 days/units) and empty transitions.
- `pet_appointments` — `UUID[]` for `pet_ids` (not junction table), `type` CHECK ('vet_visit','grooming','medication','vaccination','other'), `reminder` default '1_day', `recurring` default 'none', hard delete (not soft-delete). RLS on user_id. Free tier: 2 active max (`canCreateAppointment` in permissions.ts).
- `kiba_index_votes` — community taste/tummy voting. UNIQUE(user_id, pet_id, product_id). `taste_vote`/`tummy_vote` nullable (partial submissions). `get_kiba_index_stats` RPC for species-filtered aggregation (SECURITY DEFINER). Migration 026.
- `scan_history` — per-pet scan records (NOT `scans`), FK to `products(id)`. Only non-bypass scans are inserted (ResultScreen:231). `permissions.ts` uses `from('scans')` for rate limiting — different concern.
- **Auth:** Anonymous sign-in via `ensureAuth()`. Storage bucket `pet-photos` (public), path: `{userId}/{petId}.jpg`
- **Tab navigation:** Home | Community | (Scan) | Pantry | Me — Search tab was replaced by Community tab. `SearchScreen` deleted; premium text search lives on HomeScreen v2. `CommunityStackParamList` in navigation types.

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
- `expo-barcode-scanner` (deprecated), star ratings (replaced by Kiba Index)
- variety pack scoring (D-145)
- Score recalled products (D-158 — bypass pattern, not score=0)
- BCS questionnaire/diagnostic tool, photo-based BCS estimation (D-162 — educational reference only)
- Raw goal weight input (D-160 supersedes D-061 — use weight goal level slider)

## Workflow

When executing plans, always proceed with implementation without presenting option menus. Keep context unless explicitly told to clear it.

## Commit Convention

```
M6: compare flow with side-by-side scoring
```

## Self-Check

□ Scoring deterministic? Pure Balance = 61 after changes?
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
