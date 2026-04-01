# Project Status — Last updated 2026-03-31 (session 8)

## Active Milestone
**M7 — 7-Day Safe Switch Guide** (transition management, tummy check logging, daily mix ratios)

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
- Enroll in Chewy Affiliate Partners + Amazon Associates → flip `affiliateConfig.ts` enabled: true
- M8: Kiba Index / Taste Test integration at Safe Switch completion

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-31 (session 8)
- **Accomplished:** M7 Safe Switch Guide — full implementation (12 new files, 8 modified files, 29 new tests).
  - **Database:** Migration 025 — `safe_switches` + `safe_switch_logs` tables, RLS policies, partial unique index (one active switch per pet)
  - **Types:** `safeSwitch.ts` — `SafeSwitch`, `SafeSwitchLog`, `SafeSwitchCardData`, `TransitionDay`, `TummyCheck`
  - **Pure helpers:** `safeSwitchHelpers.ts` — `getTransitionSchedule()`, `getMixForDay()`, `getCurrentDay()`, `getCupSplit()`, `shouldShowUpsetAdvisory()`, `getSpeciesNote()`, `getDefaultDuration()`
  - **Service:** `safeSwitchService.ts` — CRUD (create/complete/cancel/pause/resume), `logTummyCheck()` upsert, `getActiveSwitchForPet()` composite loader
  - **Notifications:** `safeSwitchNotificationScheduler.ts` — daily 9 AM mix reminder + 7 PM tummy check nudge, full-resync pattern
  - **UI:** `SafeSwitchBanner.tsx` (full + compact modes), `SafeSwitchSetupScreen.tsx` (setup flow), `SafeSwitchDetailScreen.tsx` (daily command center)
  - **Entry points:** "Switch to this" on Safe Swap cards (SafeSwapSection), "Find a replacement" on PantryCard (<60% daily food)
  - **Navigation:** Registered SafeSwitchSetup + SafeSwitchDetail in PantryStack and HomeStack
  - **Tests:** 29 new tests in `safeSwitchHelpers.test.ts`, `react-native-svg` Jest mock added
  - **Bug fixes:** CTA button hidden behind tab bar (added 88px offset), hardcoded teal (#14B8A6) replaced with Colors.accent (#00B4D8)
- **Files changed:**
  - **Modified:**
    - `package.json` (Jest moduleNameMapper for react-native-svg mock)
    - `src/components/pantry/PantryCard.tsx` ("Find a replacement" link, onFindReplacement prop)
    - `src/components/result/SafeSwapSection.tsx` ("Switch to this" CTA, onSwitchTo prop)
    - `src/navigation/index.tsx` (SafeSwitchSetup + SafeSwitchDetail screen registration)
    - `src/screens/HomeScreen.tsx` (compact SafeSwitchBanner insertion)
    - `src/screens/PantryScreen.tsx` (full SafeSwitchBanner insertion, onFindReplacement wiring)
    - `src/screens/ResultScreen.tsx` (onSwitchTo cross-tab navigation wiring)
    - `src/types/navigation.ts` (SafeSwitchSetup + SafeSwitchDetail routes)
  - **New:**
    - `__mocks__/react-native-svg.js`
    - `__tests__/utils/safeSwitchHelpers.test.ts`
    - `src/components/pantry/SafeSwitchBanner.tsx`
    - `src/screens/SafeSwitchSetupScreen.tsx`
    - `src/screens/SafeSwitchDetailScreen.tsx`
    - `src/services/safeSwitchNotificationScheduler.ts`
    - `src/services/safeSwitchService.ts`
    - `src/types/safeSwitch.ts`
    - `src/utils/safeSwitchHelpers.ts`
    - `supabase/migrations/025_safe_switches.sql`
- **Not done yet:**
  - `safeSwitchService.test.ts` (deferred — needs Supabase mocking)
  - 3 tech debt flags: hardcoded 2.4 cup split, late conflict validation UX, perpetual DAILY notification triggers
- **Next session should:** Test full Safe Switch lifecycle on iOS simulator (create → log → complete/cancel). Address tech debt flags if time allows.
- **Gotchas for next session:**
  - **Migration 025 applied.** `safe_switches` + `safe_switch_logs` tables live in production.
  - **Hardcoded cup split.** `SafeSwitchDetailScreen.tsx` line 183 uses `totalCups = 2.4` placeholder. Needs wiring to actual `serving_size` from pantry assignments.
  - **Late conflict validation.** Setup screen checks for existing active switch only on CTA press, not on mount. User can see full preview then get rejected.
  - **Perpetual notifications.** Safe Switch notifications use `DAILY` trigger (repeats forever). If user abandons without completing/cancelling, notifications fire indefinitely. Fix: use explicit Date triggers for remaining N days.
  - Prior session gotchas still apply: affiliate buttons dormant, Edge Function deployed with Approach F, `parse_ingredients.py` slow, `fetchGroupSafeSwaps()` is dead code, `life_stage_claim` is free text.
- **Decision/scoring changes:** No new decisions. No scoring logic changed.
