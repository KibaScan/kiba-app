# Project Status — Last updated 2026-03-29 (session 5)

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
- **Compare flow** — 9-rule key differences engine, two-column CompareScreen (score breakdown, nutrition table, ingredients), CompareProductPickerSheet (search, recent scans, camera), kcal/cup estimation fallback (DB → kcal/kg × 110g → Atwater), PortionCard kcal/cup display
- **Vet Report PDF** — 4-page diet-centric report via expo-print (no Kiba scores). Pet profile with BCS gauge, caloric summary, combined nutrition with AAFCO checks, supplemental nutrients, flags, weight tracking, per-product detail, condition management notes, owner dietary cards (28 cards × conflict detection), vet notes. Premium-gated via `canExportVetReport()`.
- **Safe Swap curated layout (Plan 2)** — daily dry food gets curated 3-pick (Top Pick / Fish-Based / Great Value). Fish-Based uses `allergen_group = 'fish'` from `ingredients_dict` (not regex). Great Value uses `price / product_size_kg` (migration 023). Fish allergy → Fish-Based replaced with "Another Pick" (2nd highest score). Falls back to generic top-3 if < 2 curated slots fill. All other categories unchanged (generic top-3).
- **Safe Swap multi-pet (Plan 3)** — chip row for 2+ same-species pets + "All Dogs"/"All Cats" group mode. Group mode: intersects candidate pools across all pets, uses floor score (lowest), unions allergens (widest exclusion) and conditions (most restrictive filters). Curated layout works in group mode. Client-side cache per chip tap. Stale closure guard for rapid taps.
- **Condition-aware feeding frequency** — auto-populate `feedings_per_day` based on pet health conditions when adding to pantry. 7 conditions mapped (pancreatitis/gi_sensitive/ckd/diabetes/obesity/underweight → 3, liver → 4). PortionCard shows feeding advisory when conditions warrant smaller, more frequent meals. D-095 compliant copy.

## What's Broken / Known Issues
- No pre-existing TS errors (all 7 fixed this session)

## Numbers
- **Tests:** 1231 passing / 56 suites
- **Decisions:** 129 (D-001 through D-167, non-sequential, all `###` normalized)
- **Migrations:** 23 (001–023)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 57 (fat >12% DMB penalty)

## Up Next (M6)
- Affiliate integration (Chewy/Amazon links, FTC disclosure, buy buttons)
- `aafco_inference` on Product type (low priority — Rule 5 uses aafco_statement only)
- Run migration 023 on production database (price/size columns)
- Run `scripts/import/backfill_price_size.py` against v7 dataset to populate price/size data

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-29 (session 5)
- **Accomplished:** Client-side batch scoring — replaced Edge Function with on-device scoring, fixing the WORKER_LIMIT OOM blocker. Safe Swaps confirmed working on-device.
  - **Client-side batch scoring (DONE, verified on device):** New `src/services/batchScoreOnDevice.ts` — fetches 200 candidate products + ingredients from Supabase, scores on-device using existing `computeScore()` engine (~9s for 182 products), upserts to `pet_product_scores`. Mirrors Edge Function's 8-step flow but runs entirely on-device. In-memory rate limit (5 min). Replaces `triggerBatchScore()` Edge Function call everywhere.
  - **Safe Swap trigger fix (DONE):** Widened trigger condition — now fires when `candidates === 0` (not just when `cacheEmpty === true`). Fixes stale cache scenario where old Edge Function rows exist but no candidates survive filters.
  - **Safe Swap minScore fix (DONE):** Changed `minScore` from `Math.max(scannedScore, 65)` to flat `MIN_SCORE_THRESHOLD` (65). Previous logic starved candidates for well-scoring products (e.g., scanned product scores 75 → only 76+ products qualify → too few candidates).
  - **Debug artifact cleanup (DONE):** Removed all `__DEV__` debug cards, `debugInfo` state, console.log/warn statements from SafeSwapSection. Removed `triggerBatchScore()` function and `SUPABASE_ANON_KEY` export (no longer needed).
  - **Migration 023 applied to production (DONE):** `price`, `price_currency`, `product_size_kg` columns now exist on `products` table. This was blocking the Safe Swap base pool query (PostgREST error on unknown columns).
  - **Exported `hydrateIngredient` from pipeline.ts (DONE):** One-word change, needed by batchScoreOnDevice.
  - **9 new tests (DONE):** `__tests__/services/batchScoreOnDevice.test.ts` — rate limit, happy path, empty products, variety pack skip, supplemental detection, no ingredients, pet not found, upsert error, allergens/conditions passthrough.
- **Files changed:** src/services/batchScoreOnDevice.ts (NEW), __tests__/services/batchScoreOnDevice.test.ts (NEW), src/services/scoring/pipeline.ts, src/components/result/SafeSwapSection.tsx, src/stores/useTopMatchesStore.ts, src/services/topMatches.ts, src/services/safeSwapService.ts
- **Still uncommitted from session 4:** src/components/result/HealthConditionAdvisories.tsx, src/data/conditionAdvisories.ts, src/screens/ResultScreen.tsx, supabase/functions/batch-score/* (Edge Function import fixes), docs/status/CURRENT.md
- **Not done yet:**
  - **Hybrid scoring approach** — try Edge Function first (when Supabase Pro), fall back to client-side. Edge Function code still in `supabase/functions/batch-score/`. Would enable scoring all 19K products server-side.
  - **Multi-pet group mode** — "All Dogs"/"All Cats" chip requires cached scores for ALL same-species pets. Currently only the active pet gets scored, so group mode returns 0 candidates. Need to batch-score for each pet without cached scores.
  - **UX brainstorm in progress** — explored alternatives to pet chip row: tap score ring → bottom sheet with per-pet scores (no bulk scoring needed), "Find Better" as dedicated screen, swipe-stack alternatives, Home screen recommendations. No decision locked yet.
  - `scripts/import/backfill_price_size.py` needs to be run against v7 dataset.
  - Affiliate integration (Chewy/Amazon links, FTC disclosure, buy buttons).
  - `safe swaps/` draft folder can be cleaned up.
  - Only 2 curated candidates appeared in testing (not 3) — severity exclusion filter may be too aggressive for the 200-product sample.
- **Next session should:** Run /boot. Review the UX brainstorm options for multi-pet scoring display (see `safeswapsimplementation_plan.md` or start fresh). Key decision: keep the current chip row approach (needs multi-pet batch scoring) vs. tap-score-ring approach (cheap, scores one product per pet on-demand). Then implement whichever UX approach is chosen.
- **Gotchas for next session:**
  - `.env` still uses JWT-format anon key (`eyJhbG...`) from session 4.
  - `SUPABASE_ANON_KEY` is no longer exported from `supabase.ts` — reverted to private.
  - `triggerBatchScore()` no longer exists — removed from `topMatches.ts`. Edge Function code in `supabase/functions/batch-score/` is retained as verified engine copy.
  - `SafeSwapResult.cacheEmpty` field still exists and is used by the trigger logic.
  - `isCachePopulated()` still exported from `safeSwapService.ts`.
  - `safeSwapService.ts` `minScore` is now flat 65 (both single-pet and group mode).
  - Safe Swap trigger fires on `candidates === 0 || cacheEmpty`, not just `cacheEmpty`.
  - `batchScoreOnDevice.ts` has in-memory rate limit Map — resets on app restart.
  - Session 4 files still uncommitted (HealthConditionAdvisories, conditionAdvisories, ResultScreen, batch-score Edge Function fixes).
  - `safeswapsimplementation_plan.md` in repo root — Gemini's plan, can be cleaned up.
- **No new decisions, no scoring logic changes, no new migrations this session.**
