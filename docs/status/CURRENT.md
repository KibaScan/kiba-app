# Project Status — Last updated 2026-04-21 (session 59 — merge cascade landed: PR #14 D-168 reduce-score-noise + PR #13 Bookmarks squash-merged into m5-complete)

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

- **Tests:** 1627 passing / 74 suites
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

- **Date:** 2026-04-21 (session 59 — merge cascade: PR #14 `m9-reduce-score-noise` + PR #13 `m9-bookmarks-history` both squash-merged into `m5-complete`; no new code, only reconcile)
- **Branch:** `m9-bookmarks-history` (local) — squash-absorbed into `m5-complete`. Single new local commit `e2fe777` (merge-reconcile) + handoff commit.
- **PRs shipped:**
  - **[#14](https://github.com/KibaScan/kiba-app/pull/14)** — squash-merged as `30a596a` on `m5-complete`. Title: "M9: D-168 score framing — terse by default, supersedes D-094". Opened + merged without `/code-review` at user direction `(b)`.
  - **[#13](https://github.com/KibaScan/kiba-app/pull/13)** — squash-merged as `66657f9` on `m5-complete`. Title: "M9: Bookmarks + expanded scan history". Was CLEAN/MERGEABLE after reconcile push.
- **Accomplished:**
  - **`/boot`** — oriented on M9; verified session-58 handoff landed; flagged CLAUDE.md count drift (130→131 decisions, 039→040 migrations) as low-priority carry-over.
  - **Advisor call** pre-merge — confirmed ordering (reduce-score-noise first), flagged non-conflict dual-touch files (`ResultScreen.tsx`, `CLAUDE.md`, `ROADMAP.md`, `CURRENT.md`) + DECISIONS.md resolution rules. Surfaced "no prior review on reduce-score-noise" for user decision. User picked `(b)` merge-immediately.
  - **PR #14 open + squash-merge** — 4 commits on `m9-reduce-score-noise` (retire D-094 / add D-168 / strip ScoreRing caption / a11y backfill 7 surfaces / session-56 handoff). CLEAN, zero status checks.
  - **Reconcile merge `m5-complete` → `m9-bookmarks-history`** — expected D-168 dupe conflict + 3 other regions in DECISIONS.md + 4 regions in CURRENT.md. ResultScreen.tsx auto-merged clean (orthogonal touches confirmed pre-merge). Resolution per advisor guidance:
    - **DECISIONS.md:** kept reduce-score-noise's D-168 body as canonical (ScoreRing in dense tier, "Compliance backfill (completed)" section, outbound-share sole exception, reference pattern for future surfaces) + appended D-169 body from bookmarks-history. Header → 131 / D-001–D-169; supersedes list now includes `D-094 superseded by D-168`; fixed stale "D-167: condition-aware feeding frequency" (D-167 body was retitled to Allergen Score Cap in session 56 but header summary was never updated).
    - **CURRENT.md:** kept HEAD (session 58 `Last` + session 57 `Previous`); merged the two What Works bullets (D-168 framing + D-169 bookmarks are orthogonal); kept accurate numbers.
    - **CLAUDE.md:** auto-merged but freshened stale counts 130→131 and 039→040.
  - **Commit `e2fe777` pushed** to origin/m9-bookmarks-history. `npx jest` green: 1626 → **1627** tests (+1 from reduce-score-noise's D-168 a11y assertion on TopPickRankRow).
  - **PR #13 squash-merge** — GitHub mergeability went UNKNOWN briefly post-push, resolved to CLEAN/MERGEABLE after one re-query. Squashed to `66657f9`.
- **No new decisions, no new migrations, no scoring changes, no UI changes.** D-168 + D-169 already existed; this session deduped the double-backfill and shipped both to `m5-complete`.
- **Files changed this session (1 local code commit):**
  - `e2fe777` — merge-reconcile. Touched DECISIONS.md, CLAUDE.md, docs/status/CURRENT.md + absorbed the full `m9-reduce-score-noise` diff (28 files from PR #14: browse/scoring/result components, enforcement mirrors, TopPickRankRow test, new a11y-backfill-shipped spec doc).
- **Numbers (all green):** 1627 tests / 74 suites / 3 snapshots. 131 decisions (D-001–D-169). 40 migrations. 19,058 products. Pure Balance = 61, Temptations = 0. `npx jest regressionAnchors` confirmed anchors post-merge.
- **Not done yet:**
  - **On-device VoiceOver QA** — 11 bookmark/scan surfaces (session 57/58 carry) + 7 D-168 a11y-backfill surfaces (session 56 carry) + recalled-product red-border + `RecallDetail` routing.
  - **Cross-pet store-write race audit** — same pattern as session-58 `useBookmarkStore` guard (`if (get().currentPetId === petId)` on post-async resync). Audit `usePantryStore` (per-pet assignments + optimistic log-feeding / log-treat), `useTreatBatteryStore` (per-pet kcal), any scoring-cache refresh wired to active pet. Open until done.
  - **Next M9 scope pick** — HomeScreen visual overhaul, custom icon rollout (5 pending v2 bold variants), stale browse scores form-aware fix, or broader Matte Premium alpha audit (~17 rgba sites cataloged in Up Next).
  - **Optional branch cleanup:** `m9-bookmarks-history`, `m9-reduce-score-noise` merged; `m9-scorebadge-d094`, `m9-top-picks-screen`, `m9-current-md-trim` still exist on origin from prior sessions.
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rotated session 58 → Previous, session 59 → Last, session 57 dropped.
  2. **Fast-forward local `m5-complete`:** `git checkout m5-complete && git pull --ff-only` — picks up `30a596a` + `66657f9`.
  3. **Cut fresh session branch** off updated `m5-complete` (per "branch per session" memory) before first commit.
  4. Pick one carry-over: VoiceOver QA (tactical), cross-pet race audit (architectural), or next M9 scope (HomeScreen overhaul = most user-visible pre-launch).
- **Gotchas / context for next session:**
  - **Post-squash-merge dead branches:** `m9-bookmarks-history` and `m9-reduce-score-noise` local branches still hold their original commit history; the squashes on GitHub created equivalent single commits on `m5-complete`. Don't rebase these — delete or ignore. `git branch -d` will refuse because git sees them as unmerged (squash ≠ merge-base advance); use `-D` if cleaning up.
  - **Merge-strategy convention re-confirmed this session:** feature → `m5-complete` uses `--squash` (preserves clean single-commit history on integration branch); `m5-complete` → `main` cascade uses `--merge` (preserves PR history for production audit trail). Repo allows all three modes — convention is the guard.
  - **`gh pr view` JSON fields:** no `merged` field — use `state`, `mergedAt`, `mergeCommit`. Silent stdout from `gh pr merge` on success is normal (no news = good news).
  - **Post-push mergeability lag:** GitHub computes `mergeable` asynchronously; first `gh pr view` after a push often returns `UNKNOWN`. Re-query once — don't assume broken.
  - **D-094 residue hunt pending:** D-168 replaces D-094 in `CLAUDE.md` (rule #9 + Score Framing), `src/components/CLAUDE.md`, `.github/copilot-instructions.md`, both `kiba-*` agents, `.agent/workflows/review.md`, `ResultScreen.tsx` file-top comment. Any stray D-094 reference elsewhere (other docs, comments) is a next-audit-pass item.
  - **All session-57/58 gotchas still apply:** `Colors.primary` doesn't exist (use `Colors.accent`); `SwipeableRow` is default export with `onDelete` / `deleteConfirmMessage` API; `batchScoreHybrid` JIT is fire-and-forget for null-score cache; no toast utility.

## Previous Session

- **Date:** 2026-04-20 (session 58 — follow-up to session 57: cross-pet toggle race fixed on `useBookmarkStore`; PR #13 still open on same branch)
- **Branch:** `m9-bookmarks-history` (continuing from session 57). 24 commits on branch (22 from session 57 + 2 new: `9a7c115` race fix, `00e82be` handoff).
- **PR:** [#13](https://github.com/KibaScan/kiba-app/pull/13) — still awaiting human review. Fast-forward pushed to origin (`961644e..00e82be`) — race fix + regression tests + this rotation now on remote.
- **Accomplished:**
  - **`/boot`** — verified session-57 rolling-window rewrite landed correctly; working tree clean; milestone = M9 in progress.
  - **`/code-review` on PR #13** — 4-agent parallel review (2 CLAUDE.md-compliance sonnets + 2 opus bug scans) with a validation pass per finding. Surfaced **1 high-signal race** and correctly filtered **1 false-positive** (D-168 accessibility invariant — the outer `TouchableOpacity` already carries the full `"${score}% match for ${petName}"` label, which is what VoiceOver reads; the pill child is subsumed under the parent element and does not need a duplicate label).
  - **Race fix on `src/stores/useBookmarkStore.ts:85,89`** — wrapped both post-`svcToggle` `loadForPet(petId)` calls in `if (get().currentPetId === petId)` guards. Before the fix, a toggle for pet A that resolved *after* the user switched to pet B would overwrite the store's `currentPetId` back to A and replace `bookmarks` with A's list — producing dark bookmark indicators on HomeScreen (because `isBookmarked` pet-id guard at `:102` returns `false` on mismatch) and wrong list on BookmarksScreen until the next pet-switch self-heal. With the guard, stale toggles skip the reload entirely and the active pet's state is preserved.
  - **2 new TDD regression tests** in `__tests__/stores/useBookmarkStore.test.ts` — success-path and error-path variants. Both failed against the unpatched code (`Expected: "B" / Received: "A"`), both pass after the fix.
- **No new decisions, no new migrations, no scoring changes.**
- **Files changed (3 in diff vs. `m9-bookmarks-history@HEAD^`):**
  - `src/stores/useBookmarkStore.ts` — guard added at lines 85 and 89 (+8 / −2)
  - `__tests__/stores/useBookmarkStore.test.ts` — 2 new tests (+57 / 0)
  - `docs/status/CURRENT.md` — this rotation (handoff only)
- **Numbers (all green):** **1626 tests / 74 suites / 3 snapshots** (up from 1624; +2 for race regressions). 131 decisions. 40 migrations. 19,058 products. Pure Balance = 61, Temptations = 0. `npx jest` runtime 5.68s.
- **Not done yet:**
  - **PR #13 review + merge.** Still awaiting human review. Merge-order decision unchanged from session 57 — recommend landing `m9-reduce-score-noise` first so D-168 dupe resolves cleanly on PR #13.
  - **On-device QA** — VoiceOver announcement check on 11 bookmark/scan score surfaces + recalled-product red-border + `RecallDetail` routing across three surfaces. Carried over from session 57.
  - **Next M9 scope pick** — HomeScreen visual overhaul, custom icon rollout, stale browse scores form-aware fix, or broader Matte Premium alpha audit (~17 rgba sites).
- **Start the next session by:**
  1. **`/boot`** — verify rolling window rewrote session 57 → Previous, session 58 → Last, session 55 deleted.
  2. **Land `m9-reduce-score-noise`** (session 56's D-168 work — 4 commits, PR not yet opened) so D-168 is baked into `m5-complete` before PR #13 resolves its D-168 dupe.
  3. **Merge PR #13** after (1).
  4. Execute VoiceOver + recalled-product QA on the merged branch.
  5. Pick next M9 scope.
- **Gotchas / context for next session:**
  - **Cross-pet store-write race is a pattern, not a one-off.** Any Zustand store that does optimistic-update → async server call → server-authoritative resync against a per-pet active context needs a symmetric guard on the resync. Pattern: `if (get().currentPetId === petId) await get().loadForPet(petId)` on both success and error paths. Only `useBookmarkStore` is patched. Worth auditing: `usePantryStore` (per-pet assignments + optimistic log-feeding / log-treat), `useTreatBatteryStore` (per-pet kcal), any scoring-cache refresh wired to active pet. Do this before declaring the class solved.
  - **Code-review D-168 false-positive worth remembering.** The review agent flagged score pills for missing element-level `accessibilityLabel`. Validation subagent correctly ruled NOT a violation — in React Native, a `TouchableOpacity` / `Pressable` with `accessibilityLabel` IS the accessibility element and subsumes its children; VoiceOver reads only the row label. The new bookmark/scan rows carry the full `"${score}% match for ${petName}"` string on the row wrapper, which is compliance *stricter* than D-168's pill-only known-gap pattern. Don't re-flag. Worth adding to `.agent/design.md` accessibility guidance if we write one.
  - **Previous-session mash-tap race** was only surfaced by rapid physical tapping. **This session's cross-pet race** was caught cleanly by code review without device repro. Different failure modes, both signals worth keeping: (a) ship to device before declaring "tests green = done"; (b) run `/code-review` before merge for races that tests miss.
  - **All session-57 gotchas still apply:** D-168 merge conflict on DECISIONS.md tail when both branches land; `Colors.primary` doesn't exist (use `Colors.accent`); `SwipeableRow` is default export with `onDelete` / `deleteConfirmMessage` API; `batchScoreHybrid` JIT is fire-and-forget for null-score cache; no toast utility.

