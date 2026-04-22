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
   ├── branch: m9-deadcode-sweep
   │     ├── commit: knip install + config
   │     ├── commit: Agent A — unused files
   │     ├── commit: Agent B — unused exports
   │     ├── commit: Agent C — unused deps
   │     ├── commit: Agent D — search-uiux + .ref + commented sweeps
   │     └── kiba-code-reviewer → /ultrareview → squash-merge to m5-complete
   │
   └── (after merge) branch: m9-screen-splits
         ├── Agent 1: SafeSwitchDetailScreen
         ├── Agent 2: EditPantryItemScreen
         ├── Agent 3: HomeScreen
         ├── Agent 4: ResultScreen
         ├── Agent 5: EditPetScreen
         ├── Agent 6: PetHubScreen
         ├── Agent 7: CompareScreen
         ├── Agent 8: PantryScreen
         └── kiba-code-reviewer → /ultrareview → squash-merge to m5-complete
```

**Why sequential:**
- File-level contention: dead-code agents may delete files that refactor agents are extracting sub-components from.
- Wasted work: refactor could extract into a file that dead-code was about to delete.
- Ultrareview clarity: each pass produces a narrow, focused diff. Concurrent changes mix two concerns into one review.

**Why two branches not one:** Standing "branch per session" preference. Independent rollback per pass. Each ultrareview has narrow scope.

**Parallelism within a pass is safe** because slices are disjoint by construction (see §3.3 and §4.2).

---

## 3. Dead-Code Pass

### 3.1 Pre-agent setup (done manually before dispatch)

1. `npm i -D knip`
2. Add minimal `knip.json` at repo root:
   ```json
   {
     "entry": ["index.ts", "App.tsx", "supabase/functions/**/index.ts"],
     "project": ["src/**/*.{ts,tsx}", "__tests__/**/*.{ts,tsx}"],
     "ignore": ["supabase/functions/batch-score/scoring/**", "docs/**"]
   }
   ```
   Excludes the `batch-score/scoring/` subfolder (intentional duplicate of `src/services/scoring/` — Deno Edge Functions can't import from `src/`) and `docs/` (handled manually by Agent D).
3. `npx knip --reporter json > .knip-report.json`. Reference artifact — deleted at end of pass.
4. **Commit 1:** knip install + config + baseline report (tracked temporarily).

### 3.2 Agent briefing template

Every dead-code agent operates under these invariants:

- **Slice is disjoint** — no two agents touch the same file *as a file* (see §3.3).
- **Grep-verify every candidate** — knip's static analysis misses string-based dynamic imports, JSX consumed by react-navigation object-literal keys, and JSON-manifest references. Grep the symbol/filename across the full repo before removal.
- **Test cascade** — if deleting `src/foo.ts` orphans `__tests__/foo.test.ts`, delete the test too.
- **Per-agent safety gate, hard:**
  - `npx tsc --noEmit` must be clean.
  - `npm test` must show 79 suites / 1665 tests green.
  - Regression anchors unchanged: Pure Balance = 61 (Dog), Temptations = 0 (Cat Treat).
  - Agent commits only after both pass. If either fails, agent skips that candidate and reports, rather than forcing.
- **Report format** — each agent reports: candidates removed, candidates skipped + reason, final tsc + test status.

### 3.3 Per-agent scope

| Agent | Input slice | Contract |
|---|---|---|
| **A — unused files** | `knip` `files` array | Grep each filename across repo. If zero references, delete file. Delete associated test if orphaned. Special caution: anything under `src/navigation/` (react-navigation may reference via config keys). |
| **B — unused exports** | `knip` `exports` array | Grep each symbol across repo. If zero external callers, remove `export` keyword (keep internal symbol if locally referenced). Special caution: default exports used by `src/navigation/` stack configs. |
| **C — unused deps** | `knip` `dependencies` + `devDependencies` arrays | Remove from `package.json`. Run `npm install` to regenerate lockfile. Special caution: Expo config plugins registered in `app.json` / `app.config.*` — cross-check before removing. |
| **D — non-tool sweep** | Manual targets | Delete `docs/plans/search-uiux/` entirely (10 files — `.tsx`, `.ts`, `.sql`, `.md`, `.ref`). Delete any repo-wide `*.ref` / `*.bak` / `*.orig` / `*~`. Scan `src/` for commented blocks >5 lines that exist for obvious historical reasons (`if (false) { ... }`, entire commented component exports). Borderline cases: skip and report. |

### 3.4 Contention analysis

Slices are disjoint by file-surface:
- A touches whole files (deletions).
- B touches exports *inside* remaining files.
- C touches only `package.json` + `package-lock.json`.
- D touches `docs/`, repo-root backup files, and comments inside `src/` files.

A and B both touch `src/`, but A deletes while B edits. If A deletes a file B had a candidate in, B's candidate no-ops. If B edits a file A is deleting, the edit is discarded on delete. Git merges resolve cleanly because the deletes and edits are at different granularities.

**Dispatch: all four agents in parallel.** The per-agent grep-verify + tsc + test triad is strong enough to absorb cross-agent churn. B's contract additionally includes "after your work lands, if A deleted files referenced by your candidate list, re-grep before finalizing".

### 3.5 Known risks per agent

- **A — navigation consumers.** `src/navigation/*Stack.tsx` may reference screen components via object keys, which knip's AST parser can miss. Agent manually reads `src/navigation/` and confirms each screen-file candidate is actually absent there before deleting.
- **B — react-navigation type augmentation.** Some exports exist only to satisfy typing (e.g., `ParamList` exports). Agent skips exports whose names end in `ParamList` or that are `type`/`interface` declarations under `src/navigation/`.
- **C — Expo plugin deps.** `expo-dev-client`, `expo-font`, `expo-notifications` etc. may be listed as deps but used only by Expo config + native runtime. Agent cross-checks `app.json`/`app.config.*` + searches for symbol import before removing.
- **D — "load-bearing comments".** Commented code sometimes encodes a historical decision. Contract restricts deletions to obvious-dead patterns only. When in doubt, skip and report.

### 3.6 Acceptance criteria (pass merges when all met)

- [ ] `docs/plans/search-uiux/` deleted (10 files).
- [ ] Repo-wide `*.ref` / `*.bak` / `*.orig` / `*~` files absent.
- [ ] `knip` post-sweep report shows material reduction from the pre-sweep baseline, with every skipped candidate documented in the final agent report.
- [ ] `npx tsc --noEmit` clean.
- [ ] 79 suites / 1665 tests green.
- [ ] Pure Balance = 61, Temptations = 0.
- [ ] `kiba-code-reviewer` returns no blockers.
- [ ] `/ultrareview` returns no blockers.

---

## 4. Refactor Pass (File-Splitting)

### 4.1 Pre-agent setup

1. New branch `m9-screen-splits` off updated `m5-complete` (dead-code merged).
2. No new tooling.

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
4. **Tests stay green, unchanged.** Do not modify existing tests. Do not add new tests in this pass.
5. **Per-agent safety gate identical to dead-code pass:** `tsc --noEmit` green + `npm test` green (79 suites / 1665 tests) + regression anchors unchanged, **before commit**.
6. **No cross-screen shared abstractions.** If Agent 1 and Agent 6 see similar card shapes, do NOT extract a shared abstraction in this pass. Session-61 advisor lesson: premature shared abstractions hide distinct bugs. Each screen's extract stays local.
7. **Escape hatch.** If a screen resists clean extraction (every sub-block is deeply coupled to local state/handlers), agent reports "no clean cut available" and skips. A partial split (e.g., 3 of 6 possible extracts) is acceptable.

### 4.5 Known risks

- **Line count is not inherently bad.** A 1,214-line screen may decompose into 6 tight components; it may also be 1,214 lines of unique top-level layout that should stay together. Partial extractions are acceptable per §4.4(7).
- **Coupled state.** React screens often have state that several sub-sections read. Extract callers receive props; don't promote state upward or introduce context.
- **Style sharing.** If a style is referenced from multiple sub-components, it stays in the parent screen's StyleSheet and gets passed via prop, not copied.

### 4.6 Acceptance criteria

- [ ] At least 5 of 8 target screens show a meaningful LOC reduction (partial / skipped acceptable per escape hatch).
- [ ] Every extracted sub-component lives in `src/components/<domain>/`.
- [ ] No screen's public surface changed (imports in sibling screens and navigation types unchanged — grep verifies).
- [ ] 79 suites / 1665 tests green — no test files modified.
- [ ] Pure Balance = 61, Temptations = 0.
- [ ] `kiba-code-reviewer` returns no blockers.
- [ ] `/ultrareview` returns no blockers.

---

## 5. Safety, Rollback, Baseline

### 5.1 Baseline snapshot (captured before each pass)

- `npx tsc --noEmit` output recorded.
- `npm test` output recorded (expect 79 suites / 1665 tests green).
- Regression anchors: Pure Balance = 61, Temptations = 0.
- `git rev-parse HEAD` pinned as rollback target.

### 5.2 Three-layer safety gate per pass

| Layer | When | Authority | Scope |
|---|---|---|---|
| **Per-agent self-verify** | Before each agent commit | Agent itself, hard gate | `tsc --noEmit` clean, full jest suite green, regression anchors unchanged |
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
