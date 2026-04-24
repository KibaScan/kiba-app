# Project Status — Last updated 2026-04-24 (mid-session review follow-up on top of session 64 — `/code-review` surfaced 8 findings; CRITICAL protected on prod via Studio SQL; PRs #19 hotfix + #20 follow-up open on `m9-community`)

## Active Milestone

**M9 — UI Polish & Search** (search UX overhaul, general polish, UX friction fixes)

## Mid-Session Review Follow-Up (2026-04-24)

`/code-review` on PR #18 surfaced 8 validated findings (1 CRITICAL + 4 HIGH + 3 MEDIUM). All addressed in code; plan at `~/.claude/plans/humble-seeking-mango.md`.

- **PR #19 — hotfix** (`m9-xp-revoke-hotfix` → `m9-community`): migration 050 revokes EXECUTE on `upsert_user_xp_totals(UUID,INT,TEXT)` from PUBLIC + anon + authenticated. SECURITY DEFINER helper was publicly RPC-callable — any authenticated user could write arbitrary XP totals. **Prod protected via Studio SQL (`REVOKE ... FROM PUBLIC, anon, authenticated`) on 2026-04-24; `has_function_privilege('authenticated', ...) = false` verified.** Migration repair pending post-merge.
- **PR #20 — follow-up** (`m9-community-review-fixes` stacked on hotfix, → `m9-community`): migrations 051 + 052, `validate-recipe` JWT auth + ownership + status guards, `fetchKibaIndexHighlights` swap to `get_kiba_index_candidates` RPC (community-aggregation via SECURITY DEFINER, bypasses per-user RLS on `kiba_index_votes`), `XPRibbon` cache-vs-fetch race guard, back buttons on 4 screens (`VendorDirectory`, `ToxicDatabase`, `Bookmarks`, `ScanHistory`), `TopPickHeroCard` D-168 "match" text deletion.
- **051 scope**: idempotency guards on `process_scan_xp` + `process_vote_xp` (DELETE → re-INSERT farming), advisory xact lock on discovery bonus (READ COMMITTED race), defense-in-depth REVOKE anon on `get_user_xp_summary` + `get_score_flag_activity_counts`.
- **Supabase grant gotcha** — Supabase's initial setup grants EXECUTE on all public routines to anon + authenticated + service_role via `ALTER DEFAULT PRIVILEGES`. `REVOKE ... FROM PUBLIC` alone does NOT override — must name the roles. Caught during Studio verification when `has_function_privilege` stayed `true` after the PUBLIC-only revoke.

## Last Completed

**M8 — Kiba Index** (April 1, 2026, branch `m5-complete`)

## What Works

See `ROADMAP.md` `## Current Status` for the full M0–M8 completed list. M9 highlights:

- **Behavioral Feeding architecture** (migration 034) — `feeding_style` + `feeding_role` replacing slot model, Wet Reserve Engine, `computeBehavioralServing`. Canonical doc: `docs/plans/BEHAVIORAL_FEEDING_IMPLEMENTED.md`
- **Matte Premium design system** — `.agent/design.md`, `cardSurface` / `hairlineBorder` / `chipSurface` tokens, SwipeableRow, legacy `Colors.card` + `Colors.cardBorder` fully retired
- **HomeScreen category browse + Top Picks dedicated screen** (PR #10 open) — 4 category cards with sub-filter chips, `CategoryTopPicksScreen`, cache-maturity + self-healing scoring
- **Safe Switch premium UI overhaul** — recipe layout, saturated proportion gauge, retroactive logging, outcome-aware completion card, Phase B pantry-anchored swap RPC
- **D-168 tiered score framing** (supersedes D-094) — outbound share (`PetShareCard`) full phrase; in-app list rows `{score}% match`; dense surfaces incl. `ScoreRing` just `{score}%`. 7 terse surfaces backfilled with `accessibilityLabel` carrying the full phrase
- **M9 Bookmarks (D-169)** — per-pet watchlist (cap 20, free), `BookmarksScreen` + `ScanHistoryScreen` (up to 20 each), ResultScreen bookmark icon + overflow menu (Share / Report issue via `mailto:`), long-press on scan rows. Migration 040. PR #13 open.
- **M9 Multi-agent cleanup (session 62)** — dead-code sweep (`knip` + manual) removed `docs/plans/search-uiux/`, `ScanHistoryCard.tsx`, 64 unused exports, 3 unused deps + 6 truly-dead symbols; screen file-split refactor extracted 40+ sub-components to `src/components/<domain>/` across 9 colocated subfolders, shrinking the 8 screens >1,000 LOC by 3,132 lines (−35%). `knip@^6.6.1` + `madge@^8.0.0` kept as devDeps.

## What's Broken / Known Issues

- **Stale browse scores (largely mitigated)**: Form-aware cache maturity (session 34) + TopPicksCarousel self-healing scoring trigger (session 35) cover most gaps. Remaining edge: first visit to a form after full cache wipe shows spinner while batch scoring runs (~10s). CategoryBrowseScreen's unscored fallback still shows products without badges until scoring completes.

## Numbers

- **Tests:** 1889 passing / 106 suites (was 1886 / 105 at session 64 HEAD; +3 tests, +1 suite from review follow-up — XPRibbon race regression + candidates-RPC-errors case)
- **Decisions:** 132
- **Migrations:** 52 locally (001–052 — 001–049 applied to live DB as of session 64; 050 manually applied to prod via Studio SQL on 2026-04-24 (`migration repair` pending post-merge); 051 + 052 unapplied, will go via `supabase db push --linked` after PRs #19 + #20 merge)
- **Products:** 19,058 (483 vet diets, 1716 supplemental-flagged)

## Regression Anchors

- Pure Balance (Dog, daily food) = 61
- Temptations (Cat, treat) = 0
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 53 (fat >12% DMB penalty)

## Up Next

- **On-device QA for session 41 token edits** — tap PantryCard + BrowseProductRow → confirm subtle 5% white press lift reads (not invisible, not jarring). Watch PantryCard for brief outer-overlay flash when tapping inner buttons (Reorder, Replace this food, Log feeding, Gave a treat) — if distracting, add `unstable_pressDelay={150}` to the outer Pressable or convert inner buttons to Pressable too. Recalled card: confirm red left border stays visible during press + no artifacts at rounded corners (possible `overflow: 'hidden'` fix if artifacts). Visual sanity on TreatBatteryGauge (PetHubScreen) + BenchmarkBar (ResultScreen) + PositionMap (ResultScreen) after chipSurface swap — nothing broken.
- **Broader Matte Premium alpha audit (~17 sites)** — session 41 sweeper scope was `rgba(255,255,255,0.12)` specifically. Broader grep surfaces ~17 other rgba(255,255,255,0.0x) sites at various alphas (0.02, 0.03, 0.04, 0.08, 0.1 — now closed in session 41, 0.5, 0.7). Likely represent intentional token gaps, not drift: 0.08 borderTopColor sites probably want a dedicated `dividerBorder` token lighter than `hairlineBorder`; 0.04 nested-card lift backgrounds probably want `nestedCardTint`; 0.02-0.03 subtle tints in AddToPantryStyles; 0.5/0.7 opacity-like uses that probably shouldn't tokenize. Do NOT fix individually — this needs a dedicated session to catalog each site, design 1-3 new tokens, and migrate consistently. Before launch.
- **Sweeper iteration 4 candidate (deferred)** — separate bug from session 42 iteration 3. In session 41, the sweeper recommended `hairlineBorder` for TreatBatteryGauge.barTrack (28px), violating its own system prompt definition of `hairlineBorder` as "1-2px structural lines". Iteration 2 step 6 CRITICAL_OVERRIDE forbade recommendations in the ambiguous "stop and report" path (sidestep), but recommendations in other paths could still fire the same wrong-token bug. Deeper fix would add to step 1 (Load context): cross-check any design.md pattern against own token definitions at lines 21-22, prefer own definitions on conflict, flag design.md inconsistencies. Don't iterate .md again without a test cycle — run session 42 iteration 3 retest first.
- **Chipsurface visual QA (session 39 carry-over)** — `CreatePet`/`EditPet` Switches + segment buttons + weight chips, `NotificationPreferences` toggles, drag handles (`CompareProductPickerSheet`, `WeightEstimateSheet`), `WeightGoalSlider.rail`, `ScoreRing.track`, `VoteBarChart.track`, `ConditionChip`, `KibaIndexSection.noPetWarning`, `HealthConditionsScreen.sectionDivider`, `FeedbackCard.divider`, `FormulaChangeTimeline.connector`, `FeedingStyleSetupSheet` iconBoxes — all need eyeballs at 0.12. Watch for any site that reads too strong.
- **TopPicksCarousel populated-state border check (session 39 carry-over)** — inner `card` border was added based on same reasoning as `zeroStateCard`, but only zero state was visually verified.
- **On-device fuzzy search stress test (session 38 carry-over)** — typos, partial brand names, wrong word order. Verify relevance ranking.
- **Final visual QA pass on session 21 matte frame work** — user walked most of it during the session, but a full end-to-end scan through ResultScreen + HomeScreen category cards on a real device would close the loop. Specifically: scan one daily food, one treat, one supplement, one vet diet, one recalled product — confirm all bypass paths still render their cards cleanly (CollapsibleSection underlies Advisories, Treat Battery, Score Breakdown, Ingredients, Insights, Kiba Index).
- **PantryScreen.tsx chip-background visual review** — still a carry-over from session 20. Now lives in extracted `src/components/pantry/list/PantryFilterChips.tsx` after session-62 refactor. The `cardBorder → hairlineBorder` swap is the only non-border use (chip unselected state background). `rgba(255,255,255,0.12)` may read too faint vs `#333333`. If unselected filter chips look broken or invisible, revert that single line to a dedicated chip-surface token.
- **Stale browse scores** — CategoryBrowseScreen cache maturity check isn't form-aware (freeze-dried and other minority forms never get scored). Fix in both Edge Function and `batchScoreOnDevice.ts`.
- **Pantry unit model gap (deferred spec)** — wet food as BASE in Custom Splits returns 0 servings; dry food lbs-vs-cups display unclear. Full analysis + 6 open questions + 5 proposed directions at `docs/superpowers/specs/2026-04-12-pantry-unit-model-gap-DEFERRED.md`. Pick up post-M9 or whenever user data motivates it.
- **`SafeSwapSection.tsx` scattered paywall checks** — `canUseSafeSwaps` and `canCompare` called inside a component (pre-existing pattern, flagged in Phase 2 ultrareview). Needs a dedicated `src/utils/permissions.ts` audit sweep to pull them back to the callsite level.
- **`pantryService.ts` (1080 LOC) + `pantryHelpers.ts` (860 LOC) domain-split** — different refactor shape from the session-62 screen file-splits (service/util domain boundaries rather than component extraction). Separate session.
- Custom icon rollout (5 pending v2 bold variants)
- Search UX overhaul on HomeScreen
- Same-brand disambiguation for `getConversationalName` — deferred from session 19. Two products sharing brand + identical first-2 descriptor words render identical short names. Flag-later if users hit this in the wild.
- Enroll in Chewy Affiliate Partners + Amazon Associates → flip `affiliateConfig.ts` enabled: true
- M10: Community points (XP engine, streaks, product submissions — lite scope)
- M11: Symptom Detective (deferred — major App Store update feature)

## Optimization Status

- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session

- **Date:** 2026-04-23 (session 64 — M9 Community deployment: migrations applied to live DB, Edge Function deployed, expo-crypto runtime fix, README update)
- **Branch:** `m9-community` (PR #18 still open against `main`). Two substantive commits on top of session 63's `b94d0b1` plus this handoff:
  - `db94bfa` — `M9 community: drop expo-crypto native dep — use globalThis.crypto.randomUUID`
  - `ea9de4d` — `M9 community: update migrations README — 49 migrations + M9 Community section + 040 backfill`
- **Files changed this session:**
  - `src/services/recipeService.ts` — replaced `Crypto.randomUUID` (expo-crypto) with `globalThis.crypto.randomUUID` + RFC-4122 v4 fallback. Mirrors `pushService.ts:25` pattern.
  - `__tests__/services/recipeService.test.ts` — swapped `jest.mock('expo-crypto', ...)` for a `beforeEach` that pins the global. 18/18 still pass.
  - `supabase/migrations/README.md` — count 39→49, added missing `040_bookmarks` row, added full "M9 Community (041–049)" block with per-migration schema notes.
  - `docs/status/CURRENT.md` — Numbers block updated (migration apply state) + this handoff.
- **Accomplished:**
  - **Migrations 041–049 applied to live DB** (`jvvdghwbikwrzrowmlmt` — KibaScan's Project, the only project linked to this repo). `npx supabase db push --linked` ran cleanly in one transaction. **XP triggers are now LIVE** on `scan_history` + `kiba_index_votes` — every new scan/vote starts writing `user_xp_events` immediately.
  - **Migration history repair on 039 + 040.** Steven manually applied `039_wet_intent_resolved_at` + `040_bookmarks` via Studio's SQL editor previously (M5 011-019 pattern documented in CLAUDE.md). Ran `npx supabase migration repair --status applied 039 040 --linked` BEFORE `db push` to mark them applied without re-execution. `migration list --linked` now shows 001–049 all applied AND present locally.
  - **`validate-recipe` Edge Function deployed.** All 3 assets uploaded: `index.ts`, `deno.json`, `toxic_foods.json`. Live at `https://jvvdghwbikwrzrowmlmt.supabase.co/functions/v1/validate-recipe`. The toxic JSON was already in sync with `src/data/toxic_foods.json` (verified via `diff -q` before deploy).
  - **Runtime expo-crypto fix-forward** — emulator hit `[runtime not ready]: Cannot find native module 'ExpoCrypto'` because Task 15 added the dep after the existing dev client was built. Switched `recipeService.submitRecipe` to use `globalThis.crypto.randomUUID()` (native in Hermes / RN 0.74+) with an RFC-4122 v4 `Math.random()` fallback. `expo-crypto` left in `package.json` as harmless-when-unused. Reload-Metro-only fix; no native rebuild required.
  - **`supabase/migrations/README.md`** got the missing `040_bookmarks.sql` row (D-169) plus a complete new "M9 Community (041–049)" block documenting client-supplied UUID rationale, SELECT-only RLS + trigger-write pattern, RLS WITH CHECK pinning, SECURITY DEFINER discipline, storage-bucket-via-SQL milestone, and the timezone re-anchor on 048.
- **No new decisions, scoring changes, or migrations this session.** D-170 is still the latest decision (recorded in session 63). 132 decisions, 49 migrations.
- **Numbers (all green at HEAD before this handoff commit `ea9de4d`):** 105 suites / **1886 tests** / 3 snapshots (unchanged from session 63 — fix-forward swapped a mock; 0 net new tests). 132 decisions. **49 migrations applied to live DB** (state change — was unapplied at end of session 63). 19,058 products. Pure Balance = 61, Temptations = 0. `npx tsc --noEmit`: 11 lines (pre-existing structural `supabase/functions/batch-score/scoring/` Deno noise only — `src/` + `__tests__/` clean).
- **Not done yet:**
  - **Vendor data curation.** `docs/data/vendors.json` is still `{"vendors": []}` placeholder. Until Steven curates it and runs `npm run seed:vendors`, Vendor Directory shows the empty-state copy and the ResultScreen "Contact {brand}" overflow item never appears.
  - **First blog post via Studio.** BlogCarousel renders nothing until at least one row exists in `blog_posts` with `is_published=true`.
  - **First approved recipe via Studio.** FeaturedRecipeHero shows "Submit the first recipe" CTA until a row in `community_recipes` flips to `status='approved'`.
  - **On-device QA per `docs/qa/2026-04-23-m9-community-qa.md`.** Migration apply + Edge Function deploy items are now done; smoke check (test scan → `user_xp_totals` updates) + the 12-item app walk-through remain.
  - **PR #18 merge.** Open against `main`, awaiting on-device QA + Steven's final review.
  - **Future surface:** `recipe_flags` table + Kitchen detail "Report issue" rewire (D-170 placeholder).
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rotated: session 63 → Previous, this session → Last. `m9-community` HEAD should be the handoff commit landing this rotation (one above `ea9de4d`).
  2. **First-priority on-device QA item:** scan a real product, then check Studio → `user_xp_totals WHERE user_id = <your uid>`. Should show `total_xp = 10` (or 60 for first-discovery scan) + `streak_current_days = 1` + `streak_last_scan_date = today`. If the trigger silently fails, that's the SECURITY DEFINER ownership concern materialized — debug before declaring M9 done.
  3. Curate `docs/data/vendors.json` + `npm run seed:vendors`. Author 1 blog post via Studio. Submit + approve 1 recipe (chocolate test should auto-reject; clean recipe should land in `pending_review`).
  4. Pick whichever next item is highest-priority (or merge PR #18 + close M9 if QA is clean).
- **Gotchas / context for next session:**
  - **XP triggers are LIVE on production.** Existing users' new scans + Kiba Index votes will start writing `user_xp_events` immediately. Old scans don't backfill. If you ever need to wipe a test user's XP for re-testing: `DELETE FROM user_xp_events WHERE user_id = $1; UPDATE user_xp_totals SET total_xp = 0, scans_count = 0, discoveries_count = 0, contributions_count = 0, streak_current_days = 0, streak_last_scan_date = NULL WHERE user_id = $1;` — but the event ledger is meant to be append-only, so be careful in production.
  - **Migration repair is the right tool when "applied via Studio" drift surfaces.** `npx supabase migration repair --status applied <version> --linked` updates only the migration history (no SQL re-run). Safe AS LONG AS the schema actually matches what the migration file would have produced. If unsure, dump the schema first.
  - **`expo-crypto` left in `package.json` despite being unused** — harmless when no JS code imports it (no native registration attempt). Removing it requires `npm uninstall expo-crypto` + lockfile churn + a fresh dev client build. Defer until next dependency cleanup.
  - **`supabase db diff` requires Docker** for the shadow database — it failed with "Cannot connect to Docker daemon" this session. Use `supabase migration list --linked` for a quick "what's applied vs local" read-only check instead; no Docker needed.
  - **`supabase functions deploy` works without Docker.** Schema sync needs Docker for the shadow DB diff path, but Edge Function deploy is just an asset upload over the API.
  - **The dev client may still need a rebuild.** This session's `globalThis.crypto.randomUUID()` swap removed the JS-side `expo-crypto` import, which fixes the immediate `[runtime not ready]` error. But if the previous dev client was built after `expo-crypto` was added to `package.json`, native autolinking may have already registered ExpoCrypto. Reload Metro with `--clear`; if the error persists on cold launch, do a full `npx expo prebuild` + native rebuild.
  - **All session 63 gotchas still apply** — `recipe_flags` deferral, `vendors.json` placeholder, `react-native-marked` is the chosen markdown renderer, recipe images use client-supplied UUIDs.
  - **Rolling window:** session 62 dropped, session 63 demoted to Previous, this session takes Last.

## Previous Session

- **Date:** 2026-04-23 (session 63 — M9 Community shipped: full Community tab rebuild — XP engine, Kiba Kitchen, Vendor Directory, Toxic Database, Blog, Safety Flags)
- **Branch:** `m9-community` off `m5-complete@3a99e32`. 43 commits + the session-63 handoff doc commit. PR opened against `main`.
- **Final code SHA before handoff doc commit:** `65dfcdd` (CommunityScreen final assembly + populated/empty render tests, Phase 11 close).
- **Accomplished — full 11-phase / 32-task plan executed:**
  - **Spec:** `docs/superpowers/specs/2026-04-23-community-screen-design.md` (4 review-rounds: initial draft + Gemini reference artifacts + spec patches from second-pass review + third-pass review patches before dispatch).
  - **Plan:** `docs/superpowers/plans/2026-04-23-community-screen.md` (32 tasks across 11 phases — schema, helpers, services, screens, validators, deep-links, final assembly).
  - **Migrations 041–049** (NOT yet applied to staging — Docker was unavailable throughout):
    - 041 `community_recipes` (kill-switch via `is_killed`, status enum, client-supplied UUID)
    - 042 `user_xp` (events + totals tables, SELECT-only RLS for users)
    - 043 `blog_posts` (Studio CMS, public read of `is_published=true`)
    - 044 `vendors` (Studio CMS + bundled `assets/vendors.json` for offline reads)
    - 045 `score_flags` (D-072; `pet_id NOT NULL` + `product_id NOT NULL`; `recipe_concern` is one of the reason enum values)
    - 046 XP triggers (SECURITY DEFINER, idempotent on approval; `process_scan_xp`, `process_vote_xp`, `process_recipe_approval_xp`, `process_missing_product_approval_xp`, `upsert_user_xp_totals`)
    - 047 storage buckets (`recipe-images` user-folder RLS, `blog-images` service-role)
    - 048 `get_user_xp_summary` RPC
    - 049 `get_score_flag_activity_counts` RPC
  - **Pure helpers (TDD):** `xpLevel` (curve), `streakGap` (calendar-day with 1-day grace), `weeklyXPWindow` (ISO-week Monday 00:00 UTC), `validateRecipe` (toxic + UPVM checks), `brandSlugify`.
  - **Services:** `xpService`, `communityService` (recalls + Kiba Index highlights), `vendorService` (with bundled-slug sync check), `blogService`, `recipeService` (offline-guarded), `scoreFlagService`. All with tests.
  - **Edge Function:** `validate-recipe` (server-side toxic + UPVM auto-validators) + curated `assets/toxic_foods.json` (35 entries) + `npm run sync:toxics` script.
  - **Scripts:** `npm run sync:toxics`, `npm run seed:vendors` (with `published_vendor_slugs` artifact for bundled-slug sync check).
  - **Screens (11 new + 1 rebuild):** `CommunityScreen` (rebuild — XP ribbon + RecallBanner + DiscoveryGrid + KibaKitchenFeed featured hero + BlogCarousel + SubredditFooter), `ToxicDatabaseScreen`, `VendorDirectoryScreen`, `KibaKitchenFeedScreen`, `KibaKitchenSubmitScreen`, `KibaKitchenRecipeDetailScreen`, `BlogListScreen`, `BlogDetailScreen` (markdown via `react-native-marked`), `SafetyFlagsScreen` (tabbed: My Flags + Community Activity).
  - **Components:** `XPRibbon`, `RecallBanner`, `DiscoveryGrid` + 4 tiles (Toxic / Vendor / Kiba Index / Safety Flags), `SubredditFooter`, `RecipeDisclaimerBanner`, `SafetyFlagSheet`.
  - **ResultScreen overflow entries:** "Contact {brand}" deep-link (offline-safe; only renders when brand exists in vendors) + "Flag this score" → `SafetyFlagSheet` (D-072).
  - **D-072 community safety flags shipped end-to-end** (sheet + tabbed screen + ResultScreen entry).
- **New decisions:** **D-170 — Recipe-flag entry removed from Kitchen detail (deferred to dedicated `recipe_flags` table).** `score_flags` carries `pet_id NOT NULL + product_id NOT NULL` FKs; community recipes have neither. Wiring Kitchen's "Report issue" overflow to `SafetyFlagSheet` would either require relaxing those NOT NULL constraints (loses RLS rigor) or stuffing fake foreign keys (data quality breach). Cleanest path: keep schema honest, remove the stub from Kitchen detail, document that recipe concerns route through Studio email until a dedicated `recipe_flags` table or equivalent surface ships. The `recipe_concern` value remains in the `score_flags.reason` enum for the future `recipe_flags` migration's reason taxonomy. Recorded inline at `src/screens/KibaKitchenRecipeDetailScreen.tsx:13-19`. Header bumped 131 → 132 / D-001–D-169 → D-001–D-170.
- **Migrations needing apply:** 041–049 + the storage buckets in 047. Run `npx supabase db push` against staging — Docker was unavailable throughout dev so all migrations are unapplied. After push, deploy `validate-recipe` Edge Function (`npx supabase functions deploy validate-recipe`) and run `npm run sync:toxics` so the curated toxic JSON ships in the function bundle. Once Steven curates `assets/vendors.json`, run `npm run seed:vendors` to upsert into the `vendors` table.
- **Numbers (all green at code HEAD `65dfcdd`):** 105 suites / **1886 tests** / 3 snapshots (+221 from 1665). 132 decisions. 49 migrations (001–049 — 041–049 unapplied to staging). 19,058 products. Pure Balance = 61, Temptations = 0. `npx tsc --noEmit`: 11 lines (pre-existing structural `supabase/functions/batch-score/scoring/` Deno noise only — `src/` + `__tests__/` clean). `npx madge --circular src/`: zero cycles.
- **Carry-over for the on-device pass (see `docs/qa/2026-04-23-m9-community-qa.md`):**
  - Empty-state copy correctness on every Community surface (XP ribbon at 0 XP, Vendor Directory before vendors.json populated, Kiba Kitchen before first approval, Blog before first post, Safety Flags Community Activity tab on a fresh DB)
  - Auto-validator coverage: chocolate recipe → `auto_rejected`; clean recipe → `pending_review`; UPVM-non-compliant copy → `auto_rejected`
  - Migration apply checklist also lives in the QA doc
- **Not done yet:**
  - On-device QA — no device available in dev env. Steven runs `docs/qa/2026-04-23-m9-community-qa.md`.
  - Migrations 041–049 NOT yet applied — Docker was unavailable.
  - `vendors.json` curation + `npm run seed:vendors` — placeholder file only.
  - First blog post + first approved recipe via Studio so the populated states show.
  - **Future surface:** `recipe_flags` table + Kitchen detail "Report issue" rewire (D-170 placeholder).
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rotated: session 62 → Previous, new session → Last. `m5-complete` HEAD should be the squash-merge of PR `m9-community`.
  2. Apply migrations 041–049 against staging via `npx supabase db push`. Verify per `docs/qa/2026-04-23-m9-community-qa.md` apply checklist.
  3. Walk the on-device QA list. File any regressions as new fix-forward commits before flipping focus to next M9 scope.
- **Gotchas / context for next session:**
  - **Migrations 041–049 are unapplied.** Don't trust any local Supabase state until `npx supabase db push` lands. RPCs (`get_user_xp_summary`, `get_score_flag_activity_counts`) and triggers (`process_scan_xp`, etc.) won't exist on staging until then.
  - **`score_flags.pet_id NOT NULL`** is intentional — D-170 documents why. If a future agent re-encounters the Kitchen recipe report stub, do NOT relax the constraint. Build `recipe_flags` instead.
  - **Validate-recipe Edge Function depends on `assets/toxic_foods.json` being synced into the function bundle.** `npm run sync:toxics` is the contract. CI doesn't gate this yet — manual pre-deploy step.
  - **`vendors.json` is a placeholder.** Empty state copy is the right reality until Steven curates the seed data.
  - **`react-native-marked`** is the chosen markdown renderer for blog detail. Note in spec §10 — alternative renderers were rejected for image-handling parity.
  - **Recipe images use a client-supplied UUID** so the storage path can be assembled BEFORE the `community_recipes` row insert. See spec §6.1 + the recipeService implementation. If a future change wants server-supplied UUIDs, the upload-then-insert ordering must change too.
  - **All session-62 gotchas still apply.**
  - **Rolling window:** session 61 dropped, session 62 demoted to Previous, this session 63 takes Last.

