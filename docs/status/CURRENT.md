# Project Status — Last updated 2026-04-17 (session 56 — D-094 retired; D-168 tiered score framing landed; ScoreRing captionless; 7-surface a11y backfilled)

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

## What's Broken / Known Issues

- **Stale browse scores (largely mitigated)**: Form-aware cache maturity (session 34) + TopPicksCarousel self-healing scoring trigger (session 35) cover most gaps. Remaining edge: first visit to a form after full cache wipe shows spinner while batch scoring runs (~10s). CategoryBrowseScreen's unscored fallback still shows products without badges until scoring completes.

## Numbers

- **Tests:** 1597 passing / 71 suites
- **Decisions:** 130
- **Migrations:** 39 (001–039)
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

- **Date:** 2026-04-17 (session 56 — D-094 retired + D-168 tiered score framing landed + ScoreRing captionless + 7-surface a11y backfill)
- **Branch:** `m9-reduce-score-noise` off `m5-complete` (`a79d43b`). 3 commits + 1 handoff commit = 4 total. PR not yet opened.
- **Prior branch abandoned:** `m9-scorebadge-d094` (3 commits: spec, plan, shared `ScoreBadge` component + tests) — Steven recognized mid-session that the unification plan would re-introduce "match for [Pet Name]" noise that iterative M8/M9 work had already stripped. Branch left intact for reference; delete when convenient with `git branch -D m9-scorebadge-d094`.
- **Commits:**
  - `92a58f9` — retired D-094, added D-168 tiered framing. Stripped `ScanHistoryCard` + `PantryCard` visible text to `{score}% match` with full phrase in `accessibilityLabel`. Updated 6 enforcement mirrors (CLAUDE.md rule #9 + Score Framing, `src/components/CLAUDE.md`, `.github/copilot-instructions.md`, both `kiba-*` agents, `.agent/workflows/review.md`). Decision count bumped 129→130 across 5 doc sources.
  - `144d2e0` — ScoreRing: removed the "match for {displayName}" caption entirely. Full phrase migrated to `accessibilityLabel` on the score number with `importantForAccessibility="no-hide-descendants"` on the `%` sign. Orphaned `matchLabel` style deleted. SafeSwitchSetupScreen: both old + new score badges stripped to `{score}% match`. D-168 tier model restructured from "surface density" to "whether pet context is recoverable from surrounding UI" — `PetShareCard` is now the sole "full phrase visible" surface; ScoreRing moved to dense tier.
  - `8f9bb3e` — D-168 a11y backfill: 7 terse-tier surfaces got `accessibilityLabel` with full phrase. 2 required prop threading (`BrowseProductRow`, `TopPickRankRow`) with caller updates. `TopPickRankRow` test got a new D-168 assertion (+1 test). D-168 body updated: "Known compliance gap at landing" → "Compliance backfill (completed)" + "Reference pattern for future score surfaces" subsection.
- **Files changed (26 unique across 3 commits + handoff):**
  - **Decision doc:** `DECISIONS.md` (D-094 SUPERSEDED, D-168 added with tier table/rationale/reference pattern/self-check)
  - **Component edits:** `src/components/ScanHistoryCard.tsx`, `src/components/pantry/PantryCard.tsx`, `src/components/scoring/ScoreRing.tsx`, `src/components/browse/BrowseProductRow.tsx`, `src/components/browse/TopPicksCarousel.tsx`, `src/components/browse/TopPickHeroCard.tsx`, `src/components/browse/TopPickRankRow.tsx`, `src/components/scoring/ScoreWaterfall.tsx`, `src/components/result/SafeSwapSection.tsx`, `src/components/pantry/SharePantrySheet.tsx`
  - **Screen edits:** `src/screens/ResultScreen.tsx` (file-top comment refresh), `src/screens/SafeSwitchSetupScreen.tsx` (2 badges), `src/screens/CategoryBrowseScreen.tsx` (prop thread), `src/screens/CategoryTopPicksScreen.tsx` (prop thread)
  - **Enforcement mirrors:** `CLAUDE.md`, `src/components/CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/agents/kiba-code-reviewer.md`, `.claude/agents/kiba-scoring-architect.md`, `.agent/workflows/review.md`
  - **Count references:** `README.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_OVERVIEW.md`
  - **Test:** `__tests__/components/browse/TopPickRankRow.test.tsx` (+1 D-168 a11y assertion; 3 callsites updated for required `petName` prop)
  - **Doc artifact (this handoff commit):** `docs/superpowers/specs/2026-04-17-d168-a11y-backfill-shipped.md` — review audit for the a11y backfill
- **New decisions:** **D-168** — Score Framing Simplification (terse by default, outbound-share exception). Supersedes D-094. Accessibility invariant preserved via `accessibilityLabel`. Reference pattern documented: inside a `TouchableOpacity`/`Pressable` card put the label on the OUTER pressable (RN flattens inner labels); on plain `View`/`Text` trees the score `<Text>` is fine.
- **Numbers (all green):** 1597 tests (+1 from D-168 a11y assertion) / 71 suites / 3 snapshots. 130 decisions. 39 migrations. 19,058 products. Pure Balance = 61, Temptations = 0. `npx jest` runtime 5.6s.
- **Not done yet:**
  - **On-device VoiceOver QA across 11 surfaces** — critical before PR. 4 stripped surfaces need layout sanity: `ScanHistoryCard`, `PantryCard`, `ScoreRing` (captionless), `SafeSwitchSetupScreen` badges. 7 backfilled surfaces need VoiceOver announcement check: `BrowseProductRow`, `TopPicksCarousel`, `TopPickHeroCard`, `TopPickRankRow`, `ScoreWaterfall`, `SafeSwapSection`, `SharePantrySheet`. Full plan in `docs/superpowers/specs/2026-04-17-d168-a11y-backfill-shipped.md` "What's left before merging the branch" section.
  - **PR not opened.** `m9-reduce-score-noise` → `m5-complete` pending QA.
  - **Abandoned branch cleanup:** `m9-scorebadge-d094` still reachable locally.
  - All "Not done yet" items from Previous Session (session 55) still apply — remote branch cleanup, deferred code-review items, HomeScreen overhaul, etc.
- **Start the next session by:**
  1. **`/boot`** — should single-read CURRENT.md cleanly. Verify the rolling window rewrote session 55 → Previous, session 56 → Last, session 54 deleted.
  2. **On-device VoiceOver QA sweep** — follow the 11-surface plan in the shipped.md doc. Flag any a11yLabel that doesn't fire (would indicate a surface-specific RN flattening exception needing custom handling).
  3. If QA passes, **open PR** from `m9-reduce-score-noise` → `m5-complete`. Squash-merge per convention.
  4. If any Layout regressions on ScoreRing without caption, adjust before PR.
- **Gotchas / context for next session:**
  - **RN `accessibilityLabel` flattens inside `TouchableOpacity`/`Pressable` cards.** VoiceOver reads the parent's label and ignores inner Text-level labels. Always put the label on the outermost pressable; extend any existing semantic label rather than conflict with an inner a11y element. This cost 4 redo edits mid-sweep before being pattern-locked in D-168 + kiba-code-reviewer rule #9. When writing a future score surface, this is the first thing to check.
  - **D-168 tier model is about recoverable pet context, not surface density.** If a future hero surface has the pet photo/name visible from surrounding UI, it belongs in the terse tier, not the full-phrase tier. `PetShareCard` is the only current exception because screenshots leave the app.
  - **ScoreRing is visibly captionless now** — only the big `{displayScore}` + `%` + info button + pet photo in corner. If that reads too bare on device, the minimum-viable caption would be a single-word "match" with the full phrase in `accessibilityLabel`. Don't re-introduce the pet name.
  - **D-168 `Known compliance gap` is CLOSED** in the decision body, but until on-device QA confirms VoiceOver works on each of the 7 surfaces, the backfill is only theoretically complete. The reviewer pattern noted in D-168 handles this risk.
  - **Uncommitted artifact at handoff time:** `docs/superpowers/specs/2026-04-17-d168-a11y-backfill-shipped.md` is the a11y review audit written at Steven's request. This handoff commit bundles it in so the branch stays clean.
  - **Old `m9-scorebadge-d094` branch still has the (wrong-direction) ScoreBadge component + test file.** If you delete it, you lose those artifacts from git — they're not referenced from anywhere on `m9-reduce-score-noise`. Safe cleanup.

## Previous Session

- **Date:** 2026-04-17 (session 55 — merge cascade: PRs #10 + #11 → `m5-complete`, PR #12 → `main`)
- **Branch:** `m5-complete` (no feature branch — session was all merges + handoff).
- **PRs shipped:** [#10](https://github.com/KibaScan/kiba-app/pull/10) squash → `d2f566e` (Top Picks dedicated screen); [#11](https://github.com/KibaScan/kiba-app/pull/11) squash → `e6c8069` (CURRENT.md trim + rolling-window `/handoff`); [#12](https://github.com/KibaScan/kiba-app/pull/12) merge → `6171116` (cascade `m5-complete` → `main`).
- **Accomplished — merge chain + production sync + rolling-window `/handoff` validated live.** Session 54's `/handoff` rewrite had its first pre-merge run; PR #11 hit a squash-rebase gotcha (downstream branch couldn't auto-detect patch equivalence across squash boundary; recovered with `git rebase --onto origin/m5-complete 9e4ac91 m9-current-md-trim`); PR #12 used `--merge` not `--squash` to preserve PR history on main. `main` now caught up to `m5-complete` at `6171116`.
- **Files changed this session:** none direct — all via merges. Handoff CURRENT.md update only.
- **Numbers (all green):** 1596 tests / 71 suites / 3 snapshots. 130 decisions. 39 migrations. 19,058 products. Pure Balance = 61, Temptations = 0.
- **Not done yet (before session 56):**
  - **On-device D-094 visual QA** on Top Picks hero badge + leaderboard pill — carried from session 53. (Largely obsoleted by session 56's D-094 retirement, but remaining layout QA still useful.)
  - **Remote feature branches** `m9-top-picks-screen` + `m9-current-md-trim` still exist on origin — safe to delete via `gh api` or GitHub UI.
- **Gotchas from session 55 still applicable:**
  - **Squash-merge rebase gotcha:** when a squash merge lands on an integration branch, downstream branches based on pre-squash state can't use plain `git rebase origin/<base>`. Use `git rebase --onto origin/<base> <last-upstream-commit-before-mine> <branch>`.
  - **Force-push is blocked by settings perms.** Run `!git push --force-with-lease origin <branch>` yourself when needed.
  - **Merge strategy convention:** feature branches → `m5-complete` use `--squash`; `m5-complete` → `main` cascade PRs use `--merge`.
