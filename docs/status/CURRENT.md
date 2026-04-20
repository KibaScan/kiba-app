# Project Status — Last updated 2026-04-20 (session 57 — M9 Bookmarks shipped, PR #13 open, migration 040 applied)

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
- **M9 Bookmarks (D-169)** — per-pet watchlist (cap 20, free), `BookmarksScreen` + `ScanHistoryScreen` (up to 20 each), ResultScreen bookmark icon + overflow menu (Share / Report issue via `mailto:`), long-press on scan rows. Migration 040. PR #13 open.

## What's Broken / Known Issues

- **Stale browse scores (largely mitigated)**: Form-aware cache maturity (session 34) + TopPicksCarousel self-healing scoring trigger (session 35) cover most gaps. Remaining edge: first visit to a form after full cache wipe shows spinner while batch scoring runs (~10s). CategoryBrowseScreen's unscored fallback still shows products without badges until scoring completes.

## Numbers

- **Tests:** 1624 passing / 74 suites
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

- **Date:** 2026-04-20 (session 57 — M9 Bookmarks + expanded history shipped; PR #13 open; migration 040 applied to Supabase production)
- **Branch:** `m9-bookmarks-history` off `m5-complete` (`a79d43b`). 21 commits (13 task commits + 6 review-fix commits + 1 final race-fix commit + 1 spec/plan docs commit).
- **PR:** [#13](https://github.com/KibaScan/kiba-app/pull/13) — `M9: Bookmarks + expanded scan history`. Awaiting human review.
- **Accomplished — full M9 Bookmarks feature via Subagent-Driven Development across 13 plan tasks:**
  - **Data layer:** migration 040 (`bookmarks` table, `UNIQUE(pet_id, product_id)`, RLS owner policy, `BEGIN/COMMIT` wrapped, `FOR ALL` policy), `src/types/bookmark.ts` (`Bookmark`, `BookmarkCardData`, `MAX_BOOKMARKS_PER_PET = 20`, `BookmarkOfflineError`, `BookmarksFullError`), `src/services/bookmarkService.ts` (CRUD + 20-cap + offline guards + `fetchBookmarkCards(pet)` with PostgREST nested select + fire-and-forget `batchScoreHybrid` JIT for null-score cache hydration).
  - **State layer:** `src/stores/useBookmarkStore.ts` (Zustand, optimistic toggle, synchronous cap guard, cross-pet auto-resync, server-authoritative rollback via `loadForPet`, **per-key in-flight lock** keyed by `${petId}:${productId}` — race fix after on-device mash-tap bug surfaced `UNIQUE` violation).
  - **UI components:** `src/components/result/ResultHeaderMenu.tsx` (Modal bottom-sheet, Share + Report issue only), `src/components/common/BookmarkToggleSheet.tsx` (one-action variant for long-press).
  - **Screens:** `src/screens/ResultScreen.tsx` (replaced share icon with two-icon header: bookmark-outline/filled + ellipsis; wired mailto with `Platform.OS`/`Platform.Version`; added matching back-arrow padding for symmetry), `src/screens/HomeScreen.tsx` (Bookmarks section between Pantry row and Recent Scans, 3 rows, hidden when empty; `See all ›` on Recent Scans with stacked counter; long-press scan rows → `BookmarkToggleSheet`), `src/screens/BookmarksScreen.tsx` (new — FlatList, `SwipeableRow` delete via `store.toggle`, pull-to-refresh, empty-state CTA scan button, recalled red left border), `src/screens/ScanHistoryScreen.tsx` (new — up to 20 deduped scans, immutable, long-press → bookmark, empty-state CTA).
  - **Navigation:** `Bookmarks` + `ScanHistory` routes added to `HomeStackParamList` + `HomeStack.Navigator`.
  - **Docs:** D-168 (backfilled onto this branch to keep DECISIONS.md internally consistent, since branch was cut before `m9-reduce-score-noise` landed) + **D-169: Bookmarks — Per-Pet Watchlist** (new). Updated CLAUDE.md Schema Traps, ROADMAP.md M9 item, CURRENT.md numbers. Spec + plan docs committed to `docs/superpowers/`.
  - **Gemini external review mid-plan:** adopted 8/10 (JIT hydration, service extraction, sync cap check, server-resync rollback, PostgREST nested select, recalled red border, empty-state CTA, Platform info in mailto). Pushed back on 2 (long-press discoverability — user's explicit design choice; report-issue Copy email — `expo-clipboard` not in deps).
  - **Final integration review round:** caught 3 cross-surface gaps — `BookmarkOfflineError` branch missing on long-press handlers (HomeScreen + ScanHistoryScreen), `accessibilityLabel` missing on HomeScreen Recent Scans rows that gained `onLongPress`, `handleDelete` on BookmarksScreen bypassed store (now routes through `store.toggle` for symmetry). All fixed.
- **New decisions:**
  - **D-169 (this session):** Bookmarks — per-pet watchlist, hard cap 20, no paywall, live score (not snapshot), immutable scans, mailto-based Report issue stub.
  - **D-168 (backfilled):** Tiered score framing (terse by default, outbound-share exception). Originally written on `m9-reduce-score-noise`; added here to keep this branch self-consistent. Will merge-conflict on DECISIONS.md tail — see Gotchas.
- **Files changed (22 files in the diff vs. `origin/m5-complete`):** 8 new source files, 5 modified source files, 4 doc files, 2 spec/plan docs, 2 test files new (bookmarkService + useBookmarkStore), 1 test file new (ResultHeaderMenu). +4,250 lines / −24 lines. 28 new tests (12 service + 11 store + 5 component).
- **Numbers (all green):** **1624 tests / 74 suites / 3 snapshots**. 131 decisions. 40 migrations. 19,058 products. Pure Balance = 61, Temptations = 0. `npx jest` runtime 5.7s.
- **Not done yet:**
  - **On-device VoiceOver QA** — 11 bookmark/scan score surfaces need VoiceOver announcement check (full `"X% match for ${petName}"` phrase). User deferred.
  - **Recalled-product visual QA** — red-left-border + `RecallDetail` routing on bookmark/scan rows across all three surfaces. User deferred.
  - **PR #13 review + merge.** Awaiting human review.
  - **Migration 040 applied to Supabase production** (user ran it directly — this is done).
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rewrote session 55 → Previous, session 57 → Last, session 54 deleted.
  2. **Decide merge order:** PR #13 (bookmarks) vs the pending `m9-reduce-score-noise` (session 56 D-168 work — not yet PR'd). Recommend landing `m9-reduce-score-noise` first so D-168 is baked into `m5-complete` before bookmarks' D-168 dupe gets resolved.
  3. **Execute VoiceOver + recalled-product QA** on the merged branch.
  4. Pick next M9 scope: HomeScreen visual overhaul, custom icon rollout, stale browse scores form-aware fix, or broader Matte Premium alpha audit (~17 rgba sites, needs dedicated session).
- **Gotchas / context for next session:**
  - **D-168 merge conflict is foreseeable.** This branch added D-168 to `DECISIONS.md` to keep the file internally consistent (branch was cut from `m5-complete` at `a79d43b`, before `m9-reduce-score-noise` wrote D-168). When both branches land, git will conflict on the DECISIONS.md tail. Resolution: keep ONE copy of D-168 (prefer whichever branch merged first), keep D-169 appended. The count header should read `131 decisions, D-001 through D-169`.
  - **`Colors.primary` does NOT exist in Kiba.** The Matte Premium accent cyan is `Colors.accent` (`#00B4D8`). Every subagent-implemented task in this session hit the bad name at least once and had to adapt. Consider adding to `.agent/design.md` or CLAUDE.md Schema Traps to stop the drip. `Colors.severityRed` is the right token for recalled red-border (matches `PantryCard.cardRecalled`).
  - **`SwipeableRow` is a DEFAULT export** (`src/components/ui/SwipeableRow.tsx`) and uses `onDelete` + `deleteConfirmMessage` (+ optional `onEdit`/`deleteLabel`/`editLabel`) — NOT `onSwipeLeft`/`onSwipeRight`. It handles the confirmation Alert internally when `deleteConfirmMessage` is set.
  - **Mash-tap race pattern:** `useBookmarkStore.toggle` now uses a per-key in-flight lock (`Set<"petId:productId">`). Re-entry during a pending toggle returns the current `isBookmarked` state immediately without a second service call. If future screens add rapid-action button patterns (any toggle that hits a Supabase UNIQUE constraint), use the same lock pattern.
  - **`batchScoreHybrid` JIT is fire-and-forget**, called only when `fetchBookmarkCards` returns any card with `final_score === null`. First visit to a cold-cache pet's bookmarks may show `"—"` for 1–2s while the cache hydrates. Next refresh shows scores. Matches existing Top Matches pattern.
  - **Anchor `NativeStackNavigationProp` to an existing route before a new one is registered.** When writing a new screen that will be registered later in the same PR, anchor the Nav type to an existing route (e.g., `'HomeMain'`) to avoid a self-introduced tsc error; update to the real route name in the navigation registration task.
  - **No toast utility in the app.** MVP uses `Alert.alert` for cap + error messages. If a proper toast becomes needed, coordinate across appointment + pantry error paths too (they all currently use Alert).
  - **On-device QA caught a real bug that tests didn't.** The UNIQUE mash-tap race was only surfaced by rapid physical tapping; the Jest test suite had 11 useBookmarkStore tests that all passed before the fix. Reminder: ship feature-code to device before declaring "tests green = done." 3 new tests covering the lock now exist (mash-tap early return, in-flight cleared on success, in-flight cleared on failure).

## Previous Session

- **Date:** 2026-04-17 (session 55 — merge cascade: PRs #10 + #11 → `m5-complete`, PR #12 → `main`)
- **Branch:** `m5-complete` (no feature branch — session was all merges + handoff).
- **PRs shipped:** [#10](https://github.com/KibaScan/kiba-app/pull/10) squash → `d2f566e` (Top Picks dedicated screen); [#11](https://github.com/KibaScan/kiba-app/pull/11) squash → `e6c8069` (CURRENT.md trim + rolling-window `/handoff`); [#12](https://github.com/KibaScan/kiba-app/pull/12) merge → `6171116` (cascade `m5-complete` → `main`).
- **Accomplished — merge chain + production sync + rolling-window `/handoff` validated live.** Session 54's `/handoff` rewrite had its first pre-merge run; PR #11 hit a squash-rebase gotcha (downstream branch couldn't auto-detect patch equivalence across squash boundary; recovered with `git rebase --onto origin/m5-complete 9e4ac91 m9-current-md-trim`); PR #12 used `--merge` not `--squash` to preserve PR history on main. `main` now caught up to `m5-complete` at `6171116`.
- **Files changed this session:** none direct — all via merges.
- **Numbers (all green):** 1596 tests / 71 suites / 3 snapshots. 129 decisions. 39 migrations. 19,058 products. Pure Balance = 61, Temptations = 0.
- **Not done yet (before session 57):**
  - **Remote feature branches** `m9-top-picks-screen` + `m9-current-md-trim` still exist on origin — safe to delete via `gh api` or GitHub UI.
  - Session 56's D-168 work on `m9-reduce-score-noise` — 4 commits, PR not yet opened.
- **Gotchas from session 55 still applicable:**
  - **Squash-merge rebase gotcha:** when a squash merge lands on an integration branch, downstream branches based on pre-squash state can't use plain `git rebase origin/<base>`. Use `git rebase --onto origin/<base> <last-upstream-commit-before-mine> <branch>`.
  - **Force-push is blocked by settings perms.** Run `!git push --force-with-lease origin <branch>` yourself when needed.
  - **Merge strategy convention:** feature branches → `m5-complete` use `--squash`; `m5-complete` → `main` cascade PRs use `--merge`.
