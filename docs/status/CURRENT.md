# Project Status — Last updated 2026-04-22 (session 61 — BookmarkRow extract + cache-miss shimmer + cross-pet race audit; PR #15 open)

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
- **PantryScreen.tsx:435 chip-background visual review** — still a carry-over from session 20. The `cardBorder → hairlineBorder` swap at line 435 is the only non-border use (chip unselected state background). `rgba(255,255,255,0.12)` may read too faint vs `#333333`. If unselected filter chips look broken or invisible, revert that single line to a dedicated chip-surface token.
- **Stale browse scores** — CategoryBrowseScreen cache maturity check isn't form-aware (freeze-dried and other minority forms never get scored). Fix in both Edge Function and `batchScoreOnDevice.ts`.
- **Pantry unit model gap (deferred spec)** — wet food as BASE in Custom Splits returns 0 servings; dry food lbs-vs-cups display unclear. Full analysis + 6 open questions + 5 proposed directions at `docs/superpowers/specs/2026-04-12-pantry-unit-model-gap-DEFERRED.md`. Pick up post-M9 or whenever user data motivates it.
- HomeScreen visual overhaul (custom assets, layout polish)
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

- **Date:** 2026-04-22 (session 61 — BookmarkRow extract + cache-miss shimmer + cross-pet race audit; three stacked commits on `m9-bookmark-row-extract` → PR #15)
- **Branch:** `m9-bookmark-row-extract` off `m5-complete@c99e669`. Three commits stacked in one session: `c5d4e55` (extraction) → `8466b65` (pending split) → `b17a631` (race audit). Pushed to `origin/m9-bookmark-row-extract`.
- **PR:** [#15](https://github.com/KibaScan/kiba-app/pull/15) — open against `m5-complete`, awaiting human review. `m5-complete` is still the branch that stays ahead of `main`; PR #15 is the next addition to it.
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
  - **Merge PR #15 into `m5-complete`** pending human review.
  - **On-device QA of all three commits:**
    1. Shimmer cadence on a populated Bookmarks list — confirm quiet and not busy on 17 rows. If distracting, bump off-state from 0.4 → 0.5 or slow the cycle to 1.3 s in `PendingShimmer`.
    2. Force a cache-miss (cold start after network flap) and confirm pending rows pulse while `pet_product_scores` JIT-rehydrates, flipping to scored pills one by one. VoiceOver should announce "score pending" on pulsing rows, "vet diet" on vet-diet rows (bypass precedence still intact).
    3. Cross-pet race repro via fast PetHubScreen carousel tap during (a) AddToPantrySheet add, (b) EditPantryItemScreen save/restock/delete, (c) Top Matches refresh on HomeScreen — confirm no ghost rows from prior pet flash into the new pet's list.
  - **`usePantryStore.logTreat` narrow window.** Flagged in inline comment but not fixed. Address if observed in on-device QA.
  - **Carry items still open from session 60:** on-device VoiceOver QA on 11 bookmark/scan surfaces + 7 D-168 a11y-backfill surfaces; render-test hardening for near-cap amber `toHaveStyle` check; `batchScoreOnDevice` network-failure diagnosis at line 291.
  - **Next M9 scope pick:** HomeScreen visual overhaul, custom icon rollout (5 pending v2 bold variants), stale browse scores form-aware fix, broader Matte Premium alpha audit (~17 rgba sites).
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rotated: session 61 → Previous, new session → Last.
  2. **Check PR #15 status** — merged / pending review / requesting changes. If merged, confirm `m5-complete` fast-forwarded and delete the feature branch locally. If review feedback, stack fixes on the same branch.
  3. **On-device QA** of the three stacked commits — shimmer cadence, cache-miss force path, cross-pet race reproduction.
  4. Pick one: (a) on-device findings from the QA pass; (b) `logTreat` narrow-window fix if flagged by QA; (c) next M9 scope.
- **Gotchas / context for next session:**
  - **Two race patterns are NOT one.** Bookmark / TopMatches (flat top-level state) and Pantry (per-pet `_petCache` + duplicated top-level `items`) are structurally different bugs. The advisor explicitly flagged against extracting a shared `withActivePetGuard` helper — one abstraction would hide the distinction. Pantry writes `_petCache[petId]` always, gates top-level on active. Bookmark/TopMatches skips the write entirely if not active. If you audit more stores, keep the two patterns separate.
  - **`accessibilityElementsHidden` + `importantForAccessibility="no"` hide the view from `@testing-library/react-native` `findByTestId`.** Dropping those props is fine when the parent `TouchableOpacity`'s `accessibilityLabel` subsumes the child — per session-58 D-168 learning, children of a labeled wrapper don't need their own a11y props. Caught by the pending-shimmer render test failing until the props were removed.
  - **Jest mocks for hanging promises: pre-create the Promise.** If a test needs a mid-await state switch, don't do `mockImplementationOnce(() => new Promise((resolve) => { resolveFn = resolve }))` — the executor only runs when the mock is called, which may be after an earlier `await`. Instead: `const hanging = new Promise((resolve) => { resolveFn = resolve; }); mock.mockImplementationOnce(() => hanging);`. Resolver is assigned synchronously on test setup.
  - **Session 60's `batchScoreOnDevice.ts:291` network-failure gotcha** directly motivated the pending-shimmer work. If that re-hydrate ever fails silently again, rows correctly pulse now instead of showing `—`. Still worth a defensive fix on the service side.
  - **Advisor was helpful on scope.** The session-60 handoff phrased option 3 as "port the guard" — a narrow/mechanical framing. Advisor caught that pantry and bookmarks are different patterns requiring different fixes, saved me from misapplying one abstraction to both. Keep consulting before substantive multi-site work.
  - **`pid = get()._petId ?? petId` idiom in `usePantryStore` was almost-but-not-quite right.** It mostly "self-corrected" to the active pet, so top-level state wasn't visibly broken. The hidden bug was `_petCache[petId]` never being populated for the mutated pet — so switching back to that pet showed stale cache until a full refocus. If you audit any other store that reads `_petId` after a server await, the same trap applies.
  - **All session-60 gotchas still apply:** `Colors.primary` doesn't exist (use `Colors.accent`); `SwipeableRow` is default export; `batchScoreHybrid` JIT is fire-and-forget for null-score cache; no toast utility; squash-merges lose the TDD trail (preserve fix-forward commits on the feature branch's `origin/` ref).

## Previous Session

- **Date:** 2026-04-22 (session 60 — Bookmarks polish shipped to `m5-complete`: pet-anchored header + category grouping + D-158/D-168 compliance)
- **Branch:** `m9-bookmarks-history` off `m5-complete@66657f9` (PR #13 Bookmarks + PR #14 D-168 merge-cascade baseline from session 59). 20 commits on the feature branch; squash-merged to `m5-complete` as a single commit and pushed. Local feature branch deleted; `origin/m9-bookmarks-history` retained as the full 20-commit reference trail.
- **Squash commit on `m5-complete`:** `c99e669` — "M9: Bookmarks polish — pet-anchored header + category grouping". 9 files / +2392 / −33. Pushed to `origin/m5-complete` (`66657f9..c99e669`).
- **Accomplished — full Brainstorming → Writing-Plans → Subagent-Driven Development → Finishing-a-Development-Branch loop:**
  - **Spec:** `docs/superpowers/specs/2026-04-21-bookmarks-polish-design.md` — addresses the two on-device findings on D-169: Dynamic Island header collision on iPhone 14 Pro+ and a soulless flat row list that told the user nothing about what they saved. 3-bucket grouping (Daily Food / Toppers & Mixers / Treats), 3-tier sort (recalled pin / scored DESC with `created_at` tie-break / bypass sink).
  - **Plan:** `docs/superpowers/plans/2026-04-21-bookmarks-polish.md` — 14 TDD-ordered tasks, 7 pure-helper + 1 type/service tweak + 1 sibling safe-area port + 3 screen-rewrite + 1 render-test + 1 verify.
  - **Implementation via Subagent-Driven Development** — 14 tasks, each with implementer + spec-review + quality-review dispatch cycle. Two fix-forwards caught by reviewers (both preserved on `origin/m9-bookmarks-history`, absorbed into the squash):
    1. **Task 5 spec gap (`2b9a68e`):** `sortWithinSection`'s scored tier filter was missing `!is_vet_diet && !is_variety_pack` guards required by spec §2.2. Caught by Task 6's implementer; fixed on the spot.
    2. **Task 12 D-168 a11y bug (`ea2958c`):** `a11yLabel` branch-2 guard was `final_score != null`, which meant a vet-diet or variety-pack row with a cached score would render the `—` bypass chip visually but announce "X% match" audibly. Caught by the quality reviewer; fixed by switching the guard to `scoreColor != null` so visual and audio states share the same derived value.
  - **Post-QA polish after on-device review** (`dea83b5` + `6c43d56`): (a) "Buster's Shortlist" → "Buster's Bookmarks" + `numberOfLines={2}` wrap for long names, (b) dropped "Live scores" subtitle (read as UI noise), (c) added `contentContainerStyle paddingBottom: 88` on both `BookmarksScreen`'s SectionList and `ScanHistoryScreen`'s FlatList (rows were hidden behind tab bar + floating scan button), (d) swapped 8px colored section dots for 24px `CATEGORY_ICONS_FILLED` assets (`daily_food` / `toppers_mixers` / `treat` — iconMaps uses `treat` singular while section key is `treats` plural, mapped inline in `SECTION_META`).
  - **Final comprehensive code review** (opus) against entire implementation: APPROVED for merge. One Important non-blocking follow-up (BookmarkRow extraction — screen file grew to ~440 lines) + 4 minor observations (test hardening, cosmetic divider-under-recalled-border).
- **New decisions, migrations, scoring changes:** none. D-169 already scoped Bookmarks in session 57; this session was presentation-layer polish only. No migration added. No scoring engine changes (regression anchors intact).
- **Files changed on `m5-complete` (squash `c99e669`):**
  - `src/utils/bookmarkGrouping.ts` (new, 91 lines) — pure helper: `groupBookmarksByCategory`, `BookmarkSection`, `BookmarkSectionKey`, private `bucketOf` + `sortWithinSection` + `createdAtDesc`, `SECTION_META` with `iconSource` from `CATEGORY_ICONS_FILLED`
  - `src/screens/BookmarksScreen.tsx` (+244 / −33) — safe-area header with pet photo + `{petName}'s Bookmarks` title (2-line wrap) + `{n}/20 saved` progress chip with amber near-cap (>= 19), `SectionList` with 24px category icons in section headers, hairline dividers between rows (dropped on last-of-section), inline `Vet diet` chip, red `Recalled` chip (D-158 — no `0%`), bypass `—` chip, three-branch D-168 `accessibilityLabel`
  - `src/screens/ScanHistoryScreen.tsx` (+6 / −1) — safe-area header port + bottom padding. No grouping (history is temporal, per spec §5.2)
  - `src/services/bookmarkService.ts` (+1 / −1) — `category` added to `fetchBookmarkCards` PostgREST nested select
  - `src/types/bookmark.ts` (+1) — `category: 'daily_food' | 'treat'` added to `BookmarkCardData.product`
  - `__tests__/utils/bookmarkGrouping.test.ts` (new, 207 lines) — 19 unit tests: bucket matrix (5), empty-bucket filter (2), scored DESC + created_at tie-break (2), recalled pin (2), bypass/unscored routing (4), section meta contract (3), empty-input guard (1)
  - `__tests__/screens/BookmarksScreen.test.tsx` (new, 162 lines) — 6 render tests: all-three-sections present, empty-section skipped, recalled chip + order, vet-diet chip, D-168 label pattern, near-cap amber at 19
  - `docs/superpowers/specs/2026-04-21-bookmarks-polish-design.md` (new, 278 lines)
  - `docs/superpowers/plans/2026-04-21-bookmarks-polish.md` (new, 1434 lines)
- **Numbers (all green):** 76 suites / **1652 tests** / 3 snapshots (+25 from 1627 baseline: 19 grouping unit + 6 render). 131 decisions. 40 migrations. 19,058 products. Pure Balance = 61, Temptations = 0. `npx tsc --noEmit` clean in `src/` + `__tests__/` (pre-existing noise in `docs/plans/search-uiux/` and `supabase/functions/batch-score/` only).
- **Not done yet:**
  - **`BookmarkRow` extraction** — final reviewer flagged as Important non-blocking: extracting `BookmarkRow` to `src/components/bookmarks/BookmarkRow.tsx` would match the colocated `PantryCard` / `ScanHistoryCard` pattern and let render tests target the row directly without booting the full screen. ~10-min mechanical lift.
  - **Cache-miss UX split** — `isBypass` in `BookmarkRow` currently lumps `final_score == null` with genuine bypass flags (`is_vet_diet`, `is_variety_pack`). During this session's on-device QA, a transient Supabase network hiccup on sim restart left `pet_product_scores` empty for Buster; all 17 bookmark rows rendered `—`. Self-healed on next reload but the UX is wrong: cache-miss (transient, waiting for JIT re-hydrate) should shimmer or show a subtle spinner; only genuine bypass should show `—`. Split `isBypass` vs `isUnscored` and render differently.
  - **On-device VoiceOver QA** — 11 bookmark/scan surfaces (carry from session 57/58) + 7 D-168 a11y-backfill surfaces (carry from session 56). Plus the new grouped sections + new row chips (`Vet diet`, `Recalled`, `—`) + new pet-anchored header.
  - **Cross-pet store-write race audit** — port `useBookmarkStore` guard to `usePantryStore`, `useTreatBatteryStore`, any scoring-cache refresh wired to active pet (carry from session 58).
  - **Render-test hardening** — near-cap test asserts `19/20 saved` text but not the amber style application (reviewer flag, non-blocking); a `toHaveStyle({ backgroundColor: Colors.severityAmberTint })` check would close the loop.
  - **`batchScoreOnDevice` network-failure diagnosis** — `TypeError: Network request failed` at line 291 (the `pet_product_scores` upsert) on sim restart. Didn't repro after reload — could be transient Supabase auth renewal, RLS edge case, or iOS sim network state.
  - **Next M9 scope pick** — HomeScreen visual overhaul, custom icon rollout (5 pending v2 bold variants), stale browse scores form-aware fix, broader Matte Premium alpha audit (~17 rgba sites).
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rotated: session 60 → Previous, new session → Last.
  2. **Reload sim + VoiceOver** on the new Bookmarks UI (grouped sections, 24px category icons, wrap-title header, amber near-cap chip, `—` / `Vet diet` / `Recalled` chips).
  3. Pick one: (a) `BookmarkRow` extraction (10-min cleanup, closes final-reviewer finding); (b) cache-miss UX split (addresses the on-device regression surfaced this session); (c) cross-pet race audit (architectural, deeper); (d) next M9 scope.
- **Gotchas / context for next session:**
  - **Session 59 is a rolling-window ghost.** Session 59 was a merge-cascade session whose handoff commit (`13c9fc8`) rotated CURRENT.md on the `m9-bookmarks-history` feature branch, not on `m5-complete`. When this session squash-merged into `m5-complete`, we took `m5-complete`'s CURRENT.md during conflict resolution (correct choice — feature branch's CURRENT.md was stale). Session 59's handoff block lives only on `origin/m9-bookmarks-history`. For future merge-cascade sessions: rotate CURRENT.md on `m5-complete` directly via a second commit, not on the feature branch.
  - **`CATEGORY_ICONS_FILLED.treat` is singular, section key is `treats` plural.** Any future category-icon work on Bookmarks or similar grouped screens must map inline in `SECTION_META`. Documented in `bookmarkGrouping.ts`.
  - **Squash-merge absorbs feature-branch internal review work but loses the TDD trail.** Our 20 per-task commits collapsed to `c99e669`. The fix-forward commits (`2b9a68e` Task 5, `ea2958c` Task 12) are preserved only on `origin/m9-bookmarks-history`. Subagent-driven development caught two real bugs my plan missed — keep the two-stage (spec + quality) review discipline.
  - **`batchScoreOnDevice` JIT re-hydrate can fail silently on cold start.** A `TypeError: Network request failed` at `batchScoreOnDevice.ts:291` (the `pet_product_scores` upsert) left the cache empty; all bookmark rows rendered `—`. Self-healed on next network call. Worth a defensive UX fix (see Cache-miss UX split above) even if the network cause is transient.
  - **All session-57/58/59 gotchas still apply:** `Colors.primary` doesn't exist (use `Colors.accent`); `SwipeableRow` is default export; `batchScoreHybrid` JIT is fire-and-forget for null-score cache; no toast utility.

