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
- **Stale browse scores**: CategoryBrowseScreen reads cached scores from `pet_product_scores` which can diverge from fresh ResultScreen scores (e.g. 82 vs 79) when pet profile changes after batch scoring. Root cause: batch scoring delta check counts ALL daily food for cache maturity but fetches by specific `product_form` — cache appears mature when dry/wet fill 80%, so freeze-dried (and other minority forms) never get scored. Workaround: fallback to unscored `products` query when scored cache is empty for a form. Long-term fix: make cache maturity check form-aware in both Edge Function and `batchScoreOnDevice.ts`.

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
- **Date:** 2026-04-04 (session 18)
- **Accomplished:** M9 — Top Picks carousel bug fix for new pets.
  - **Top Picks unscored fallback fix:** New pets with no `pet_product_scores` cache were seeing alphabetically-first products (e.g., 9 Lives) labeled as "Top Picks" when a sub-filter was active. Root cause: `fetchBrowseResults` falls back to `fetchUnscoredResults` (alphabetical order) when scored cache is empty for a form — correct for the browse list, wrong for Top Picks. Fix: `TopPicksCarousel` now filters results to `final_score != null`, so unscored fallbacks never appear as "top picks." New pets see zero-state CTA or carousel hides silently with sub-filter active.
  - **Files modified:** `src/components/browse/TopPicksCarousel.tsx`, `docs/status/CURRENT.md`
- **Not done yet:**
  - Custom icons for remaining groups (concerns, advisories, conditions, forms, treat-forms, supplement-forms) — v1 thin-stroke PNGs exist but need v2 bold re-gen
  - 5 pending icons (joint-hip, skin-coat, calming, digestive re-gen, jerky-chews) per custom-icon-spec.md
  - `IconPlatter` component not yet created (spec in `docs/specs/custom-icon-spec.md`)
  - Stale browse scores: batch scoring cache maturity not form-aware (documented in Known Issues)
  - Pantry polish (SwipeableRow on PantryCards, legacy token migration)
  - Legacy token migration on remaining screens (AppointmentsListScreen, ResultScreen, CompareScreen, EditPantryItemScreen)
  - Kiba Index end-to-end testing on iOS simulator
  - Affiliate buttons still dormant — waiting on Chewy/Amazon enrollment
  - Brand filter on browse (deferred — brand picker bottom sheet)
  - Chip badge counts only show for Daily Food sub-filters
- **Next session should:** Continue custom icon rollout (create `IconPlatter` component, wire concern/advisory/condition icons on ResultScreen). Generate v2 bold-stroke versions of remaining icon groups. Consider pantry polish.
- **Gotchas for next session:**
  - Asset directory is `assets/Icons/` (capital I), NOT `assets/icons/`. The spec file uses lowercase — Metro is case-sensitive on require paths.
  - `iconMaps.ts` category keys must match `BrowseCategory` type values: `treat` (not `treats`), `supplement` (not `supplements`).
  - `fetchUnscoredResults` now accepts optional `opts` param for `productFormFilter` and `isSupplemental` — used as fallback when scored cache is empty.
  - `searchProducts()` `isVetDiet` filter: `undefined` → excludes vet diets (default `false`), `true` → only vet diets. HomeScreen clears `isSupplemental` when vet_diet sub-filter active.
  - TopPicksCarousel image stage is white (`#FFFFFF`) — product images framed with padding + contain.
  - BrowseProductRow now uses score pills (not rings) — same style as HomeScreen `scorePill`/`scorePillText`.
  - `custom-icon-spec.md` updated to v2 (bold 2px stroke, filled variants, re-gen queue).
  - TopPicksCarousel filters out `final_score == null` products — only scored products appear as "top picks."
- **Decision/scoring changes:** No new decisions. No scoring logic changed. No new migrations.
