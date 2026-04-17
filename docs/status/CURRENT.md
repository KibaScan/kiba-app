# Project Status — Last updated 2026-04-16 (session 54 — CURRENT.md trim + /handoff rolling-window enforcement)

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

- **Tests:** 1596 passing / 71 suites
- **Decisions:** 129
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

- **Date:** 2026-04-16 (session 54 — CURRENT.md trim + `/handoff` rolling-window enforcement)
- **Branch:** `m9-current-md-trim` off `m9-top-picks-screen`. 2 commits.
- **PR:** [#11](https://github.com/KibaScan/kiba-app/pull/11) — "M9: trim CURRENT.md + enforce rolling 2-session window". OPEN against `m5-complete`, stacked on PR #10 (5 commits visible until #10 merges, then auto-cleans to 2).
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

## Previous Session

- **Date:** 2026-04-16 (session 53 — PR #10 opened + full `/code-review` pipeline on PR #10 + D-094 score-framing polish fix)
- **Branch:** `m9-top-picks-screen` off `m5-complete`. 2 new commits on top of session 52 (22 total on branch). Pushed to origin.
- **PR:** [#10](https://github.com/KibaScan/kiba-app/pull/10) — "M9: Top Picks dedicated screen + BenchmarkBar skeleton fix". OPEN against `m5-complete`. 0 reviewer comments. Auto-posted `### Code review / No issues found` summary comment from `/code-review` run.
- **Accomplished — `/boot` + PR opened + full `/code-review:code-review` pipeline + one proactive D-094 fix shipped on top of the PR.**
  - **`/boot`:** numbers verified green (1596/71, 129 decisions, 39 migrations — all matched). On-device BenchmarkBar smoke test was already done by user pre-session; skipped re-verification per user direction.
  - **PR #10 opened** via `gh pr create --base m5-complete --head m9-top-picks-screen`. Body covers Top Picks ship + BenchmarkBar hitchhiker, D-094/D-095/D-096/D-146 compliance notes, test deltas (1538 → 1596, +58 tests / +6 suites), 6-item manual test plan.
  - **`/code-review:code-review` run on PR #10** — full pipeline executed (eligibility check, CLAUDE.md path list, PR summary, 5 parallel Sonnet reviewers covering {CLAUDE.md adherence, shallow bug scan, git history/blame, prior PR comments, code-comment compliance}, then 9 parallel Haiku confidence scorers per-issue, then re-check + gh comment). **9 unique issues surfaced, 0 scored ≥80**, so per skill threshold the posted comment was "No issues found." Highest-scored issues (75) were D-094 naked `{pick.final_score}%` in the new `TopPickHeroCard` score badge + `TopPickRankRow` score pill — filtered at 75 as "pre-existing pattern consistency with `TopPicksCarousel` on `m5-complete`." Recommended proactive fix anyway since D-094 is non-negotiable rule #9 in CLAUDE.md.
  - **D-094 fix shipped as `fc56363`** — 3-file surgical patch (9 additions, 2 deletions):
    - `TopPickHeroCard.tsx` — circular score badge now renders `{score}%` + a small "match" label beneath (new `scoreLabel` style, FontSizes.xs, -2 marginTop, letterSpacing 0.3). The existing trophy badge above the image row continues to carry "Best overall match for {petName}" — the new label closes the loop on the numeric element.
    - `TopPickRankRow.tsx` — score pill now renders `{score}% match` (was naked `{score}%`). Screen title on `CategoryTopPicksScreen` ("Ranked 1–N matches for {petName}") continues to carry "for {petName}" at screen scope. The file-header comment at line 3 already said `D-094: "X% match" framing (score pill)` — the rendering was the only thing out of alignment with the stated intent.
    - `__tests__/components/browse/TopPickRankRow.test.tsx` — assertion string updated `'88%'` → `'88% match'`. Hero test didn't assert on the score text, so no update needed there.
  - **Tests verified green post-fix.** 5 render tests (HeroCard + RankRow) pass. Full suite: 1596/71/3, 5.7s runtime.
- **Files changed this session (3 code files + 1 status doc, 2 commits, 1 PR opened, 1 PR comment posted):**
  - `src/components/browse/TopPickHeroCard.tsx` — +7 lines ("match" label + `scoreLabel` style)
  - `src/components/browse/TopPickRankRow.tsx` — 1-line swap (`{score}%` → `{score}% match`)
  - `__tests__/components/browse/TopPickRankRow.test.tsx` — 1-line assertion swap
  - `docs/status/CURRENT.md` — this handoff
  - Remote: PR [#10](https://github.com/KibaScan/kiba-app/pull/10) opened, comment at https://github.com/KibaScan/kiba-app/pull/10#issuecomment-4263969473
- **Numbers (all verified green):** **1596 tests / 71 suites / 3 snapshots** (unchanged — only a test-assertion string change, no count delta). 129 decisions. 39 migrations. 19,058 products. Regression anchors pass (Pure Balance = 61, Temptations = 0). `npx jest` total runtime 5.7s.
- **Not done yet:**
  - **PR #10 review + merge.** Opened this session, 0 reviewer comments at handoff. Also needs an on-device visual check of the new "match" framing (Hero badge circle + Leaderboard pill) to confirm it reads well at real font sizes — the "match" label under the big 92px score number was sized at FontSizes.xs with -2 marginTop to fit; eyeballs haven't seen it yet.
  - **`TopPicksCarousel.tsx` is now the D-094 outlier** — still renders naked `{item.final_score}%` (pre-existing on `m5-complete`, flagged at 75 in this session's review but scoped out of PR #10). Ripe for a follow-up symmetry fix on a new branch off `m5-complete` (or fold into HomeScreen polish thread). Same pattern likely exists on `TopMatchesCarousel` — verify before touching.
  - **Other code-review borderline issues (all <80, deferred):**
    - `fetchCategoryTopPicks` silently returns `[]` for the `vet_diet` sub-filter. Blocked upstream today (TopPicksCarousel is hidden when `activeSubFilter === 'vet_diet'` — per HomeScreen render guard), so users can't reach the "See All" tap. If that guard ever changes, add `vet_diet` to `resolveSeeAllDestination` short-circuits alongside `supplement`.
    - `matchesPetLifeStage` in `topPickInsights.ts` uses `\bmaintenance\b` regex for the adult branch — would match "Senior Maintenance" for adult pets. AAFCO has no official "Senior Maintenance" stage so production data shouldn't hit it, but defensive hardening option is to check for absence of `senior` before the maintenance branch fires.
    - `formatLifeStageText` unconditionally prepends `AAFCO ` then title-cases — if the raw `aafco_statement` field ever starts with "AAFCO", result would be "AAFCO Aafco Adult Maintenance". Current data pipeline (migration 036 synthesizer + `import_products.py`) produces clean claims with no "AAFCO" prefix, so latent only. Strip any leading `AAFCO ` before formatting if you ever touch that helper.
    - `CategoryTopPicksScreen` doesn't wrap `pets.find(p => p.id === petId)` in `useMemo`. CompareScreen does (that screen is cited as the tab-bar-hide pattern reference), but `CategoryBrowseScreen` and `SafeSwitchSetupScreen` also skip it, so the convention isn't universal. Micro-perf only.
    - `mountedRef` race pattern in the fetch effect (theoretical — not exploitable given this is a dedicated "See All" destination, dep changes require full navigation). If the screen is ever repurposed for in-screen filter toggling, switch to a per-invocation `let cancelled = false` closure-captured flag.
  - **Top Picks visual polish carry-overs from session 51:** Brand CAPS on rank rows, top-2 ingredients subtitle on hero, two-column hero layout (V2 Gemini mockup deltas).
  - **Top Picks design spec section 3** still describes original image-top layout; implementation went vertical. Spec drift to address in a polish pass.
  - 2 deferred follow-ups from sessions 47/48 still open (`evaluateDietCompleteness` negative-case tests + D-161 accumulator gap at `auto-deplete/index.ts:494`).
  - HomeScreen visual overhaul + custom icon rollout + carry-over QA sweeps from sessions 39/41 — all still on the M9 board.
- **Start the next session by:**
  1. **`/boot`** to confirm numbers match (1596/71, 129 decisions, 39 migrations).
  2. **`gh pr view 10`** — check status + address any reviewer comments that landed overnight.
  3. **On-device eyeball** of the D-094 "match" framing — cold simulator, open Top Picks, confirm the hero's small "match" label under the 92px number doesn't look cramped, and the leaderboard pill's "X% match" reads well at small sizes.
  4. Pick scope: (a) extend D-094 fix to `TopPicksCarousel` + `TopMatchesCarousel` for symmetry, (b) Top Picks visual polish carry-overs (Brand CAPS, top-2 ingredients, V2 two-column hero), (c) tackle one of the 5 deferred code-review items above, or (d) start the next M9 thread (HomeScreen overhaul, custom icons).
- **Gotchas / context for next session:**
  - **D-094 score-pill pattern is now `{score}% match` on new browse components** (TopPickHeroCard + TopPickRankRow). `TopPicksCarousel` + likely `TopMatchesCarousel` are pre-existing outliers still rendering naked `{score}%`. If you touch either, adopt the "X% match" pattern — the "for {petName}" piece is carried at screen/card scope by the trophy badge or screen title.
  - **Hero "match" label sizing is hand-tuned** — `FontSizes.xs` / fontWeight 600 / marginTop -2 / letterSpacing 0.3, centered under the 92px FontSizes.xl number. If anyone changes `FontSizes.xl` or the 92px badge radius, re-check the fit before committing.
  - **Highest-risk of the 9 deferred code-review items is the `fetchCategoryTopPicks` vet_diet gap.** It's safe today only because TopPicksCarousel is hidden for vet_diet. If that hide-guard is ever removed (e.g., a future "browse vet diets" feature), the gap lights up silently — add vet_diet to `resolveSeeAllDestination` at the same time.
  - **Code review pipeline on this PR cleared the threshold bar cleanly** — 9 issues surfaced, 0 ≥80, D-094 fix applied proactively despite filter. If a future review run finds 0 issues total (instead of 9 scored low), that's more suspicious — the scorers should find *something* on a PR of this size.
  - **Skeleton color gotcha from session 52 still applies.** Don't reintroduce iOS light-mode greys (`#E5E5EA` / `#F2F2F7` / `#D1D1D6` / `#C7C7CC`) in skeleton/loading components — use `Colors.chipSurface`. `PositionMap.tsx:28` `UNRATED_COLOR` is intentional and out of scope.
  - **Session 51 gotchas still apply** — ScoreRing substitution in hero, Brand CAPS deferral, spec drift, Gemini V2 mockup deltas.
