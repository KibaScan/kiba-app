# Multi-Agent Cleanup — Dead-Code Removal + Screen File-Splitting

**Date:** 2026-04-22
**Author:** Claude Code (with Steven)
**Status:** Design — awaiting user approval before `writing-plans` handoff
**Target branch base:** `m5-complete` @ `3d61319`

---

## 1. Problem Statement

The Kiba repo has accumulated two distinct kinds of debt that are worth paying down in M9 before the HomeScreen visual overhaul and public launch:

1. **Dead code.** No dead-code tooling has ever run against this repo. `CURRENT.md` explicitly flags pre-existing tsc noise in `docs/plans/search-uiux/` (10 stale planning artifacts) and `supabase/functions/batch-score/` (the latter is an intentional scoring engine duplicate; the former is not). There are no self-declared `@deprecated` markers in `src/`, so candidates must be discovered via static analysis + manual sweep.
2. **Oversized screen files.** Eight screens exceed 1,000 LOC:
   `SafeSwitchDetailScreen` (1,226), `EditPantryItemScreen` (1,222), `HomeScreen` (1,214), `ResultScreen` (1,122), `EditPetScreen` (1,083), `PetHubScreen` (1,069), `CompareScreen` (1,055), `PantryScreen` (1,041). These slow iteration, make reviews harder, and have reached the scale where focused LLM edits grow unreliable.

Two free `/ultrareview` runs are available. We burn one per pass.

Both passes are **high-confidence, mechanical** work. No behavior change. No new features. No scoring engine edits. No migration work. No design-system tokens.

---

## 2. Architecture & Sequencing

**Two independent passes, each its own branch and PR.** Dead-code first, refactor second. **Sequential, not concurrent.**

```
m5-complete @ 3d61319
   │
   ├── branch: m9-deadcode-sweep   (serialized — dead-code graph is cascading)
   │     ├── commit 1: knip install + config
   │     ├── commit 2: Agent D1 — docs/plans/search-uiux/ + *.ref/.bak/.orig delete
   │     │              (clears tsc noise, establishes post-D1 baseline)
   │     ├── commit 3: Agent A — unused files (fresh knip run before)
   │     ├── commit 4: Agent B — unused exports (fresh knip run before)
   │     ├── commit 5: Agent C — unused deps + @types siblings (fresh knip run before)
   │     ├── commit 6: Agent D2 — commented-code in src/ (runs against minimal tree)
   │     └── kiba-code-reviewer → /ultrareview → squash-merge to m5-complete
   │
   └── (after merge) branch: m9-screen-splits   (parallel — files non-overlapping)
         Each agent runs in an isolated worktree (Agent tool `isolation: "worktree"`),
         merges sequentially back to m9-screen-splits. No cross-file contention.
         │
         ├── Agent 1: SafeSwitchDetailScreen  ┐
         ├── Agent 2: EditPantryItemScreen    │
         ├── Agent 3: HomeScreen              │
         ├── Agent 4: ResultScreen            │  dispatched in parallel;
         ├── Agent 5: EditPetScreen           │  each owns one screen file
         ├── Agent 6: PetHubScreen            │
         ├── Agent 7: CompareScreen           │
         ├── Agent 8: PantryScreen            ┘
         └── kiba-code-reviewer → /ultrareview → squash-merge to m5-complete
```

**Why sequential between passes:**
- File-level contention: dead-code agents may delete files that refactor agents are extracting sub-components from.
- Wasted work: refactor could extract into a file that dead-code was about to delete.
- Ultrareview clarity: each pass produces a narrow, focused diff. Concurrent changes mix two concerns into one review.

**Why two branches not one:** Standing "branch per session" preference. Independent rollback per pass. Each ultrareview has narrow scope.

**Parallelism model differs by pass:**
- **Dead-code pass is serialized.** Dead code is a cascading graph — after Agent A deletes files, the exports they consumed become newly dead (B's scope) and the deps they solely used become newly dead (C's scope). Running B and C against A's pre-execution knip report misses the cascade. A fresh `knip` run precedes each of A/B/C. Also, dispatching concurrent agents to the same working tree creates race conditions on `jest` (one agent's in-flight edit breaks another's test run) and dispatching to separate worktrees produces modify/delete merge conflicts where one worktree deletes a file another worktree edited.
- **Refactor pass is parallel.** Each of the 8 refactor agents owns one unique screen file. Non-overlap is guaranteed by file ownership, so worktree merge-back is clean. Agents dispatch concurrently with `isolation: "worktree"` (see Agent tool docs) so their `jest` runs don't interleave on a shared tree.

---

## 3. Dead-Code Pass

### 3.1 Pre-agent setup (done manually before dispatch)

1. `npm i -D knip`
2. Add `knip.json` at repo root with RN/Expo-aware `entry` array:
   ```json
   {
     "entry": [
       "index.ts",
       "App.tsx",
       "supabase/functions/**/index.ts",
       "babel.config.js",
       "metro.config.js",
       "app.json",
       "*.config.{js,ts,cjs,mjs}"
     ],
     "project": ["src/**/*.{ts,tsx}", "__tests__/**/*.{ts,tsx}"],
     "ignore": ["supabase/functions/batch-score/scoring/**", "docs/**"]
   }
   ```
   The expanded `entry` prevents Knip from flagging Babel plugins, Metro resolvers, and Expo config deps (app.json) as unused. Without it, Agent C would uninstall build-critical packages. Excludes the `batch-score/scoring/` subfolder (intentional duplicate of `src/services/scoring/` — Deno Edge Functions can't import from `src/`) and `docs/` (handled manually by Agent D1/D2).
3. `npx knip --reporter json > .knip-report.json`. Reference artifact — deleted at end of pass.
4. **Commit 1:** knip install + config + baseline report (tracked temporarily).
5. **Capture tsc baseline:** `npx tsc --noEmit 2>&1 | sort > .tsc-baseline.txt`. Current baseline includes noise in `docs/plans/search-uiux/` (to be cleared by Agent D1) and `supabase/functions/batch-score/scoring/` (structural — persists). Baseline file is the diff target for every agent's tsc gate (see §5.2 redefined gate).

### 3.2 Agent briefing template

Every dead-code agent operates under these invariants:

- **Dispatched in series, one at a time.** No two dead-code agents run concurrently. A fresh `npx knip --reporter json` runs **before** Agents A, B, and C to catch cascading dead-code (e.g., exports become dead only after their consumer files are deleted).
- **Grep-verify every candidate** — knip's static analysis misses string-based dynamic imports, JSX consumed by react-navigation object-literal keys, and JSON-manifest references. Grep the symbol/filename across the full repo before removal.
- **Test cascade** — if deleting `src/foo.ts` orphans `__tests__/foo.test.ts`, delete the test too.
- **Per-agent safety gate, hard:**
  - `npx tsc --noEmit 2>&1 | sort` must not introduce errors relative to `.tsc-baseline.txt` (the post-commit-1 baseline). New errors fail the gate; existing structural noise in `supabase/functions/batch-score/scoring/` is acceptable.
  - `npm test` must show 79 suites / 1665 tests green.
  - Regression anchors unchanged: Pure Balance = 61 (Dog), Temptations = 0 (Cat Treat).
  - Agent commits only after both pass. If either fails, agent skips that candidate and reports, rather than forcing.
- **Report format** — each agent reports: candidates removed, candidates skipped + reason, tsc diff vs baseline, test status.

### 3.3 Per-agent scope (dispatch order: D1 → A → B → C → D2)

| # | Agent | Input slice | Contract |
|---|---|---|---|
| 1 | **D1 — docs + backup file sweep** | Manual targets | Delete `docs/plans/search-uiux/` entirely (10 files — `.tsx`, `.ts`, `.sql`, `.md`, `.ref`). Delete repo-wide `*.ref` / `*.bak` / `*.orig` / `*~`. No src/ edits in D1. **Rationale for running first:** clears the 14 pre-existing `docs/plans/search-uiux/*.ts` tsc errors so the tsc-diff-vs-baseline gate is tight for downstream agents. |
| 2 | **A — unused files** | Fresh `knip` `files` array (re-run after D1) | Grep each filename across repo. If zero references, delete file. Delete associated test if orphaned. Special caution: anything under `src/navigation/` (react-navigation may reference via config keys — read navigation files manually before deleting any candidate there). |
| 3 | **B — unused exports** | Fresh `knip` `exports` array (re-run after A) | Grep each symbol across repo. If zero external callers, remove `export` keyword (keep internal symbol if locally referenced). Special caution: default exports used by `src/navigation/` stack configs; any `type` / `interface` export whose name ends in `ParamList`. |
| 4 | **C — unused deps** | Fresh `knip` `dependencies` + `devDependencies` arrays (re-run after B) | Remove from `package.json`. **Also remove the matching `@types/<pkg>` entry** when removing a typed dependency. Run `npm install` to regenerate lockfile. Special caution: Expo config plugins registered in `app.json` — cross-check before removing. |
| 5 | **D2 — commented-code sweep** | Manual scan of post-reduction `src/` | Scan remaining `src/` files for commented blocks >5 lines that exist for obvious historical reasons (`if (false) { ... }`, entire commented component exports, commented-out old imports). Borderline cases: skip and report. Runs last so the tree is already minimal and the scan is cheaper. |

### 3.4 Why serialized, not parallel

Two concrete reasons parallelism fails on the dead-code graph:

1. **Cascade correctness.** Dead code propagates: deleting file `X` can make export `Y` in file `Z` newly-dead (if `X` was `Y`'s sole consumer) and package `P` newly-dead (if `X` was `P`'s sole importer). If B and C dispatch against A's *pre-execution* knip report, they miss these newly-dead artifacts. A fresh `knip` run between each of A/B/C catches the cascade.

2. **Git & test-runner contention.** Concurrent agents on a shared working tree (no isolation) trigger interleaved `jest` runs where Agent 1's in-flight edit breaks Agent 2's test gate. Concurrent agents in isolated worktrees produce `CONFLICT (modify/delete)` on merge-back when one worktree deletes a file another worktree edited. Serializing eliminates both classes of problem.

Dead-code throughput loss from serialization is small — each step is bounded by `npm test` runtime (~30s once warm) plus agent thinking time. Total pass: ~10–15 minutes wall-clock, not hours.

### 3.5 Known risks per agent

- **A — navigation consumers.** `src/navigation/*Stack.tsx` may reference screen components via object keys, which knip's AST parser can miss. Agent manually reads `src/navigation/` and confirms each screen-file candidate is actually absent there before deleting.
- **B — react-navigation type augmentation.** Some exports exist only to satisfy typing (e.g., `ParamList` exports). Agent skips exports whose names end in `ParamList` or that are `type`/`interface` declarations under `src/navigation/`.
- **C — Expo plugin deps + @types drift.** `expo-dev-client`, `expo-font`, `expo-notifications` etc. may be listed as deps but used only by Expo config + native runtime. Agent cross-checks `app.json` + searches for symbol import before removing. When a typed dep is removed, the sibling `@types/<pkg>` (if any) is removed in the same commit to prevent `@types` drift.
- **D1 — nothing dynamic.** Static file deletes. Only risk is deleting a file that a doc index or sibling spec references — docs aren't part of the build, low-stakes even if so.
- **D2 — "load-bearing comments".** Commented code sometimes encodes a historical decision. Contract restricts deletions to obvious-dead patterns only. When in doubt, skip and report.

### 3.6 Acceptance criteria (pass merges when all met)

- [ ] `docs/plans/search-uiux/` deleted (10 files).
- [ ] Repo-wide `*.ref` / `*.bak` / `*.orig` / `*~` files absent.
- [ ] `knip` post-sweep report shows material reduction from the pre-sweep baseline, with every skipped candidate documented in the final agent report.
- [ ] `npx tsc --noEmit` introduces **zero new errors** relative to the post-D1 baseline. (Existing `batch-score/scoring/` structural noise persists.)
- [ ] 79 suites / 1665 tests green.
- [ ] Pure Balance = 61, Temptations = 0.
- [ ] `kiba-code-reviewer` returns no blockers.
- [ ] `/ultrareview` returns no blockers.

---

## 4. Refactor Pass (File-Splitting)

### 4.1 Pre-agent setup

1. New branch `m9-screen-splits` off updated `m5-complete` (dead-code merged).
2. No new tooling.
3. **Each refactor agent dispatches with `isolation: "worktree"`** (Agent tool parameter). This gives each agent its own git worktree, eliminating interleaved `jest` runs and modify/delete conflicts. Since each agent's file set is non-overlapping (one screen + its sibling new component files), worktree merge-back is conflict-free.
4. Capture post-dead-code tsc baseline: `npx tsc --noEmit 2>&1 | sort > .tsc-baseline.txt` for the refactor-pass diff target.

### 4.2 Eight parallel agents, one screen each

| # | Screen | LOC | Likely extracts |
|---|---|---|---|
| 1 | `src/screens/SafeSwitchDetailScreen.tsx` | 1,226 | Recipe card, proportion gauge, retroactive logging sheet, completion card |
| 2 | `src/screens/EditPantryItemScreen.tsx` | 1,222 | Quantity card, feeding card, schedule card, time-picker modal |
| 3 | `src/screens/HomeScreen.tsx` | 1,214 | Category carousel row, recall banner, recent-scans section, upcoming-appointment card |
| 4 | `src/screens/ResultScreen.tsx` | 1,122 | Overflow menu, bookmark icon cluster, bypass banners |
| 5 | `src/screens/EditPetScreen.tsx` | 1,083 | Weight card, health conditions section, allergen picker section |
| 6 | `src/screens/PetHubScreen.tsx` | 1,069 | Health records section, appointments card, treat battery card |
| 7 | `src/screens/CompareScreen.tsx` | 1,055 | Side-by-side waterfall, product picker entry |
| 8 | `src/screens/PantryScreen.tsx` | 1,041 | Filter chip row, pet carousel header, empty states |

The "likely extracts" column is guidance, not prescription. Each agent picks boundaries based on what extracts cleanly for that screen.

### 4.3 Skip list (out of scope for this pass)

- `src/services/pantryService.ts` (1,080) — service, not screen. Wants domain-split refactor (CRUD vs offline guards vs rebalancing), different shape. Flag for future session.
- `src/utils/pantryHelpers.ts` (860) — utility bundle. Same reasoning.
- `src/components/scoring/ScoreWaterfall.tsx` (826) — under 1,000 threshold AND scoring-adjacent (brand-blind engine risk). Skip.

### 4.4 Contract each refactor agent must follow (non-negotiable)

1. **Zero behavior change.** Extracted sub-components receive the exact props they need via destructure. State and handlers stay in the parent screen. No new hooks, no new context, no memoization additions, no prop-drilling reshape.
2. **No public API change.** Screen's default export signature is unchanged. Navigation types unchanged.
3. **Colocate extracts.** New files live in `src/components/<screen-domain>/`, following the session-61 `src/components/bookmarks/BookmarkRow.tsx` precedent. One sub-component per file. Co-locate styles within the sub-component's file if self-contained; shared styles stay in the parent screen's StyleSheet.
4. **Test logic stays unchanged — test imports MAY update.** Do not alter test assertions, mock behavior, or setup logic. Updating a test's `import` path to follow a helper/component that was moved to a new location **is required and permitted**. Example: if `EditPantryItemScreen.test.ts` imports `formatTime` from `src/screens/EditPantryItemScreen` and the agent extracts `formatTime` to `src/utils/editPantryTimeHelpers.ts`, the test's import line MUST be updated to the new path. (Empirically: 2 of 8 target screens have tests importing named helpers from them — `EditPantryItemScreen`, `PantryScreen`.) Do not add new tests.
5. **Per-agent safety gate identical to dead-code pass:** `npx tsc --noEmit` introduces no new errors vs `.tsc-baseline.txt` + `npm test` green (79 suites / 1665 tests) + regression anchors unchanged, **before commit**.
6. **No cross-screen shared abstractions.** If Agent 1 and Agent 6 see similar card shapes, do NOT extract a shared abstraction in this pass. Session-61 advisor lesson: premature shared abstractions hide distinct bugs. Each screen's extract stays local.
7. **Escape hatch.** If a screen resists clean extraction (every sub-block is deeply coupled to local state/handlers), agent reports "no clean cut available" and skips. A partial split (e.g., 3 of 6 possible extracts) is acceptable.
8. **No circular imports.** When extracting a sub-component, the parent screen often contains locally-defined types (`type PetFormState`, `interface CardProps`). If the extracted child imports such a type from the parent AND the parent imports the child, that's a circular dependency. TypeScript may accept it; the React Native Metro bundler can fail at runtime with `require() is undefined` / white-screen errors that tests don't catch. Resolution: shared TS types MOVE to a colocated `src/components/<domain>/types.ts` (preferred) or inline into whichever file is the sole consumer. Agent verifies by running `npx madge --circular src/` (lightweight, install only if absent) OR by tracing import chains manually after extraction.

### 4.5 Known risks

- **Line count is not inherently bad.** A 1,214-line screen may decompose into 6 tight components; it may also be 1,214 lines of unique top-level layout that should stay together. Partial extractions are acceptable per §4.4(7).
- **Coupled state.** React screens often have state that several sub-sections read. Extract callers receive props; don't promote state upward or introduce context.
- **Style sharing.** If a style is referenced from multiple sub-components, it stays in the parent screen's StyleSheet and gets passed via prop, not copied.
- **Circular-import trap (see §4.4(8)).** The most common failure mode on RN screen extraction: parent defines a type, child imports the type from parent, parent imports the child. Metro bundler chokes at runtime even when tsc passes. Types → `types.ts` at extraction time.
- **Test import drift (see §4.4(4)).** 2 of 8 target screens have test files importing named helpers from them. Agents 2 (EditPantryItemScreen) and 8 (PantryScreen) must update the respective test file's `import` statement when they extract helpers to sibling paths — otherwise their test gate fails.

### 4.6 Acceptance criteria

- [ ] At least 5 of 8 target screens show a meaningful LOC reduction (partial / skipped acceptable per escape hatch).
- [ ] Every extracted sub-component lives in `src/components/<domain>/`.
- [ ] No screen's public surface changed (imports in sibling screens and navigation types unchanged — grep verifies).
- [ ] **No circular imports introduced** (§4.4(8) — verified via `madge --circular src/` or manual import-chain trace).
- [ ] 79 suites / 1665 tests green. Test file `import` paths may have updated (§4.4(4)) but no test logic, assertions, mocks, or setup changes.
- [ ] `npx tsc --noEmit` introduces zero new errors vs the refactor-pass baseline.
- [ ] Pure Balance = 61, Temptations = 0.
- [ ] `kiba-code-reviewer` returns no blockers.
- [ ] `/ultrareview` returns no blockers.

---

## 5. Safety, Rollback, Baseline

### 5.1 Baseline snapshot (captured before each pass)

- `npx tsc --noEmit 2>&1 | sort > .tsc-baseline.txt` — captures current noise including the structural `supabase/functions/batch-score/scoring/` errors (intentional Deno duplicate). Used as the diff target for every agent's tsc gate.
- `npm test` recorded as 79 suites / 1665 tests green.
- Regression anchors: Pure Balance = 61, Temptations = 0.
- `git rev-parse HEAD` pinned as rollback target.
- **Dead-code pass baseline captures the PRE-D1 state** with search-uiux errors included. D1 runs first specifically to clear those, tightening the baseline for Agents A/B/C/D2 which refresh the baseline after D1's commit.

### 5.2 Three-layer safety gate per pass

| Layer | When | Authority | Scope |
|---|---|---|---|
| **Per-agent self-verify** | Before each agent commit | Agent itself, hard gate | `tsc --noEmit` introduces **no new errors vs `.tsc-baseline.txt`** (not "tsc clean" — structural noise in `batch-score/scoring/` persists by design). Full jest suite green. Regression anchors unchanged. |
| **`kiba-code-reviewer`** | After all agents land, before ultrareview | Report-only (human applies fixes) | Kiba-specific non-negotiables: UPVM (D-095), D-168 framing, RLS, paywall location (rule 3), scoring brand-blindness (rule 1), a11y labels on score surfaces |
| **`/ultrareview`** | Final, before merge | Cloud multi-agent | Architectural issues, subtle logic bugs, cross-file patterns |

### 5.3 Rollback procedure

- **Agent fails self-verify:** Agent skips the failing candidate, commits what's safe, reports. Decision point for user: accept partial, extend scope, or retry.
- **`kiba-code-reviewer` flags blockers:** Reviewer is report-only. Human reads report, applies fixes, re-runs `tsc` + `jest`, pushes a follow-up commit. Loop until reviewer is satisfied.
- **`/ultrareview` flags blockers:** Same loop. Ultrareview burn is committed once started — fix-forward preferred over restart. For catastrophic blockers, back out individual commits rather than branch.
- **Full-pass failure:** `git branch -D <branch>` locally. Base `m5-complete` is untouched until the merge commit. Merge is the only destructive-to-main step, gated by ultrareview-clean.

### 5.4 Non-negotiables that must survive both passes (from CLAUDE.md)

These are invariants. Agent contracts forbid touching them; reviewer layers check them:

1. Scoring engine **brand-blind** — no brand-specific conditionals introduced.
2. **Affiliate isolated** from scoring — `affiliate_links` stays invisible to engine.
3. **Paywall checks only in `permissions.ts`** — no scattered `if (isPremium)` added.
4. **D-168 score framing tiers** — outbound full phrase, in-app `{score}% match`, dense `{score}%`; a11y labels carry full phrase.
5. **UPVM compliance (D-095)** — never "prescribe / treat / cure / prevent / diagnose" in copy.
6. **Bypass patterns** — vet diet (D-135), species mismatch (D-144), variety pack (D-145), recalled (D-158) still bypass scoring.
7. **RLS on user tables** — untouched (no migration work in either pass).

---

## 6. Non-Goals

Explicitly out of scope. If any of these are found during the passes, they are flagged in the final report and deferred to separate sessions.

- **Behavior changes of any kind** — no bug fixes, no UX improvements, no accessibility fixes beyond what existing code already has.
- **Test additions or modifications.**
- **Design system token migration** — the ~17 rgba-alpha sites flagged in `CURRENT.md` need their own dedicated session per the file's own guidance ("Do NOT fix individually").
- **Service / util domain-splitting** — `pantryService.ts` and `pantryHelpers.ts` deserve a separate refactor pass with different shape.
- **`supabase/functions/batch-score/`** — scoring engine duplicate is intentional; the Deno runtime can't import from `src/`.
- **`CURRENT.md` rotation** — handled by `/handoff`, not by either pass.
- **Migration work.** No new migrations, no schema changes.
- **Scoring engine changes.** Pure Balance = 61, Temptations = 0 are invariants.

---

## 7. Open Questions (to be resolved inline during execution)

- **Exact knip candidate count** — unknown until first run. `.knip-report.json` output will inform whether Agent A / B / C each have enough slice to be worth dispatching, or whether we consolidate.
- **Which screens actually split cleanly** — refactor agents determine this per-screen. Acceptance criteria allow up to 3 skips.
- **Ultrareview findings** — unknowable in advance; fix-forward loop handles them.

---

## 8. Handoff to `writing-plans`

Once this spec is approved by the user, brainstorming hands off to the `writing-plans` skill to produce a detailed execution plan (per-commit breakdown, agent dispatch prompts, verification commands per step).
