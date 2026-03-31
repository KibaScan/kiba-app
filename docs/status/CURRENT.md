# Project Status — Last updated 2026-03-31 (session 7)

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
- **Safe Swap simplified** — removed multi-pet chip row, active pet only. Collapsible (default closed), free users see inline premium CTA. Life stage hard filter. Great Value fallback to "Another Pick" when no price data.
- **Batch scoring — Approach F (Delta Scoring + Two-Phase Edge)** — `batchScoreHybrid()` tries Edge Function first (1000 products, two-phase), falls back to client-side (200 products). **Delta scoring:** checks cache maturity (≥80% of products scored) → only fetches new/updated products (near-instant). **Two-Phase Edge:** Phase 1 scores 200 products synchronously (~10s), Phase 2 scores remaining ~800 in background via `EdgeRuntime.waitUntil()` (chunked at 200 with 50ms GC yields). **Cache maturity check:** prevents "delta trap" when Phase 2 fails — triggers healing full batch on next scan. **Per-category rate limit** (scoring treats no longer blocks scoring dry food). All product queries ordered by `updated_at DESC`. Architecture doc: `docs/references/batch-scoring-architecture.md`.
- **Safe Swap filter hardening** — `CANDIDATE_POOL_SIZE` raised from 50 to 300 (6x buffer for exclusion filters). Exclusion queries chunked at 100 IDs (prevents 414 URI Too Long). `fetchBasePool()` filters by cached `is_supplemental` from `pet_product_scores` (D-146 aware, not raw DB value). Supplement category guard (`category = 'supplement'` → excluded). Runtime `isSupplementalByName()` safety net catches future data gaps. `tagFishBased()` also chunked.
- **Supplemental data patch (migration 024)** — 124 products flagged `is_supplemental = true` (toppers, mixers, lickables, sprinkles missed by enrichment pipeline). 2 oil products recategorized from `daily_food` to `supplement` (Pure Balance Salmon Oil, Raw Paws Coconut Oil). AAFCO cleared for supplemental products. Stale `pet_product_scores` cache invalidated.
- **Supplemental classifier expanded** — added `/topping/i` and `/lickable/i` to `SUPPLEMENTAL_NAME_PATTERNS` in `supplementalClassifier.ts`.
- **Price backfill** — 15,781 products updated with price + product_size_kg from v7 dataset. 74.6% of daily food now has price data for Great Value slots.
- **Affiliate link infrastructure (dormant)** — `AffiliateBuyButtons` component on ResultScreen (between PortionCard and Compare button). PantryCard "Reorder" button on low-stock items. `affiliateService.ts` generates Chewy/Amazon URLs from `source_url`/`chewy_sku`/`asin`/`affiliate_links` JSONB. D-020 compliant (zero scoring imports, buttons hidden when score < 50). D-053 compliant (Chewy shows estimated price, Amazon hides price). Config: `enabled: false` — flip on after affiliate program enrollment.
- **Condition-aware feeding frequency** — auto-populate `feedings_per_day` based on pet health conditions when adding to pantry.

## What's Broken / Known Issues
- No pre-existing TS errors

## Numbers
- **Tests:** 1249 passing / 57 suites
- **Decisions:** 129 (D-001 through D-167, non-sequential, D-053 revised)
- **Migrations:** 24 (001–024)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 57 (fat >12% DMB penalty)

## Up Next (M6)
- Enroll in Chewy Affiliate Partners + Amazon Associates → flip `affiliateConfig.ts` enabled: true
- Safe Swap affiliate buy pills (deferred — separate PR, requires adding affiliate fields to candidate query)
- `aafco_inference` on Product type (low priority — Rule 5 uses aafco_statement only)
- Delete `safe swaps/` folder and `safeswapsimplementation_plan.md` from repo root

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-31 (session 7)
- **Accomplished:** Batch scoring optimization (Approach F), supplemental data fix, affiliate link integration (dormant).
  - **Batch scoring — Approach F (Delta + Two-Phase Edge):**
    - `CANDIDATE_POOL_SIZE` 50 → 300 in `safeSwapService.ts`. Exclusion queries (`fetchAllergenExclusions`, `fetchSeverityExclusions`, `fetchCardiacDcmExclusions`, `tagFishBased`) chunked at 100 IDs via `chunkedProductQuery()` helper to prevent 414 URI Too Long.
    - `ORDER BY updated_at DESC` added to product queries in both `batchScoreOnDevice.ts` and Edge Function — newest products scored first instead of random disk order.
    - **Delta scoring:** Queries `MAX(product_updated_at)` from cache + cache count + total product count. If cache is "mature" (≥80% of category products scored), only fetches new/updated products. Otherwise full batch to heal incomplete cache.
    - **Asymmetric limits:** Edge Function limit raised to 1000 (from 200). Client fallback stays at 200. `batchScoreHybrid()` sends `limit_size: 1000` to Edge Function.
    - **Two-Phase Edge Function:** Phase 1 scores first 200 products synchronously, returns response immediately. Phase 2 via `EdgeRuntime.waitUntil()` scores remaining ~800 in 200-product chunks with 50ms GC yields. Extracted `fetchIngredients()` and `scoreAndUpsert()` helpers to avoid duplication. Fresh Supabase client for Phase 2 background context.
    - **Per-category rate limit:** Changed from per-pet to per-pet+category. Edge Function: `.eq('category', filterCategory)` on rate limit query. Client: in-memory key `${petId}:${category}`. Fixes bug where scoring treats blocked scoring dry food for 5 minutes.
    - **Edge Function deployed to production** via `supabase functions deploy batch-score --no-verify-jwt`.
    - `docs/references/batch-scoring-architecture.md` fully rewritten with Approach F documentation.
  - **Supplemental filter hardening:**
    - `fetchBasePool()`: Added `.eq('is_supplemental', isSupplemental)` to DB query (uses cached D-146 value). Changed client-side filter from `product.is_supplemental` (raw DB) to `row.is_supplemental` (cached, D-146 aware). Added `category = 'supplement'` guard. Added `isSupplementalByName()` runtime safety net.
    - `supplementalClassifier.ts`: Added `/topping/i` and `/lickable/i` patterns. Did NOT add `bone broth` (false-positives on kibbles like "Merrick Bone Broth Coated" without ingredient count context).
    - **Migration 024** (`024_fix_supplemental_data.sql`): 124 products set `is_supplemental = true` (by UPC via junction table, chewy_sku, and exact name match). 2 oils recategorized as `supplement`. AAFCO cleared for all supplemental products. Stale `pet_product_scores` cache rows deleted.
  - **Affiliate link integration (dormant):**
    - `src/config/affiliateConfig.ts` (NEW): Chewy + Amazon config, both `enabled: false`.
    - `src/services/affiliateService.ts` (NEW): Link generation, zero scoring imports (D-020). Resolution: `affiliate_links` JSONB → `source_url` → `chewy_sku`/`asin`.
    - `src/components/result/AffiliateBuyButtons.tsx` (NEW): Score < 50 → hidden (D-020). Chewy shows price, Amazon doesn't (D-053). Retailer brand accent borders.
    - ResultScreen: `AffiliateBuyButtons` between PortionCard and Compare button.
    - PantryCard: "Reorder on Chewy/Amazon" button on low-stock items (D-065).
    - Product type: Added `source_url`, `chewy_sku`, `asin`, `walmart_id` to Product interface.
    - 18 new tests in `affiliateService.test.ts`.
  - **D-053 revised:** FTC disclosure moved from inline below buttons to About/Legal section (screen bloat).
- **Files changed:**
  - `src/services/batchScoreOnDevice.ts` (delta scoring, asymmetric limits, per-category rate limit)
  - `supabase/functions/batch-score/index.ts` (full rewrite: two-phase, delta, extracted helpers)
  - `src/services/safeSwapService.ts` (CANDIDATE_POOL_SIZE 300, chunked queries, supplemental filters)
  - `src/utils/supplementalClassifier.ts` (topping + lickable patterns)
  - `supabase/migrations/024_fix_supplemental_data.sql` (NEW)
  - `docs/references/batch-scoring-architecture.md` (rewritten)
  - `src/config/affiliateConfig.ts` (NEW)
  - `src/services/affiliateService.ts` (NEW)
  - `src/components/result/AffiliateBuyButtons.tsx` (NEW)
  - `__tests__/services/affiliateService.test.ts` (NEW)
  - `src/types/index.ts` (4 retailer fields on Product)
  - `src/types/pantry.ts` (affiliate fields on PantryItemWithProduct)
  - `src/screens/ResultScreen.tsx` (AffiliateBuyButtons insertion)
  - `src/components/pantry/PantryCard.tsx` (reorder button)
  - `DECISIONS.md` (D-053 revised)
  - `docs/status/CURRENT.md`
- **Not done yet:**
  - Safe Swap affiliate buy pills (deferred — separate PR)
  - Walmart affiliate (DB column exists, no enrollment)
  - `aafco_inference` on Product type (low priority)
  - Delete `safe swaps/` folder and `safeswapsimplementation_plan.md`
- **Next session should:** Run /boot. Enroll in affiliate programs when user base allows. Delete deprecated `safe swaps/` folder. Consider if M6 is complete enough to close.
- **Gotchas for next session:**
  - **Affiliate buttons are dormant.** Both retailers have `enabled: false` in `src/config/affiliateConfig.ts`. Flip to `true` and replace placeholder tags after enrolling.
  - **Edge Function is deployed with Approach F.** Two-phase scoring, delta mode, per-category rate limit. Secret is `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`).
  - **`parse_ingredients.py` re-runs are slow** — script has no "only unparsed" filter, processes all 19k products. Already-parsed products hit duplicate key errors one-by-one. To fix specific products: delete their `product_ingredients` rows first, then run with `--limit`.
  - `fetchGroupSafeSwaps()` still exists but is dead code (multi-pet moved to CompareScreen).
  - `supplementalClassifier.ts` does NOT include `bone broth` — false-positive risk on kibbles without ingredient count context. Data patch handles bone broth products directly.
  - Migration 024 ran on production. Cache invalidation deleted stale `pet_product_scores` rows for patched supplemental products.
  - Prior session gotchas still apply: `life_stage_claim` is free text, price backfill had 20 transient errors, CompareScreen "Your Other Pets" resets on Product B change.
- **D-053 revised this session:** FTC disclosure moved from inline to About/Legal section (screen bloat). No new decision numbers added.
