# Project Status — Last updated 2026-04-03 (session 16)

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
- **Card contrast alignment** — `Colors.cardSurface` bumped `#1C1C1E` → `#242424`, `Colors.hairlineBorder` bumped `rgba(255,255,255,0.08)` → `rgba(255,255,255,0.12)`. Matches legacy token contrast.
- **Category browse on HomeScreen** — 4 toggleable category cards (Daily Food, Toppers & Mixers, Treats, Supplements) with contextual sub-filter chips. Search bar filters by active category + sub-filter. Categories: Daily Food (Dry/Wet/Freeze-Dried/Vet Diet/Other), Toppers (Wet/Freeze-Dried/Dry), Treats (Crunchy & Biscuits/Jerky & Chews/Freeze-Dried/Lickables & Purees/Dental), Supplements (Joint & Hip/Skin & Coat/Digestive/Calming). `@shopify/flash-list` installed. Variety pack exclusion via `is_variety_pack` column (migration 029, ~1,706 flagged). `get_browse_counts` RPC for chip badge counts. `categoryBrowseService.ts` with cursor-based pagination. CategoryBrowseScreen exists but browse is inline on HomeScreen.

## What's Broken / Known Issues
- No pre-existing TS errors

## Numbers
- **Tests:** 1320 passing / 61 suites
- **Decisions:** 129 (D-001 through D-167, non-sequential, D-053 revised)
- **Migrations:** 29 (001–029)
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
- **Date:** 2026-04-03 (session 16)
- **Accomplished:** M9 — Card contrast fix, design system update, HomeScreen search overhaul with category browse.
  - **Card contrast alignment:** `Colors.cardSurface` `#1C1C1E` → `#242424`, `Colors.hairlineBorder` `rgba(255,255,255,0.08)` → `rgba(255,255,255,0.12)`.
  - **Design system update:** Reviewed Gemini's 11-fix MeScreen walkthrough, documented icon platters, screen headers, disclaimer placement, Featured Action Card, zero-state text, stat chip borderless fix.
  - **HomeScreen category browse:** 4 toggleable category cards (Daily Food, Toppers & Mixers, Treats, Supplements) in 2x2 grid. Tapping highlights with accent color, shows contextual sub-filter chips below search bar. Sub-filters: Daily Food (Dry/Wet/Freeze-Dried/Vet Diet/Other), Toppers (Wet/Freeze-Dried/Dry), Treats (Crunchy & Biscuits/Jerky & Chews/Freeze-Dried/Lickables & Purees/Dental), Supplements (Joint & Hip/Skin & Coat/Digestive/Calming). Filter icon platter before chip row.
  - **Dynamic search filtering:** `searchProducts()` extended with `productForm` and `isSupplemental` filters. Search re-triggers automatically when category or sub-filter changes via `useEffect`. Text search + category + sub-filter are AND-combined.
  - **Variety pack exclusion:** `is_variety_pack BOOLEAN` column on products (migration 029). ~1,706 products flagged via name patterns (variety pack, Bundle: prefix, sampler, assorted, multi-pack). Does NOT flag "case of" or "N-lb bundle". `searchProducts()` filters `.eq('is_variety_pack', false)`.
  - **Browse infrastructure:** `categoryBrowseService.ts` with `fetchBrowseResults()` (scored + unscored paths, cursor-based pagination, name-pattern sub-filters for treats/supplements), `fetchBrowseCounts()` (RPC), `fetchCategoryTopPicks()` (stub). `get_browse_counts` RPC in migration 029. `@shopify/flash-list` 2.0.2 installed.
  - **CategoryBrowseScreen:** Full-screen browse exists (header + chips + FlashList + pagination) but browse is now inline on HomeScreen. Screen kept for future Top Picks "See All".
  - **Files created:** `supabase/migrations/029_category_browse.sql`, `src/types/categoryBrowse.ts`, `src/services/categoryBrowseService.ts`, `src/components/browse/SubFilterChipRow.tsx`, `src/components/browse/BrowseProductRow.tsx`, `src/screens/CategoryBrowseScreen.tsx`
  - **Files modified:** `src/screens/HomeScreen.tsx`, `src/services/topMatches.ts`, `src/types/navigation.ts`, `src/navigation/index.tsx`, `src/utils/constants.ts`, `.agent/design.md`, `package.json`, `docs/status/CURRENT.md`
- **Not done yet:**
  - Top Picks per category/sub-filter (up to 50 per — `fetchCategoryTopPicks` stub ready, needs dedicated screen)
  - HomeScreen visual overhaul (custom assets, layout polish)
  - Pantry polish (SwipeableRow on PantryCards, legacy token migration)
  - Legacy token migration on remaining screens (AppointmentsListScreen, HomeScreen, ResultScreen, CompareScreen, EditPantryItemScreen)
  - Kiba Index end-to-end testing on iOS simulator
  - Affiliate buttons still dormant — waiting on Chewy/Amazon enrollment
  - Brand filter on browse (deferred — brand picker bottom sheet)
  - Chip badge counts only show for Daily Food sub-filters (treats/supplements/toppers sub-filters use name-based detection, no RPC counts yet)
- **Next session should:** Add Top Picks (up to 50 per category/sub-filter, dedicated screen or inline section). HomeScreen visual polish with custom assets. Consider adding chip counts for treat/supplement sub-filters.
- **Gotchas for next session:**
  - Migration 028 + 029 are both applied to production Supabase.
  - `is_variety_pack` column is live. `searchProducts()` already filters on it.
  - `CategoryBrowseScreen` exists at `src/screens/CategoryBrowseScreen.tsx` and is registered on HomeStack — but browse is now inline on HomeScreen. The screen uses `categoryBrowseService.ts` which queries `pet_product_scores` (requires batch scoring cache). If the cache is empty for a pet, the screen shows empty. HomeScreen text search queries `products` directly (no cache needed).
  - `@shopify/flash-list` 2.0.2 installed — FlashList v2 dropped `estimatedItemSize` prop.
  - Sub-filter chip row has a filter icon platter at the leading edge (options-outline, 32px circle).
  - Treat sub-filters (Crunchy & Biscuits, Jerky & Chews, Lickables & Purees, Dental) and supplement sub-filters (Joint & Hip, Skin & Coat, Digestive, Calming) use `ILIKE` name patterns, not DB columns. Patterns defined in `categoryBrowseService.ts`.
  - `fetchCategoryTopPicks()` is a stub that delegates to `fetchBrowseResults()` with a limit override — ready for Top Picks implementation.
  - Affiliate buttons still dormant — waiting on Chewy/Amazon enrollment.
  - `life_stage_claim` still free text (no enum validation) — deferred as tech debt.
- **Decision/scoring changes:** No new decisions. No scoring logic changed. Migration 029 is schema + RPC only (new column, indexes, browse counts function).
