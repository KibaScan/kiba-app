# Project Status — Last updated 2026-04-23 (session 62 — Multi-agent cleanup: dead-code sweep + 8-screen refactor; PRs #16 + #17 merged as `bc683b0` + `3a99e32`)

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

- **Tests:** 1665 passing / 79 suites
- **Decisions:** 131
- **Migrations:** 40 (001–040)
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
- HomeScreen visual overhaul (custom assets, layout polish) — now at 581 LOC after session 62, much more approachable target
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
  - **On-device smoke check** of all 8 refactored screens — scroll, tap, compare to pre-refactor visual memory. Priority order: `ResultScreen` + `CompareScreen` (score surfaces, most a11y-sensitive) → `HomeScreen` (category carousel + recent scans + search bar, most extracts) → `PantryScreen` (pet carousel + filter chips) → the remaining four.
  - **`SafeSwapSection.tsx` scattered paywall checks** — pre-existing but flagged in Phase 2 ultrareview. Dedicated `permissions.ts` audit pass needed to pull `canUseSafeSwaps`/`canCompare` calls back to callsite.
  - **Hardcoded `#FFFFFF` literals in a few extracts** (pre-existing patterns from originals) — candidate for future design-token sweep.
  - **Session 61 carry-items still open:** on-device QA of shimmer cadence / cache-miss force path / cross-pet race reproduction; `usePantryStore.logTreat` narrow revert-window fix; VoiceOver QA on 11 bookmark/scan + 7 D-168 a11y-backfill surfaces; render-test hardening for near-cap amber `toHaveStyle` check; `batchScoreOnDevice.ts:291` network-failure diagnosis.
  - **Matte Premium ~17 rgba alpha sites** — explicitly deferred per CURRENT.md guidance.
  - **`pantryService.ts` (1080 LOC) + `pantryHelpers.ts` (860 LOC) domain-split** — different refactor shape, separate session.
  - **Next M9 scope pick:** HomeScreen visual overhaul (now at 581 LOC, much more approachable), custom icon rollout (5 pending v2 bold variants), stale browse scores form-aware fix, broader Matte Premium alpha audit.
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rotated: session 62 → Previous, new session → Last. `m5-complete` HEAD should be `3a99e32` or newer.
  2. **On-device smoke check** on the 8 refactored screens. Prioritize ResultScreen + CompareScreen + HomeScreen.
  3. Pick one: (a) on-device findings; (b) session 61 carry-items (shimmer QA, logTreat, VoiceOver); (c) HomeScreen visual overhaul; (d) `permissions.ts` audit (SafeSwapSection scatter); (e) `pantryService`/`pantryHelpers` domain-split.
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

## Previous Session

- **Date:** 2026-04-22 (session 61 — BookmarkRow extract + cache-miss shimmer + cross-pet race audit; three stacked commits on `m9-bookmark-row-extract` → PR #15)
- **Branch:** `m9-bookmark-row-extract` off `m5-complete@c99e669`. Three commits stacked in one session: `c5d4e55` (extraction) → `8466b65` (pending split) → `b17a631` (race audit). Pushed to `origin/m9-bookmark-row-extract`.
- **PR:** [#15](https://github.com/KibaScan/kiba-app/pull/15) — **merged** (squash) to `m5-complete` as `3d61319`. Ultrareview returned zero findings. Feature branch `m9-bookmark-row-extract` deleted locally + remote. `origin/m5-complete` fast-forwarded `1f9e8d5..3d61319`.
- **Accomplished:** closed three session-60 carry items as three stacked commits, each with a full red→green TDD cycle and a final full-suite pass.
  - **`c5d4e55` — `BookmarkRow` extraction.** Moved the inline `BookmarkRow` component from `BookmarksScreen.tsx` into `src/components/bookmarks/BookmarkRow.tsx` (new, 205 lines). Matches the colocated `PantryCard` / `ScanHistoryCard` pattern. Navigation decoupled via `onPress: () => void` callback instead of threading a `CompositeNavigationProp` into the row. `BookmarksScreen.tsx` dropped 148 net lines. Existing 6 render tests stayed green without modification — the extraction was pure refactor, not behavior change.
  - **`8466b65` — pending-vs-bypass state split + shimmer.** Added pure helper `src/utils/bookmarkRowState.ts` with discriminated union `BookmarkRowState = recalled | scored | bypass | pending` and precedence recalled > bypass > scored > pending. Rewired `BookmarkRow` to consume the helper. Added new `<PendingShimmer />` sub-component using `Animated.loop` opacity pulse (0.4 ↔ 0.85, 1.1 s total cycle, native driver). Pending state announces `"{brand} {name}, score pending"` to VoiceOver instead of falling through to the bare brand/name label (which was being announced previously because `isBypass` was conflating `final_score == null` with genuine vet-diet / variety-pack bypasses). Fixes the on-device regression surfaced in session 60 (transient Supabase hiccup → all 17 bookmark rows rendered `—` with no re-hydrate signal). 7 unit tests on the helper (incl. stale-score-on-vet-diet edge case) + 2 render tests on the screen (pending shows shimmer placeholder + no `—`; vet-diet with null score still shows `—` — bypass wins over pending).
  - **`b17a631` — cross-pet race audit** on `usePantryStore` + `useTopMatchesStore`. Advisor distinguished TWO distinct bug classes that must NOT share an abstraction:
    - **Pantry (cache-staleness):** `addItem` / `removeItem` / `restockItem` / `updateItem` / `shareItem` previously used `pid = get()._petId ?? petId` AFTER the server await, so a mid-flight pet switch misrouted the refetch to the new active pet AND left the mutated pet's `_petCache[petId]` entry stale. Fix: always refetch the explicit `petId` arg (or capture `_petId` pre-await for item-keyed mutations like restock/update), always write `_petCache[petId]`, gate top-level `items`/`dietStatus`/`error` writes on `_petId === petId`. Removed the `?? get().activeSwitchData` fallback to avoid leaking the active pet's switch data into another pet's cache.
    - **Top Matches (overwrite):** `loadTopMatches` / `refreshScores` previously did an unconditional `set({ scores })` after the fetch resolved. If the user switched pets mid-fetch, the stale pet's scores clobbered the visible list. Fix: gate `scores` write on `useActivePetStore.getState().activePetId === petId` (this store carries no pet state of its own).
    - **Safe by construction, no fix needed:** `useTreatBatteryStore` (per-pet map, no top-level state), `useScanStore` (no pet state at all), `usePantryStore.loadPantry` (already guarded by `_petId !== petId` returns on success and error paths).
    - **`usePantryStore.logTreat` NOT fixed in this pass:** it's already cache-safe (all writes keyed to the explicit `petId` arg), but has a narrow top-level revert window on the optimistic path. Documented inline rather than fixed.
    - 2 regression tests (one per pattern) — both verified to fail on a temporary revert-and-retest pass before the PR was opened.
- **New decisions, migrations, scoring changes:** none. No schema work. Regression anchors untouched (Pure Balance = 61, Temptations = 0).
- **Files changed on `m9-bookmark-row-extract` (vs. `m5-complete@c99e669`):**
  - `src/components/bookmarks/BookmarkRow.tsx` (new, 205 lines) — extracted row + `<PendingShimmer />` + `buildA11yLabel` + `<TrailingChip />` helpers + styles
  - `src/utils/bookmarkRowState.ts` (new, 45 lines) — `deriveBookmarkRowState` pure helper + `BookmarkRowState` discriminated union
  - `src/screens/BookmarksScreen.tsx` (−157 / +9) — imports extracted `BookmarkRow`, threads `onPress` callback, drops row-only styles + `getScoreColor`/`sanitizeBrand`/`stripBrandFromName` imports
  - `src/stores/usePantryStore.ts` (+186 / −71) — 5 mutations patched; `logTreat` inline comment
  - `src/stores/useTopMatchesStore.ts` (+17 / −6) — 2 methods patched
  - `__tests__/utils/bookmarkRowState.test.ts` (new, 75 lines, 7 tests)
  - `__tests__/stores/usePantryStore.test.ts` (new, 130 lines, 2 tests)
  - `__tests__/stores/useTopMatchesStore.test.ts` (new, 97 lines, 2 tests)
  - `__tests__/screens/BookmarksScreen.test.tsx` (+17 / 0) — pending shimmer render test + bypass-wins-over-pending test
- **Numbers (all green):** 79 suites / **1665 tests** / 3 snapshots (+13 from 1652: 7 bookmarkRowState unit + 2 BookmarksScreen render + 2 pantry race + 2 topmatches race). 131 decisions. 40 migrations. 19,058 products. Pure Balance = 61, Temptations = 0. `npx tsc --noEmit` clean in `src/` + `__tests__/` (pre-existing noise in `docs/plans/search-uiux/` + `supabase/functions/batch-score/` only).
- **Not done yet:**
  - **On-device QA of all three commits:**
    1. Shimmer cadence on a populated Bookmarks list — confirm quiet and not busy on 17 rows. If distracting, bump off-state from 0.4 → 0.5 or slow the cycle to 1.3 s in `PendingShimmer`.
    2. Force a cache-miss (cold start after network flap) and confirm pending rows pulse while `pet_product_scores` JIT-rehydrates, flipping to scored pills one by one. VoiceOver should announce "score pending" on pulsing rows, "vet diet" on vet-diet rows (bypass precedence still intact).
    3. Cross-pet race repro via fast PetHubScreen carousel tap during (a) AddToPantrySheet add, (b) EditPantryItemScreen save/restock/delete, (c) Top Matches refresh on HomeScreen — confirm no ghost rows from prior pet flash into the new pet's list.
  - **`usePantryStore.logTreat` narrow window.** Flagged in inline comment but not fixed. Address if observed in on-device QA.
  - **Carry items still open from session 60:** on-device VoiceOver QA on 11 bookmark/scan surfaces + 7 D-168 a11y-backfill surfaces; render-test hardening for near-cap amber `toHaveStyle` check; `batchScoreOnDevice` network-failure diagnosis at line 291.
  - **Next M9 scope pick:** HomeScreen visual overhaul, custom icon rollout (5 pending v2 bold variants), stale browse scores form-aware fix, broader Matte Premium alpha audit (~17 rgba sites).
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rotated: session 61 → Previous, new session → Last. `m5-complete` HEAD should be `3d61319`.
  2. **On-device QA** of the three stacked commits — shimmer cadence, cache-miss force path, cross-pet race reproduction.
  3. Pick one: (a) on-device findings from the QA pass; (b) `logTreat` narrow-window fix if flagged by QA; (c) next M9 scope.
- **Gotchas / context for next session:**
  - **Two race patterns are NOT one.** Bookmark / TopMatches (flat top-level state) and Pantry (per-pet `_petCache` + duplicated top-level `items`) are structurally different bugs. The advisor explicitly flagged against extracting a shared `withActivePetGuard` helper — one abstraction would hide the distinction. Pantry writes `_petCache[petId]` always, gates top-level on active. Bookmark/TopMatches skips the write entirely if not active. If you audit more stores, keep the two patterns separate.
  - **`accessibilityElementsHidden` + `importantForAccessibility="no"` hide the view from `@testing-library/react-native` `findByTestId`.** Dropping those props is fine when the parent `TouchableOpacity`'s `accessibilityLabel` subsumes the child — per session-58 D-168 learning, children of a labeled wrapper don't need their own a11y props. Caught by the pending-shimmer render test failing until the props were removed.
  - **Jest mocks for hanging promises: pre-create the Promise.** If a test needs a mid-await state switch, don't do `mockImplementationOnce(() => new Promise((resolve) => { resolveFn = resolve }))` — the executor only runs when the mock is called, which may be after an earlier `await`. Instead: `const hanging = new Promise((resolve) => { resolveFn = resolve; }); mock.mockImplementationOnce(() => hanging);`. Resolver is assigned synchronously on test setup.
  - **Session 60's `batchScoreOnDevice.ts:291` network-failure gotcha** directly motivated the pending-shimmer work. If that re-hydrate ever fails silently again, rows correctly pulse now instead of showing `—`. Still worth a defensive fix on the service side.
  - **Advisor was helpful on scope.** The session-60 handoff phrased option 3 as "port the guard" — a narrow/mechanical framing. Advisor caught that pantry and bookmarks are different patterns requiring different fixes, saved me from misapplying one abstraction to both. Keep consulting before substantive multi-site work.
  - **`pid = get()._petId ?? petId` idiom in `usePantryStore` was almost-but-not-quite right.** It mostly "self-corrected" to the active pet, so top-level state wasn't visibly broken. The hidden bug was `_petCache[petId]` never being populated for the mutated pet — so switching back to that pet showed stale cache until a full refocus. If you audit any other store that reads `_petId` after a server await, the same trap applies.
  - **All session-60 gotchas still apply:** `Colors.primary` doesn't exist (use `Colors.accent`); `SwipeableRow` is default export; `batchScoreHybrid` JIT is fire-and-forget for null-score cache; no toast utility; squash-merges lose the TDD trail (preserve fix-forward commits on the feature branch's `origin/` ref).
