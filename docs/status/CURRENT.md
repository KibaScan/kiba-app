# Project Status — Last updated 2026-04-20 (session 58 — cross-pet toggle race fixed on useBookmarkStore, PR #13 still open)

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

- **Tests:** 1626 passing / 74 suites
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

## Previous Session

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
  - **D-169 (session 57):** Bookmarks — per-pet watchlist, hard cap 20, no paywall, live score (not snapshot), immutable scans, mailto-based Report issue stub.
  - **D-168 (backfilled on session 57):** Tiered score framing (terse by default, outbound-share exception). Originally written on `m9-reduce-score-noise`; added to this branch to keep it self-consistent. Will merge-conflict on DECISIONS.md tail.
- **Files changed (22 in session-57 diff vs. `origin/m5-complete`):** 8 new source files, 5 modified source files, 4 doc files, 2 spec/plan docs, 2 test files new (bookmarkService + useBookmarkStore), 1 test file new (ResultHeaderMenu). +4,250 lines / −24 lines. 28 new tests (12 service + 11 store + 5 component).
- **Numbers at session-57 close:** 1624 tests / 74 suites / 3 snapshots. 131 decisions. 40 migrations. 19,058 products. Pure Balance = 61, Temptations = 0.
