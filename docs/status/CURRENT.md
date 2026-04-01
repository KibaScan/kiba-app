# Project Status — Last updated 2026-03-31 (session 9)

## Active Milestone
**M9 — UI Polish & Search** (search UX overhaul, general polish, UX friction fixes)

## Last Completed
**M8 — Kiba Index** (April 1, 2026, branch `m5-complete`)

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
- **Safe Switch Guide (M7)** — guided 7-day (dogs) / 10-day (cats) food transition with daily mix ratios (75/25 → 50/50 → 25/75 → 100%). `SafeSwitchSetupScreen` (preview + start), `SafeSwitchDetailScreen` (daily command center with proportion bar, tummy check pills, vertical timeline). `SafeSwitchBanner` on PantryScreen (day ring + mix ratio) and HomeScreen (compact status card). Entry points: "Switch to this" on Safe Swap cards, "Find a replacement" on low-scoring (<60%) daily food PantryCards. Daily notifications (9 AM mix reminder, 7 PM tummy check nudge). Upset advisory (2+ consecutive "upset" logs → informational card, D-095 compliant, no auto-action). One active switch per pet enforced at DB level (partial unique index). Free feature (no paywall gate). Migration 025.

## What's Broken / Known Issues
- No pre-existing TS errors

## Numbers
- **Tests:** 1278 passing / 58 suites
- **Decisions:** 129 (D-001 through D-167, non-sequential, D-053 revised)
- **Migrations:** 25 (001–025)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 57 (fat >12% DMB penalty)

## Up Next
- Apply migration 026 to production Supabase
- Enroll in Chewy Affiliate Partners + Amazon Associates → flip `affiliateConfig.ts` enabled: true
- M9: UI polish & search UX overhaul
- M10: Community points (XP engine, streaks, product submissions — lite scope)
- M11: Symptom Detective (deferred — major App Store update feature)

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-04-01 (session 10)
- **Accomplished:** Reviewed Gemini's M8 Kiba Index implementation, fixed bugs and gaps.
  - **Bug fix 1 — non-null assertion:** `KibaIndexSection.tsx:118` used unsafe `stats!` — replaced with `stats !== null &&` guard.
  - **Bug fix 2 — optimistic double-count:** `total_votes` was bumped on every vote, even partial second-category votes that upsert the same row. Now only bumps when `prevVote` is null (new row).
  - **Bug fix 3 — offline handling:** Added `isOnline()` check to `kibaIndexService.ts` before submitting votes. Added `Alert.alert` on vote failure instead of silent rollback.
  - **Cleanup — stale type:** Removed pre-existing `KibaIndexVote` interface from `types/index.ts` (M0 scaffold, numeric 1-5 scores, unused — conflicted with service's string enum type).
  - **Cleanup — hardcoded colors:** Replaced `#333333` → `Colors.cardBorder`, `#242424` → `Colors.card`, `rgba(245,158,11,...)` → `Colors.severityAmber` + hex opacity in KibaIndexSection, VoteBarChart, FeedbackCard.
  - **Files modified:** `src/components/result/KibaIndexSection.tsx`, `src/services/kibaIndexService.ts`, `src/types/index.ts`, `src/components/result/kiba-index/VoteBarChart.tsx`, `src/components/result/kiba-index/FeedbackCard.tsx`
  - **Files reviewed (no changes needed):** `supabase/migrations/026_kiba_index.sql`, `src/screens/ResultScreen.tsx`
- **Not done yet:**
  - **Migration 026 not applied to production** — must run in Supabase SQL Editor before testing.
  - `safeSwitchService.test.ts` (deferred — needs Supabase mocking harness)
  - Kiba Index tests not written (Gemini's plan mentioned them but didn't create them)
  - State 5 "No Active Pet" missing CTA button (spec says `[ Add Pet → ]`, implementation only shows text — minor, rare edge case)
- **Next session should:** Apply migration 026 to production. Test Kiba Index end-to-end on iOS simulator (scan → scroll to section → vote → verify bar chart). Consider Kiba Index tests.
- **Gotchas for next session:**
  - **Migration 026 NOT yet applied.** Must run before Kiba Index works. Drops NOT NULL on taste_vote/tummy_vote, creates `get_kiba_index_stats` RPC.
  - Gemini created all M8 Kiba Index files (uncommitted) — service, components, migration, ResultScreen integration.
  - Affiliate buttons still dormant — waiting on Chewy/Amazon enrollment.
  - `fetchGroupSafeSwaps()` is still dead code.
  - `life_stage_claim` is still free text (no enum validation).
- **Decision/scoring changes:** No new decisions. No scoring logic changed.
