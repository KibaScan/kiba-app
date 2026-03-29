# Project Status — Last updated 2026-03-28 (session 2)

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

## What's Broken / Known Issues
- No pre-existing TS errors (all 7 fixed this session)

## Numbers
- **Tests:** 1196 passing / 54 suites
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
- PortionCard: auto-populate feedings_per_day per condition
- `aafco_inference` on Product type (low priority — Rule 5 uses aafco_statement only)
- Run migration 023 on production database (price/size columns)
- Run `scripts/import/backfill_price_size.py` against v7 dataset to populate price/size data

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-28 (session 2)
- **Accomplished:** Safe Swap Plan 2 (curated layout) + Plan 3 (multi-pet chip row). Also fixed pre-existing TS errors in ~20 test files (Pet mock migration 022 fields + Product price fields).
  - **Safe Swap Plan 2 — Curated Layout:**
    - Migration 023: `price`, `price_currency`, `product_size_kg` on products table + partial index for value ranking
    - Product type updated with 3 new nullable fields
    - `safeSwapService.ts` extended: `SafeSwapResult` wrapper type (`mode: 'curated' | 'generic'`), `tagFishBased()` (allergen_group = 'fish' in top-3 ingredients), `assignCuratedSlots()` (Top Pick / Fish-Based or Another Pick / Great Value), `candidateToSwap()` helper
    - `SafeSwapSection.tsx`: slot label badges with icons (star/fish/sparkles/pricetag), result wrapper state
    - 12 new tests for `assignCuratedSlots`
  - **Safe Swap Plan 3 — Multi-Pet Chip Row:**
    - `safeSwapService.ts`: extracted `fetchBasePool()` from `fetchSafeSwaps()`, added `intersectCandidatePools()` (pure, exported), `fetchGroupPantryExclusions()`, `fetchGroupScanExclusions()`, `fetchGroupSafeSwaps()` (full group pipeline: parallel pool fetch → intersect → floor score → union allergens/conditions → exclusions → curated or generic)
    - `SafeSwapSection.tsx`: chip row (horizontal ScrollView of pet name chips + "All Dogs"/"All Cats"), `selectedPetId` + `groupMode` state, `cacheRef` (Map for per-chip results), `fetchIdRef` (stale closure guard), `loadSwaps` callback with 3 paths (group / active pet / different pet), `displayName` for group mode ("your dogs/cats")
    - 6 new tests for `intersectCandidatePools`
  - **Test mock fixes:** Added migration 022 Pet fields (6 fields) to ~14 test files, added Product price fields (3 fields) to ~17 test files
  - **Pre-existing hook ordering fix:** Moved early `isBypassed` return after all hooks in SafeSwapSection
- **Files changed:** src/services/safeSwapService.ts, src/components/result/SafeSwapSection.tsx, __tests__/services/safeSwapService.test.ts, src/types/index.ts, supabase/migrations/023_safe_swap_price_columns.sql (NEW), + ~20 test files (mock field additions)
- **Not done yet:**
  - Migration 023 needs to be applied to production database
  - `scripts/import/backfill_price_size.py` needs to be run against v7 dataset to populate price/size data for Great Value slot
  - Affiliate integration (Chewy/Amazon links, FTC disclosure, buy buttons)
  - PortionCard: auto-populate feedings_per_day per condition
  - Scoring reference docs: scoring-details.md still needs condition scoring + weight management sections
  - `safe swaps/` draft folder can be cleaned up (no longer needed)
- **Next session should:** Run /boot. Commit + push. Apply migration 023 to prod. Run backfill_price_size.py. Then start affiliate integration or other M6 items.
- **Gotchas for next session:**
  - `safe swaps/` folder still exists with draft files — safe to delete now that Plans 1-3 are complete.
  - Migration 023 must be applied to prod before Great Value slot can populate.
  - Safe Swap relies on `pet_product_scores` cache being populated. If empty for a pet, section silently hides.
  - `canCompare()` is stubbed to return `true` — don't forget to gate behind real paywall in M7.
  - Multi-pet chip row only shows for 2+ same-species pets (premium only by nature — free tier max 1 pet).
  - Group mode uses floor score (lowest across all pets) — this is intentional and most conservative.
  - `liver` and `seizures` tags exist in DOG_CONDITIONS but have NO scoring rules or dietary cards — display-only.
  - `getMaxBucket()` in CompareScreen only handles treat vs daily_food weights.
  - Auto-deplete cron `computeInlineDER()` must be synced manually if portionCalculator multiplier tables change.
- **No new decisions, no scoring changes this session. 1 new migration (023).**
