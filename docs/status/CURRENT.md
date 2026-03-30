# Project Status — Last updated 2026-03-30 (session 6)

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
- **Compare flow** — 9-rule key differences engine, two-column CompareScreen (score breakdown, nutrition table, ingredients), CompareProductPickerSheet (search, recent scans, camera), kcal/cup estimation fallback (DB → kcal/kg × 110g → Atwater), PortionCard kcal/cup display. **"Your Other Pets" section** — collapsible, lazy-loaded scores for other same-species pets on CompareScreen
- **Vet Report PDF** — 4-page diet-centric report via expo-print (no Kiba scores). Pet profile with BCS gauge, caloric summary, combined nutrition with AAFCO checks, supplemental nutrients, flags, weight tracking, per-product detail, condition management notes, owner dietary cards (28 cards × conflict detection), vet notes. Premium-gated via `canExportVetReport()`.
- **Safe Swap curated layout (Plan 2)** — daily dry food gets curated 3-pick (Top Pick / Fish-Based / Great Value). Fish-Based uses `allergen_group = 'fish'` from `ingredients_dict` (not regex). Great Value uses `price / product_size_kg` (migration 023). Fish allergy → Fish-Based replaced with "Another Pick" (2nd highest score). Falls back to generic top-3 if < 2 curated slots fill. All other categories unchanged (generic top-3).
- **Safe Swap multi-pet (Plan 3)** — chip row for 2+ same-species pets + "All Dogs"/"All Cats" group mode. Group mode: intersects candidate pools across all pets, uses floor score (lowest), unions allergens (widest exclusion) and conditions (most restrictive filters). Curated layout works in group mode. Client-side cache per chip tap. Stale closure guard for rapid taps.
- **Condition-aware feeding frequency** — auto-populate `feedings_per_day` based on pet health conditions when adding to pantry. 7 conditions mapped (pancreatitis/gi_sensitive/ckd/diabetes/obesity/underweight → 3, liver → 4). PortionCard shows feeding advisory when conditions warrant smaller, more frequent meals. D-095 compliant copy.
- **Safe Swap simplified** — removed multi-pet chip row, active pet only. Collapsible (default closed), free users see inline premium CTA. Life stage hard filter (puppies don't see senior food, seniors don't see puppy food, "All Life Stages" always passes). Great Value fallback to "Another Pick" when no price data.
- **Hybrid batch scoring** — `batchScoreHybrid()` tries Edge Function first (19K products server-side), falls back to client-side (200 products) on failure. Graceful degradation for Supabase free tier.
- **Price backfill** — 15,781 products updated with price + product_size_kg from v7 dataset. 74.6% of daily food now has price data for Great Value slots.

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
- **Date:** 2026-03-30 (session 6)
- **Accomplished:** Safe Swap UX overhaul, multi-pet scoring moved to CompareScreen, price backfill, hybrid scoring, life stage filtering.
  - **SafeSwapSection simplified:** Removed multi-pet chip row, group mode, `useActivePetStore`, `fetchGroupSafeSwaps` call path, per-pet caching. Active pet only. ~200 lines removed.
  - **Collapsible Safe Swap section:** Default collapsed, grey card header matching other collapsibles (Score Breakdown, Ingredients). Free users see inline "Become a member" CTA on expand.
  - **CompareScreen "Your Other Pets":** Collapsible section after Key Differences, lazy-loads scores for other same-species pets on expand. Two-column layout with colored score dots. Resets when Product B is swapped.
  - **Great Value fallback:** When no price data, slot 3 falls back to "Another Pick" (next highest scoring) instead of showing only 2 cards.
  - **Card alignment fix:** `cardBottom` with `marginTop: 'auto'` aligns scores/reasons across cards with variable-height content.
  - **Price backfill (DONE):** Ran `backfill_price_size.py` — 15,781 products updated. 74.6% daily food, 55.5% treats, 25.5% supplements now have price data. 20 transient connection errors (negligible).
  - **Hybrid batch scoring (DONE):** `batchScoreHybrid()` in `batchScoreOnDevice.ts` — tries Edge Function first, falls back to client-side. SafeSwapSection now calls hybrid version.
  - **Life stage hard filter (DONE):** `applyLifeStageFilter()` in `safeSwapService.ts` — puppies don't see senior/adult-only food, adults don't see puppy/kitten-only food, "All Life Stages" always passes. Added `life_stage_claim` to CandidateRow + fetchBasePool select.
  - **Header copy:** Changed to "Top picks for {petName}" / "Alternatives matched to {petName}'s dietary needs."
  - **Python 3.9 fix:** `size_parser.py` — changed `str | None` to `Optional[str]` for compatibility.
  - **Edge Function deployed to Pro:** Fixed 401 (reserved `SUPABASE_` prefix → renamed to `SERVICE_ROLE_KEY`), fixed 404 (quoted JWT in secrets set). Edge Function now scoring 188 products in ~8s server-side.
  - **Debug logging:** `__DEV__`-only logs in `batchScoreHybrid()` show which path was taken (Edge Function vs client-side), HTTP status on failure, and response body.
  - **Architecture doc:** Created `docs/references/batch-scoring-architecture.md` — documents current system, 4 known issues (stale cache, no ordering, 200 limit, Edge Function parity), and 5 proposed approaches (TTL, count delta, pg_cron, raise limit, combo).
- **Files changed:** src/components/result/SafeSwapSection.tsx, src/screens/CompareScreen.tsx, src/screens/ResultScreen.tsx, src/services/safeSwapService.ts, src/services/batchScoreOnDevice.ts, supabase/functions/batch-score/index.ts, __tests__/services/safeSwapService.test.ts, scripts/import/size_parser.py, docs/references/batch-scoring-architecture.md (NEW), docs/status/CURRENT.md
- **Not done yet:**
  - **Batch scoring improvements** — decide on approach from `docs/references/batch-scoring-architecture.md` (raise limit, TTL cache expiration, ordering). Current: 200 random products, cache never expires for new products.
  - `safe swaps/` draft folder should be deleted (everything superseded by live code or in `scripts/import/`)
  - `safeswapsimplementation_plan.md` in repo root — Gemini's plan, can be cleaned up
  - Affiliate integration (Chewy/Amazon links, FTC disclosure, buy buttons)
  - `aafco_inference` on Product type (low priority)
  - CompareScreen pet switcher dropdown (deferred — "Your Other Pets" row is sufficient for now)
  - "Who Benefits Most?" summary line on CompareScreen (deferred)
- **Next session should:** Run /boot. Read `docs/references/batch-scoring-architecture.md` and decide which cache/scoring approach to implement. Delete `safe swaps/` folder and `safeswapsimplementation_plan.md`.
- **Gotchas for next session:**
  - **Supabase is now on Pro tier.** Edge Function is deployed and working (`batch-score`, `--no-verify-jwt`).
  - Edge Function secret is `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY` — reserved prefix).
  - `batchScoreHybrid()` is the entry point — tries Edge Function, falls back to client-side. Both paths limited to 200 products.
  - Both batch scoring paths fetch 200 products with **no ordering** — effectively random subset. Decision needed on whether to raise limit and add ordering.
  - `fetchGroupSafeSwaps()` still exists in `safeSwapService.ts` but is no longer called (kept for potential future use).
  - `life_stage_claim` is free text — filter uses keyword matching (growth: puppy/kitten/growth; adult/senior: adult/maintenance/senior). "All Life Stages" is a special pass-through.
  - Price backfill had 20 transient errors out of 15,801 — those products still have null price/size. Re-running the script would fix them.
  - CompareScreen "Your Other Pets" resets scores when Product B changes (via picker). Scores are lazy-loaded on section expand only.
  - `__DEV__` debug logs in `batchScoreHybrid()` show Edge Function status — strip automatically in production.
- **No new decisions, no scoring logic changes, no new migrations this session.**
