# Project Status — Last updated 2026-04-17 (session 55 — merge cascade PRs #10 + #11 + #12, production caught up to m5-complete)

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
- **D-094 score framing extended** to new browse components (`TopPickHeroCard`, `TopPickRankRow`) — `{score}% match` pattern

## What's Broken / Known Issues

- **Stale browse scores (largely mitigated)**: Form-aware cache maturity (session 34) + TopPicksCarousel self-healing scoring trigger (session 35) cover most gaps. Remaining edge: first visit to a form after full cache wipe shows spinner while batch scoring runs (~10s). CategoryBrowseScreen's unscored fallback still shows products without badges until scoring completes.

## Numbers

- **Tests:** 1621 passing / 74 suites
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

- **M9 Bookmarks shipped (2026-04-17, branch `m9-bookmarks-history`)** — migration 040, `BookmarksScreen` + `ScanHistoryScreen`, ResultScreen bookmark icon + overflow menu (Share / Report issue via `mailto:`), long-press entry on scan rows, HomeScreen bookmarks section. D-169.
- **Date:** 2026-04-17 (session 55 — merge cascade: PRs #10 + #11 → `m5-complete`, PR #12 → `main`)
- **Branch:** `m5-complete` (no feature branch — session was all merges + this handoff).
- **PRs shipped:**
  - [#10](https://github.com/KibaScan/kiba-app/pull/10) squash-merged → `d2f566e` (Top Picks dedicated screen + BenchmarkBar skeleton fix)
  - [#11](https://github.com/KibaScan/kiba-app/pull/11) squash-merged → `e6c8069` (CURRENT.md trim + rolling-window `/handoff`)
  - [#12](https://github.com/KibaScan/kiba-app/pull/12) merge-merged → `6171116` (cascade `m5-complete` → `main`, the "PR #2 equivalent")
- **Accomplished — merge chain + production sync + rolling-window `/handoff` validated live.**
  - **Session 54's `/handoff` rewrite had its first pre-merge run** — wrote session 54 as Last Session with session 53 as Previous Session. Rolling window worked as spec'd.
  - **PR #10 merged first** per merge-order plan (session 54's handoff flagged this). Squash commit picked up sessions 50-53.
  - **PR #11 hit the squash-rebase gotcha** — after PR #10 squashed into `m5-complete`, PR #11's diff showed 26 commits because git didn't auto-detect patch equivalence across the squash boundary. Plain `git rebase origin/m5-complete` hit add/add conflicts on the PR #10 spec files. Recovered with `git rebase --onto origin/m5-complete 9e4ac91 m9-current-md-trim` — replays just my 3 commits onto the new tip, skipping PR #10's now-squashed work. Force-push (blocked by settings perms — user ran `!git push --force-with-lease` directly) cleaned PR #11's view to 3 commits.
  - **PR #12 (cascade) opened + merged with `--merge` strategy** (not squash) to match the prior PR #2 pattern — preserves individual PR squash commits on `main` for history.
  - **Local branch `m9-current-md-trim` deleted.** Remote merged branches (`m9-top-picks-screen` + `m9-current-md-trim`) left intact — can be deleted when convenient.
  - **`main` now caught up to `m5-complete`.** Both tips converge at `6171116`.
- **Files changed this session:** none direct — all via merges. This handoff's CURRENT.md update is the only file touched in the working tree.
- **Numbers (all green, unchanged from session 54):** 1596 tests / 71 suites / 3 snapshots. 129 decisions. 39 migrations. 19,058 products. Pure Balance = 61, Temptations = 0. `npx jest` runtime 5.6s.
- **Not done yet:**
  - **On-device D-094 visual QA** on Top Picks hero badge + leaderboard pill — carried from session 53, still unchecked.
  - **Remote feature branches** `m9-top-picks-screen` + `m9-current-md-trim` still exist on origin — safe to delete via `gh api` or GitHub UI. Settings could enable auto-delete-on-merge to avoid this next time.
  - All "Not done yet" items from Previous Session (session 54) still apply — D-094 carousel outliers, Top Picks polish carry-overs, deferred code-review items, HomeScreen overhaul, etc.
- **Start the next session by:**
  1. **`/boot`** — third validation of the trimmed CURRENT.md + rolling-window pattern. Should single-read cleanly.
  2. Pick scope from the carryover backlog: (a) D-094 carousel symmetry (`TopPicksCarousel` + `TopMatchesCarousel`), (b) Top Picks visual polish (Brand CAPS, top-2 ingredients, V2 two-column hero), (c) one of the 5 deferred code-review items from session 53, or (d) the next M9 thread (HomeScreen overhaul, custom icons).
- **Gotchas / context for next session:**
  - **Squash-merge rebase gotcha:** when a squash merge lands on an integration branch, downstream branches based on the pre-squash state can't use plain `git rebase origin/<base>` — git doesn't detect patch equivalence across the squash boundary and tries to re-apply every now-squashed commit. Use `git rebase --onto origin/<base> <last-upstream-commit-before-mine> <branch>` to replay just your commits. We hit this on PR #11 after PR #10 landed.
  - **Force-push is blocked by settings perms.** When you need to force-push to clean up a branch history, run `!git push --force-with-lease origin <branch>` yourself — Claude can't do it through the Bash tool.
  - **Merge strategy convention:** feature branches → `m5-complete` use `--squash` (clean per-PR commits on integration); `m5-complete` → `main` cascade PRs use `--merge` (preserves PR history on main). PR #10/#11 were squash; PR #12 was merge. Match this going forward.
  - **`main` and `m5-complete` are both at `6171116`** post-cascade. Future feature work follows the normal `m9-<feature>` → `m5-complete` pattern, with periodic cascade PRs to main whenever production needs to catch up.

## Previous Session

- **Date:** 2026-04-16 (session 54 — CURRENT.md trim + `/handoff` rolling-window enforcement)
- **Branch:** `m9-current-md-trim` off `m9-top-picks-screen`. 2 commits + 1 handoff commit = 3 total. Merged via PR #11.
- **Accomplished — brainstormed + spec'd + shipped a doc-only trim to kill `/boot` context bloat.**
  - **Design spec:** `docs/superpowers/specs/2026-04-16-current-md-trim-design.md` (`ff9280f`) — approved-in-flow during brainstorming.
  - **Trim (`b40cd03`):**
    - Deleted session archive (sessions 46-52, ~700 lines)
    - Replaced `## What Works` (50-line feature list) with ROADMAP pointer + 5 M9 highlights bullet
    - Updated `.claude/commands/handoff.md` step 1 to enforce rolling 2-session window: rename existing `## Last Session` → `## Previous Session` + defensive `## Session \d+` delete sweep on every run
  - **Result:** CURRENT.md 850 → 111 lines. Now single-read-able by Read tool (was blowing the 25k-token limit every `/boot`). Historical detail recoverable via `git log` + `gh pr view`.
- **Files changed:**
  - `docs/superpowers/specs/2026-04-16-current-md-trim-design.md` (new, 124 lines)
  - `docs/status/CURRENT.md` (-751 / +15 net)
  - `.claude/commands/handoff.md` (+10 / -5)
- **Numbers (all green):** 1596 tests / 71 suites / 3 snapshots (unchanged — doc-only work). 129 decisions. 39 migrations. 19,058 products. Pure Balance = 61, Temptations = 0.
- **Not done yet:**
  - **PR #11 review + merge.** Stacked on PR #10 — may want to wait until #10 lands so the diff shows clean.
  - All "Not done yet" items from Previous Session (session 53) still apply — D-094 carousel outliers, Top Picks polish carry-overs, deferred code-review items, HomeScreen overhaul, etc.
  - **First real-world test of the rolling-window `/handoff`** — this file is the first output of the new rules. Verify structure reads cleanly on next `/boot`.
- **Start the next session by:**
  1. **`/boot`** — the exercise's whole point. Should now single-shot-read CURRENT.md with no 25k error.
  2. **`gh pr view 10`** and **`gh pr view 11`** — status on both, merge order decision (lean: #10 first, then #11 auto-cleans).
  3. Pick scope from Previous Session's menu (D-094 carousel symmetry, Top Picks polish, HomeScreen overhaul, etc.).
- **Gotchas / context for next session:**
  - **Rolling-window `/handoff` is live.** If a future run leaves stacked `## Previous Session` headings or doesn't overwrite cleanly, check the Edit tool's string-match on `## Last Session` exact casing. The defensive `## Session \d+` delete in step 1b is there to recover from any stragglers, not a substitute for correct rename.
  - **PR #11 stacking:** base is `m5-complete` per user direction, not `m9-top-picks-screen`. Diff is noisy until #10 merges. GitHub handles commit auto-cleanup on merge — don't manually rebase unless #10 gets closed without merging.
  - **`## What Works` max 5 bullets** going forward — that's the cap the spec set. If it grows, prune oldest on each `/handoff` to stay in budget, or close M9.
  - **Historical session detail** lives in git. `git show HEAD~N:docs/status/CURRENT.md` retrieves any prior state. Don't re-add session archive blocks.
