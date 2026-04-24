# Project Status — Last updated 2026-04-23 (session 63 — M9 Community shipped: full Community tab rebuild — XP engine, Kiba Kitchen, Vendor Directory, Toxic Database, Blog, Safety Flags; PR open on `m9-community`)

## Active Milestone

**M9 — UI Polish & Search** (search UX overhaul, general polish, UX friction fixes)

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

- **Tests:** 1886 passing / 105 suites
- **Decisions:** 132
- **Migrations:** 49 (001–049 — 041–049 NOT yet applied to staging; Docker was unavailable during dev. Apply via `npx supabase db push`.)
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

- **Date:** 2026-04-23 (session 63 — M9 Community shipped: full Community tab rebuild — XP engine, Kiba Kitchen, Vendor Directory, Toxic Database, Blog, Safety Flags)
- **Branch:** `m9-community` off `m5-complete@3a99e32`. 43 commits + this handoff doc commit. PR open against `main`.
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

## Previous Session

- **Date:** 2026-04-23 (session 62 — Multi-agent cleanup: Phase 1 dead-code sweep + Phase 2 eight-screen file-split refactor; both phases merged)
- **Merges on `m5-complete`:**
  - `bc683b0` — PR #16 "M9 dead-code sweep — knip + manual targets" (squash of 11 per-agent + fix-forward commits on `m9-deadcode-sweep`). Ultrareview returned 2 nits, both fix-forwarded.
  - `3a99e32` — PR #17 "M9 refactor — 8 parallel screen file-splits" (squash of 10 per-agent + fix-forward commits on `m9-screen-splits`). Follows `bc683b0`. Ultrareview returned 3 nits, all fix-forwarded.
  Both feature branches deleted locally + remote via `gh pr merge --squash --delete-branch`.
- **Accomplished — full Brainstorming → Writing-Plans → Subagent-Driven Development → 2 Gemini review rounds → 2 Ultrareview burns → 2 Merges loop:**
  - **Spec:** `docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md` — two sequential passes, each with its own branch + ultrareview. Integrated two rounds of external review feedback before dispatch (mechanical fixes to knip entry config, tsc gate semantics, macOS `grep -P` → `grep -E`, jest `--maxWorkers=1`, `node -e "require.resolve(...)"` not `require()`).
  - **Plan:** `docs/superpowers/plans/2026-04-22-multi-agent-cleanup.md` — 13 tasks across 2 phases.
  - **Phase 1 (dead-code sweep, serialized D1 → A → B → C → D2):** installed `knip@^6.6.1` + `knip.json` tuned for RN/Expo (babel.config.js, metro.config.js, app.json, `*.config.{js,ts,cjs,mjs}` as `entry`; test files in `entry` not `project`; `ignoreDependencies` for `babel-preset-expo` + `babel-plugin-transform-import-meta` because they're string-referenced in `babel.config.js`). Fresh knip report ran between each agent to catch cascading dead-code. Final Phase 1 delta: `docs/plans/search-uiux/` deleted (10 files causing 68 pre-existing tsc errors), `src/components/ScanHistoryCard.tsx` deleted (zero live callers; `ScanHistoryScreen` inlines its rendering), 4 stale-doc references to ScanHistoryCard cleaned up (CLAUDE.md, DECISIONS.md D-168 list ×3, `.agent/workflows/legacy-token-migration.md`, `.claude/agents/kiba-code-reviewer.md`), 64 `export` keywords removed across 30 src/** files (keyword-only), 3 unused deps removed (`@expo/ngrok`, `patch-package`, `ts-jest` → 917 lockfile lines dropped). Ultrareview fix-forward additionally deleted 6 truly-dead symbols (`computeDER`, `unregisterPushToken`, `MOISTURE_THRESHOLD`, `BREED_MODIFIER_CAP`, `scanButton`, `hepaticWarning`) + 4 orphaned imports + 1 duplicate `DECISIONS.md` PantryCard bullet (introduced by an Agent A fix-forward that replaced the ScanHistoryCard line instead of deleting it).
  - **Phase 2 (refactor — 8 screens file-split):**
    - First attempt used `Agent({isolation: "worktree"})` in parallel. **The harness rooted worktrees off stale ancestor commit `e6c8069`** (pre-M9 state), so 3 agents that succeeded reported 70/1588 tests (pre-M9 count). Abandoned — nuked 8 worktrees + branches.
    - Second attempt dispatched 8 agents **serially in the main working tree** on `m9-screen-splits`, one at a time, sonnet model each. Wall-clock ~60 min total. `madge@^8.0.0` installed for circular-import verification (Rule 8). Baseline at `/tmp/kiba-tsc-baseline.txt` (absolute path — originally for worktree agents; serial approach didn't need it but plan retained).
    - Per-screen deltas (parent LOC before → after / extract count):
      - `SafeSwitchDetailScreen`: **1226 → 823 (−403)**, 5 extracts → `src/components/safeSwitch/`
      - `EditPantryItemScreen`: **1222 → 1167 (−55)**, 1 extract → `src/components/pantry/edit/` + helpers → `src/utils/editPantryItemHelpers.ts`, test import updated. Agent timed out mid-work; partial state was consistent + gate-green, salvaged per Rule 7.
      - `HomeScreen`: **1214 → 581 (−633)**, 9 extracts → `src/components/home/`
      - `ResultScreen`: **1122 → 1049 (−73)**, 3 extracts → `src/components/result/`, intentionally conservative — skipped score ring / bypass banners / Kiba Index per Rule 7 escape hatch (highest-stakes screen)
      - `EditPetScreen`: **1083 → 538 (−545)**, 5 extracts → `src/components/pet/edit/`
      - `PetHubScreen`: **1069 → 712 (−357)**, 5 extracts → `src/components/pethub/`
      - `CompareScreen`: **1055 → 440 (−615)**, 6 extracts → `src/components/compare/`
      - `PantryScreen`: **1041 → 590 (−451)**, 6 extracts → `src/components/pantry/list/` + helpers → `src/utils/pantryScreenHelpers.ts`, test import + cross-import fix in `EditPantryItemScreen` (it previously imported `shouldShowD157Nudge` from `PantryScreen`)
    - `kiba-code-reviewer` pre-flight found **4 D-168 a11y gaps** pre-existing in originals but crystallized into new prop interfaces (`SearchResultsList` + `CompareOtherPets` + `ComparisonCard` missing `petName` prop + `accessibilityLabel`) + **2 D-094 → D-095/D-168 comment drift fixes** in `CompareProductHeader` / `CompareNutrition`. All fix-forwarded.
    - `/ultrareview` (PR #17) flagged **3 nits**: `BookmarksSection` dead `activePetId` prop (HomeScreen's `handleBookmarkCardPress` already closed over it), `FedThisTodayActionCard.tsx` orphan (Agent 2 timeout artifact — wired in per Option A), `ProductImageBlock` 8px margin drift (`marginBottom: 16` literal vs original `Spacing.lg` = 24). All fix-forwarded.
  - **Screen total: 9032 → 5900 LOC (−3,132, −35%).** Plus ~3,400 lines removed from Phase 1 dead-code + lockfile cleanup.
- **New decisions, migrations, scoring changes:** none. No schema work. Regression anchors untouched (Pure Balance = 61, Temptations = 0). Scoring engine (`src/services/scoring/`) and `src/utils/permissions.ts` not modified.
- **New tooling kept in repo:** `knip@^6.6.1` (devDep) + `knip.json` config — available for future dead-code sweeps. `madge@^8.0.0` (devDep) — available for future circular-import verification.
- **Key new subfolders created in `src/components/`:** `home/` (9 files), `safeSwitch/` (5 files), `pet/edit/` (5 files), `compare/` (6 new files in existing folder), `pethub/` (5 files), `pantry/list/` (6 files), `pantry/edit/` (1 file), `result/` (3 new files). Plus `src/utils/editPantryItemHelpers.ts` + `src/utils/pantryScreenHelpers.ts`.
- **Numbers (all green at HEAD `3a99e32`):** 79 suites / **1665 tests** (unchanged — refactor preserved all test logic; only `import` paths in 2 test files changed per Rule 4). 131 decisions. 40 migrations. 19,058 products. Pure Balance = 61, Temptations = 0. `npx tsc --noEmit`: 11 lines (structural `batch-score/scoring/` Deno noise only — search-uiux noise eliminated). `npx madge --circular src/`: zero cycles across 199+ files.
- **Not done yet:**
  - **`SafeSwapSection.tsx` scattered paywall checks** — pre-existing but flagged in Phase 2 ultrareview. Dedicated `permissions.ts` audit pass needed to pull `canUseSafeSwaps`/`canCompare` calls back to callsite.
  - **Hardcoded `#FFFFFF` literals in a few extracts** (pre-existing patterns from originals) — candidate for future design-token sweep.
  - **Session 61 carry-items still open:** on-device QA of shimmer cadence / cache-miss force path / cross-pet race reproduction; `usePantryStore.logTreat` narrow revert-window fix; VoiceOver QA on 11 bookmark/scan + 7 D-168 a11y-backfill surfaces; render-test hardening for near-cap amber `toHaveStyle` check; `batchScoreOnDevice.ts:291` network-failure diagnosis.
  - **Matte Premium ~17 rgba alpha sites** — explicitly deferred per CURRENT.md guidance.
  - **`pantryService.ts` (1080 LOC) + `pantryHelpers.ts` (860 LOC) domain-split** — different refactor shape, separate session.
  - **Next M9 scope pick:** custom icon rollout (5 pending v2 bold variants), stale browse scores form-aware fix, broader Matte Premium alpha audit.
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rotated: session 62 → Previous, new session → Last. `m5-complete` HEAD should be `3a99e32` or newer.
  2. Pick one: (a) session 61 carry-items (shimmer QA, logTreat, VoiceOver); (b) `permissions.ts` audit (SafeSwapSection scatter); (c) `pantryService`/`pantryHelpers` domain-split.

  On-device smoke check of the 8 refactored screens (session 62) came back clean — dropped from the queue.
- **Gotchas / context for next session:**
  - **`Agent` tool `isolation: "worktree"` roots off a stale ancestor, NOT current HEAD.** Experimentally verified this session: worktrees created off `e6c8069` despite current branch at `0795596`. 3 partial-success agents reported 70/1588 tests (pre-M9). If you need worktree isolation in the future, verify each worktree's `git log -1` matches your expected base BEFORE trusting its output. For refactors that need current HEAD, dispatch **serially in the main tree** — wall-clock ~60 min for 8 agents was acceptable.
  - **Stream idle timeout on long agents is a real risk.** Agent 2 (EditPantryItemScreen) timed out at 32 tool uses with "API Error: Stream idle timeout - partial response received". Partial state on disk was consistent and gate-green, so we salvaged it per Rule 7. Budget for timeouts on long-running agents; have a "verify + commit what's on disk" fallback.
  - **knip 6.x JSON schema is `{issues: [{file, files, exports, dependencies, devDependencies, types, ...}]}`, NOT flat top-level arrays.** Earlier plan drafts assumed the flat schema and would have produced empty candidate lists silently. Correct extraction: `r.issues.flatMap(i => (i.exports || []).map(...))`. Documented in updated plan.
  - **knip.json tuning for RN/Expo:** test files go in `entry` (not `project`) or 78+ tests get flagged as unused-file false positives. `babel-preset-expo` + `babel-plugin-transform-import-meta` need `ignoreDependencies` because they're string-referenced in `babel.config.js` (knip's Babel plugin only auto-detects `@babel/*` packages).
  - **D-168 a11y gap pattern during extraction:** when the original screen didn't pass `petName` for the accessibilityLabel, the extract inherits that gap AND crystallizes it into the new prop interface. Cheaper to fix in situ (add `petName` prop + thread it) during the extraction than to defer. `kiba-code-reviewer` pre-flight caught 4 such gaps this session.
  - **`/ultrareview` catches cleanup the code-reviewer misses.** Phase 1 ultrareview found 6 truly-dead symbols that Agent B's "keyword-only unexport" contract preserved (keyword-only was correct per contract but a dead-code-framed sweep should catch these). Phase 2 ultrareview found an orphaned component, a dead prop, and an 8px style drift. Don't skip ultrareview on "mechanical" work.
  - **`git reset --hard` is blocked by permission hooks.** User must run it manually via `!` prefix after each squash-merge to sync local `m5-complete`. `gh pr merge --squash --delete-branch` only deletes the local feature branch — local `m5-complete` diverges because the 10+ intermediate feature-branch commits live locally but origin has only the squash. Fix: `!git reset --hard origin/m5-complete`.
  - **Squash-merges lose the per-agent TDD trail.** Phase 1's per-agent commits became `bc683b0`; Phase 2's per-agent commits became `3a99e32`. If you need that granularity for future debugging, fetch feature-branch SHAs BEFORE `--delete-branch` OR preserve the intermediate commits in the final squash commit body.
  - **ScanHistoryCard.tsx no longer exists.** If future sessions cite D-168 implementation examples or look for in-app list-row exemplars, use `PantryCard` (not ScanHistoryCard — file deleted this session). CLAUDE.md line 46, DECISIONS.md D-168 list (3 lines), `.claude/agents/kiba-code-reviewer.md`, and `.agent/workflows/legacy-token-migration.md` were all updated.
  - **All session-60/61 gotchas still apply.**
