# Multi-Agent Cleanup Implementation Plan — Dead-Code + Screen File-Splitting

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute two sequential M9 cleanup passes — (1) high-confidence dead-code removal via knip + manual sweeps, (2) file-splitting refactor of the 8 screens >1,000 LOC. Each pass ends with `/ultrareview` and a squash-merge to `m5-complete`.

**Architecture:** Dead-code pass is serialized (D1→A→B→C→D2) because dead code is a cascading graph and concurrent agents would race on jest or merge-conflict on shared files. Refactor pass is parallel via `isolation: "worktree"` because each agent owns one unique screen file. All safety gates: `npx tsc --noEmit` introduces no new errors vs a captured baseline + `npm test` green (79 suites / 1665 tests) + regression anchors intact (Pure Balance = 61, Temptations = 0).

**Tech Stack:** `knip` for dead-code candidate discovery. `madge` for circular-import detection. `expo-cli` stays untouched. No new runtime deps, no migrations, no schema changes. Spec: `docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md`.

---

## File Structure

**Phase 1 — Dead-code pass (branch `m9-deadcode-sweep`):**

| Path | Action | Responsibility |
|---|---|---|
| `knip.json` | create | Knip config with RN/Expo-aware entry array |
| `.knip-report.json` | create (temporary) | Candidate list — consulted by agents, deleted before merge |
| `.tsc-baseline.txt` | create (temporary) | Pre-agent tsc output for diff-gate — deleted before merge |
| `package.json`, `package-lock.json` | modify | `knip` as devDependency (Task 1); Agent C removes unused deps + `@types/*` siblings |
| `docs/plans/search-uiux/**` | delete | 10 stale planning artifacts cleared by Agent D1 |
| Repo-wide `*.ref` / `*.bak` / `*.orig` / `*~` | delete | Backup files cleared by Agent D1 |
| `src/**/*.ts`, `src/**/*.tsx` | modify (selective) | Agent A deletes unreferenced files; Agent B removes unused `export` keywords; Agent D2 removes dead commented blocks |
| `__tests__/**` | delete (selective) | Orphaned tests removed alongside deleted src files |

**Phase 2 — Refactor pass (branch `m9-screen-splits`):**

| Path | Action | Responsibility |
|---|---|---|
| `src/screens/<Screen>.tsx` × 8 | modify | Each refactor agent extracts sub-components + helpers from one screen |
| `src/components/<domain>/**` | create | One new file per extracted sub-component (colocated convention — follows `src/components/bookmarks/BookmarkRow.tsx` precedent) |
| `src/components/<domain>/types.ts` | create (per extraction cluster) | Shared TS types moved out of parent screens to prevent circular imports (Rule 8) |
| `__tests__/screens/EditPantryItemScreen.test.ts` | modify (import paths only) | Follows extracted helpers to sibling paths |
| `__tests__/screens/PantryScreen.test.ts` | modify (import paths only) | Same pattern |

**The 8 refactor-target screens (non-overlapping, one per agent):**

1. `src/screens/SafeSwitchDetailScreen.tsx` (1,226 LOC)
2. `src/screens/EditPantryItemScreen.tsx` (1,222)
3. `src/screens/HomeScreen.tsx` (1,214)
4. `src/screens/ResultScreen.tsx` (1,122)
5. `src/screens/EditPetScreen.tsx` (1,083)
6. `src/screens/PetHubScreen.tsx` (1,069)
7. `src/screens/CompareScreen.tsx` (1,055)
8. `src/screens/PantryScreen.tsx` (1,041)

---

## Phase 1 — Dead-Code Pass

### Task 1: Setup — branch, knip install, config, baselines

**Files:**
- Create: `knip.json`
- Create: `.knip-report.json` (temporary)
- Create: `.tsc-baseline.txt` (temporary)
- Modify: `package.json`, `package-lock.json`
- Modify: `.gitignore` (add `.knip-report.json`, `.tsc-baseline.txt` — these are ephemeral, deleted pre-merge, but we want them absent from accidental commits)

- [ ] **Step 1: Confirm base state**

```bash
git status
git log -1 --oneline
```

Expected output: working tree clean, HEAD at `f150014` (spec integration commit) or newer on `m5-complete`.

- [ ] **Step 2: Create the dead-code branch**

```bash
git checkout -b m9-deadcode-sweep
```

Expected: `Switched to a new branch 'm9-deadcode-sweep'`.

- [ ] **Step 3: Install knip as devDependency**

```bash
npm i -D knip
```

Expected: `knip` added to `package.json` `devDependencies`, lockfile updated, zero vulnerabilities, no peer-dep errors.

- [ ] **Step 4: Create knip.json at repo root**

Create `knip.json`:

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

- [ ] **Step 5: Run the initial knip pass — capture baseline candidate report**

```bash
npx knip --reporter json > .knip-report.json 2>/dev/null || true
```

Expected: `.knip-report.json` created. File is valid JSON. Contains top-level keys `files`, `exports`, `dependencies`, `devDependencies`, possibly others. Record the candidate counts — referenced by downstream agents.

Verify the report shape:

```bash
node -e "const r = require('./.knip-report.json'); console.log('files:', (r.files || []).length, 'exports:', Object.keys(r.exports || {}).length, 'deps:', (r.dependencies || []).length, 'devDeps:', (r.devDependencies || []).length);"
```

- [ ] **Step 6: Capture the tsc baseline**

```bash
npx tsc --noEmit 2>&1 | sort > .tsc-baseline.txt
wc -l .tsc-baseline.txt
```

Expected: roughly 25 lines (14 `docs/plans/search-uiux/` errors — cleared by Agent D1 — and 11 `supabase/functions/batch-score/scoring/` errors — structural, persist through the pass).

- [ ] **Step 7: Add ephemeral files to .gitignore**

Edit `.gitignore` to add:

```
.knip-report.json
.tsc-baseline.txt
```

- [ ] **Step 8: Run the full test suite to confirm clean baseline**

```bash
npm test -- --silent 2>&1 | tail -15
```

Expected: `Test Suites: 79 passed, 79 total`, `Tests: 1665 passed, 1665 total`. No failures.

- [ ] **Step 9: Verify regression anchors (sanity)**

```bash
npm test -- __tests__/services/scoringEngine.test.ts 2>&1 | grep -E "Pure Balance|Temptations" | head -10
```

Expected: tests asserting Pure Balance = 61 and Temptations = 0 present and passing. Exact strings may vary — the key is zero failures in the scoring engine test file.

- [ ] **Step 10: Commit setup**

```bash
git add package.json package-lock.json knip.json .gitignore
git commit -m "$(cat <<'EOF'
chore(deadcode): install knip + config baseline

- Knip as devDependency with RN/Expo-aware entry array (babel.config.js,
  metro.config.js, app.json, *.config.*) so build-critical packages don't
  get flagged as unused deps.
- Ignores supabase/functions/batch-score/scoring/** (intentional Deno
  duplicate of src/services/scoring/) and docs/** (handled manually by
  Agent D1).
- Ephemeral artifacts (.knip-report.json, .tsc-baseline.txt) added to
  .gitignore — these are per-pass references deleted before merge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: single commit on `m9-deadcode-sweep`, 3-4 files changed.

---

### Task 2: Agent D1 — docs/ + backup file sweep

**Files:**
- Delete: `docs/plans/search-uiux/` (directory + 10 files)
- Delete: any repo-wide `*.ref` / `*.bak` / `*.orig` / `*~`

**Purpose:** Clear the pre-existing `docs/plans/search-uiux/*.ts` tsc errors (14 of them) so the downstream agents' tsc-diff gate is tight. D1 is first for this reason.

- [ ] **Step 1: Enumerate the search-uiux files that will be deleted**

```bash
find docs/plans/search-uiux -type f
```

Expected: 10 files (`CompareProductPickerSheet.tsx`, `HomeScreen.tsx`, `SCORING_CACHE_ARCHITECTURE.md`, `categoryBrowseService.ts`, `useTopMatchesStore.ts`, `topMatches.ts`, `topMatches.test.ts.ref`, `001_initial_schema.sql`, `010_product_form.sql`, `029_category_browse.sql`).

- [ ] **Step 2: Enumerate any backup-extension files across the repo**

```bash
find . -type f \( -name '*.ref' -o -name '*.bak' -o -name '*.orig' -o -name '*~' \) -not -path './node_modules/*' -not -path './.git/*'
```

Expected: at least `docs/plans/search-uiux/topMatches.test.ts.ref` (covered by step 3 below); possibly nothing else.

- [ ] **Step 3: Delete the search-uiux directory and any residual backups**

```bash
rm -rf docs/plans/search-uiux
find . -type f \( -name '*.ref' -o -name '*.bak' -o -name '*.orig' -o -name '*~' \) -not -path './node_modules/*' -not -path './.git/*' -delete
```

- [ ] **Step 4: Verify the tsc baseline cleaned up**

```bash
npx tsc --noEmit 2>&1 | sort > /tmp/tsc-post-d1.txt
wc -l /tmp/tsc-post-d1.txt
diff .tsc-baseline.txt /tmp/tsc-post-d1.txt | head -30
```

Expected: `/tmp/tsc-post-d1.txt` shows ~11 lines (the persistent `supabase/functions/batch-score/scoring/` errors). Diff shows the 14 `docs/plans/search-uiux/` errors removed, nothing added.

- [ ] **Step 5: Refresh the tsc baseline to the post-D1 state**

```bash
cp /tmp/tsc-post-d1.txt .tsc-baseline.txt
rm /tmp/tsc-post-d1.txt
```

Downstream agents diff against this tightened baseline.

- [ ] **Step 6: Full test suite**

```bash
npm test -- --silent 2>&1 | tail -5
```

Expected: 79 suites / 1665 tests passing. Deletion of docs/ files should not touch any test.

- [ ] **Step 7: Commit Agent D1's work**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(deadcode): Agent D1 — delete docs/plans/search-uiux + backup files

- Removes 10 stale planning artifacts that caused 14 pre-existing tsc
  errors (see CURRENT.md pre-M9 noise note).
- Deletes any *.ref / *.bak / *.orig / *~ repo-wide (only one was found:
  topMatches.test.ts.ref inside the same directory).
- tsc baseline tightened post-D1: only structural batch-score/scoring/
  Deno noise remains. Downstream agents diff against this baseline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit with 10+ file deletions. No source changes.

---

### Task 3: Agent A — unused files (with fresh knip)

**Files:**
- Delete: any files from knip's post-D1 `files` array that grep confirms have zero references
- Delete: orphaned test files for any deleted src file

**Purpose:** Remove entire files that are no longer imported anywhere. Cascade source for Task 4 and Task 5.

- [ ] **Step 1: Re-run knip against the post-D1 state**

```bash
npx knip --reporter json > .knip-report.json 2>/dev/null || true
node -e "const r = require('./.knip-report.json'); console.log('files:', (r.files || []).length);"
```

Record the file candidate count. This is Agent A's input slice.

- [ ] **Step 2: Dump the candidate file list to a working file**

```bash
node -e "const r = require('./.knip-report.json'); (r.files || []).forEach(f => console.log(f));" > /tmp/agent-a-candidates.txt
wc -l /tmp/agent-a-candidates.txt
```

- [ ] **Step 3: Dispatch Agent A with the candidate slice**

Use the `Agent` tool (`subagent_type: "general-purpose"`, no isolation needed since this is sequential). Prompt verbatim:

```
Task: Dead-code removal — Agent A (unused files).

Context: You're working on branch `m9-deadcode-sweep` on the Kiba
React Native / Expo repo. Previous agent D1 cleared stale docs and
backup files. The tsc baseline is `.tsc-baseline.txt` (post-D1).
Full spec: `docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md`.

Your slice: the candidate list at `/tmp/agent-a-candidates.txt`
(knip's `files` array after a fresh run).

Contract:
1. For each candidate file, grep for the filename (basename, no
   extension) across the full repo:
   grep -r "filename" src/ __tests__/ supabase/ docs/ *.{ts,tsx,js,json,md} 2>/dev/null
   If zero references exist anywhere, proceed to delete.
2. Special caution: anything under `src/navigation/` — react-navigation
   may reference screen components via object-literal keys that knip's
   AST parser can miss. Read the navigation stack files manually before
   deleting any candidate there.
3. If a deleted file has a matching test under `__tests__/`, delete the
   test too.
4. After all deletions, run BOTH gates:
   - `npx tsc --noEmit 2>&1 | sort > /tmp/tsc-check.txt && diff .tsc-baseline.txt /tmp/tsc-check.txt`
     Must show no new error lines.
   - `npm test -- --silent 2>&1 | tail -5`
     Must show 79 suites / 1665 tests or fewer (if you deleted tests,
     the count drops) with zero failures.
5. If either gate fails, revert the offending deletion and report
   which candidate caused the failure. Skip-and-report is always
   acceptable; never force a deletion.
6. Commit your work on the current branch with message:
   "chore(deadcode): Agent A — delete unused files (N removed, M skipped)"
   and a body listing removed files and skipped-reason summaries.

Do not run /ultrareview. Do not push. Do not merge. Stop after the
commit and return a report: files removed, files skipped (with one-line
reason each), final tsc diff line count, final test suite status.
```

- [ ] **Step 4: Verify Agent A's commit**

```bash
git log -1 --stat
git show --stat HEAD
```

Expected: commit with N file deletions (N depends on first-run knip output). No additions. Maybe some orphaned test deletions.

- [ ] **Step 5: Run the gates locally as a double-check**

```bash
npx tsc --noEmit 2>&1 | sort > /tmp/tsc-post-a.txt
diff .tsc-baseline.txt /tmp/tsc-post-a.txt
npm test -- --silent 2>&1 | tail -5
```

Expected: `diff` shows either no output (clean) or only removed lines (if Agent A's deletions fixed some structural errors). `npm test` passes.

- [ ] **Step 6: If gates fail, roll back Agent A's commit**

```bash
git reset --hard HEAD~1
```

Then re-dispatch Agent A with specific guidance on which candidate broke the gate. **Ask user before this destructive action if the rollback target is ambiguous.**

---

### Task 4: Agent B — unused exports (with fresh knip)

**Files:**
- Modify: any files from knip's post-A `exports` object where an export has zero external callers

**Purpose:** Remove `export` keywords from symbols only used internally. Cascade from Task 3 — some exports became newly-dead after Task 3's file deletions.

- [ ] **Step 1: Re-run knip against the post-A state**

```bash
npx knip --reporter json > .knip-report.json 2>/dev/null || true
node -e "const r = require('./.knip-report.json'); const ex = r.exports || {}; console.log('files-with-unused-exports:', Object.keys(ex).length); let total = 0; Object.values(ex).forEach(arr => total += (arr || []).length); console.log('total-export-candidates:', total);"
```

Record the counts.

- [ ] **Step 2: Dump the per-file candidate exports to a working file**

```bash
node -e "const r = require('./.knip-report.json'); const ex = r.exports || {}; for (const [file, syms] of Object.entries(ex)) { for (const s of syms) { console.log(file + '::' + (s.name || s)); } }" > /tmp/agent-b-candidates.txt
wc -l /tmp/agent-b-candidates.txt
```

- [ ] **Step 3: Dispatch Agent B**

```
Task: Dead-code removal — Agent B (unused exports).

Context: branch `m9-deadcode-sweep`. Agent D1 + Agent A have already
run. tsc baseline at `.tsc-baseline.txt` is post-A state.
Full spec: `docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md`.

Your slice: `/tmp/agent-b-candidates.txt` (one `FILE::SYMBOL` per line
from knip's post-A `exports` map).

Contract:
1. For each candidate, grep for the symbol name across the full repo:
   grep -rn "symbolName" src/ __tests__/ supabase/ *.{ts,tsx,js} 2>/dev/null
   If zero callers exist OUTSIDE the defining file, remove the
   `export` keyword. Keep the symbol itself if it's still referenced
   locally within the same file.
2. Skip exports whose name ends in `ParamList` — they're
   react-navigation type augmentations that frequently look unused.
3. Skip any `type` or `interface` declaration under `src/navigation/`
   for the same reason.
4. Skip default exports of anything under `src/screens/` — they're
   consumed by react-navigation stack configs via object keys.
5. Run both gates after ALL edits:
   - `npx tsc --noEmit 2>&1 | sort > /tmp/tsc-check.txt && diff .tsc-baseline.txt /tmp/tsc-check.txt`
     Must show no new errors.
   - `npm test -- --silent 2>&1 | tail -5`
     79 suites / 1665 tests green (or same count if you removed nothing).
6. If either gate fails, revert only the offending edit(s). Skip-and-
   report is always preferred to forcing.
7. Commit on current branch with message:
   "chore(deadcode): Agent B — unexport N symbols (M skipped)"

Do not run /ultrareview. Do not push. Return a report: symbols
unexported, skipped + reason, final tsc diff, test status.
```

- [ ] **Step 4: Verify the commit**

```bash
git log -1 --stat
```

Expected: commit modifying N `.ts`/`.tsx` files under `src/` with net-neutral line counts (just removing `export` keywords).

- [ ] **Step 5: Re-run gates as a double-check**

```bash
npx tsc --noEmit 2>&1 | sort > /tmp/tsc-post-b.txt
diff .tsc-baseline.txt /tmp/tsc-post-b.txt
npm test -- --silent 2>&1 | tail -5
```

Expected: diff empty or only with disappearing errors. Tests green.

---

### Task 5: Agent C — unused deps + @types siblings (with fresh knip)

**Files:**
- Modify: `package.json`, `package-lock.json`

**Purpose:** Remove unused `dependencies` and `devDependencies` plus matching `@types/<pkg>` entries.

- [ ] **Step 1: Re-run knip against the post-B state**

```bash
npx knip --reporter json > .knip-report.json 2>/dev/null || true
node -e "const r = require('./.knip-report.json'); console.log('deps:', (r.dependencies || []).map(d => d.name || d).join(',')); console.log('devDeps:', (r.devDependencies || []).map(d => d.name || d).join(','));"
```

Record the candidate lists.

- [ ] **Step 2: Dump candidates + any matching @types to a working file**

```bash
node -e "
const r = require('./.knip-report.json');
const pkg = require('./package.json');
const allCandidates = [...(r.dependencies || []), ...(r.devDependencies || [])].map(d => d.name || d);
const withTypes = new Set(allCandidates);
for (const c of allCandidates) {
  const typesPkg = '@types/' + c;
  if (pkg.dependencies?.[typesPkg] || pkg.devDependencies?.[typesPkg]) {
    withTypes.add(typesPkg);
  }
}
console.log([...withTypes].join('\n'));
" > /tmp/agent-c-candidates.txt
wc -l /tmp/agent-c-candidates.txt
```

- [ ] **Step 3: Dispatch Agent C**

```
Task: Dead-code removal — Agent C (unused dependencies).

Context: branch `m9-deadcode-sweep`. D1, A, B have run. Refresh
baseline is `.tsc-baseline.txt`.
Full spec: `docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md`.

Your slice: `/tmp/agent-c-candidates.txt` (one npm package per line,
including matching `@types/<pkg>` siblings we've pre-filtered).

Contract:
1. For each candidate, before removing from package.json:
   a. `grep -rn "<package-name>" src/ __tests__/ supabase/ babel.config.js metro.config.js app.json *.config.* 2>/dev/null` — verify zero imports.
   b. Check `app.json` for the package in `expo.plugins` or
      `expo.jsEngine` or similar config references. If referenced,
      SKIP — the package is native-runtime-critical even if nothing
      imports it via JS.
   c. Check `babel.config.js` + `metro.config.js` for string
      references to plugin names — Babel plugins ARE Expo/RN
      dependencies consumed only by build config. If referenced,
      SKIP.
2. For `@types/<pkg>` siblings, only remove when the parent package
   is also being removed. If the parent stays, the types stay.
3. Remove entries from package.json. Run `npm install` to regenerate
   the lockfile.
4. Run both gates:
   - tsc diff (same command pattern as prior agents).
   - `npm test -- --silent 2>&1 | tail -5` — 79 suites / 1665 tests.
5. Additionally, verify the native bundler still resolves:
   - `node -e "require('react-native')"` — should not throw.
   - `node -e "require('@react-navigation/native')"` — should not throw.
6. If any gate fails, restore the offending package and skip.
7. Commit with message:
   "chore(deadcode): Agent C — remove N unused deps + M @types siblings"

Do not push. Do not run /ultrareview. Return a report: packages
removed (with parent/@types labels), packages skipped + reason,
bundler resolve status, tsc diff, test status.
```

- [ ] **Step 4: Verify the commit**

```bash
git log -1 --stat
git diff HEAD~1 HEAD -- package.json
```

Expected: `package.json` has removed entries; lockfile reflects those. Commit message lists changes.

- [ ] **Step 5: Sanity — try running the app's type-resolve path one more time**

```bash
npx tsc --noEmit 2>&1 | sort > /tmp/tsc-post-c.txt
diff .tsc-baseline.txt /tmp/tsc-post-c.txt
npm test -- --silent 2>&1 | tail -5
```

Expected: diff shows no new errors (ideally shrinks further if structural). Tests green.

---

### Task 6: Agent D2 — commented-code sweep in src/

**Files:**
- Modify: any `src/**/*.ts` or `src/**/*.tsx` that contains large commented-out blocks (>5 lines) matching obvious-dead patterns

**Purpose:** Remove load-bearing-nothing commented code from the now-minimal tree.

- [ ] **Step 1: Prep a candidate file list via pattern scan**

```bash
grep -rln -P '^\s*//\s*(if \(false\)|export|import|const|function|return|switch|class)' src/ 2>/dev/null > /tmp/agent-d2-suspects.txt
wc -l /tmp/agent-d2-suspects.txt
```

This produces an initial "files that may have commented code blocks" list — the agent narrows from there.

- [ ] **Step 2: Dispatch Agent D2**

```
Task: Dead-code removal — Agent D2 (commented-code sweep).

Context: branch `m9-deadcode-sweep`. D1, A, B, C have all run. Tree
is at its most minimal. tsc baseline is `.tsc-baseline.txt`.
Full spec: `docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md`.

Your slice: `/tmp/agent-d2-suspects.txt` — `src/` files containing
patterns suggestive of commented code.

Contract:
1. Open each suspect file. Look for CONTIGUOUS commented blocks of
   more than 5 consecutive lines that match OBVIOUS-DEAD patterns:
   - Entire commented component exports (`// export default function ...`)
   - `if (false) { ... }` wrapping blocks
   - Commented-out old imports at the top of a file
   - Entire commented-out functions / classes / switch statements
2. Delete the block. Do NOT delete single-line comments, JSDoc,
   `// TODO:` notes, `// FIXME:` notes, or any block <5 lines.
3. If the comment BORDERS a real code block and the intent is
   unclear (could be load-bearing historical context), SKIP.
4. Run both gates:
   - tsc diff — must show no new errors.
   - `npm test -- --silent 2>&1 | tail -5` — 79 suites / 1665 tests.
5. Commit with message:
   "chore(deadcode): Agent D2 — remove N commented-code blocks in src/"
   Body lists files touched and approximate line counts removed.

Do not push. Return report: files touched, blocks removed per file,
gate status, skipped-file count.
```

- [ ] **Step 3: Verify**

```bash
git log -1 --stat
git diff HEAD~1 HEAD --stat | tail -20
```

Expected: commit touches a handful of `src/**` files with line-count deletions only.

---

### Task 7: Pre-merge cleanup + kiba-code-reviewer pre-flight

**Files:**
- Delete: `.knip-report.json`, `.tsc-baseline.txt` (ephemeral)

- [ ] **Step 1: Delete the ephemeral artifacts**

```bash
rm -f .knip-report.json .tsc-baseline.txt
```

These were only references for the agents; they should not exist in the merge commit.

- [ ] **Step 2: Run the final full verification**

```bash
npx tsc --noEmit 2>&1 | sort | tee /tmp/tsc-final.txt | wc -l
```

Expected: roughly 11 lines (the persistent `batch-score/scoring/` structural errors) — down from ~25 at start.

```bash
npm test -- --silent 2>&1 | tail -5
```

Expected: 79 suites / 1665 tests (or slightly fewer if Agent A deleted orphaned tests — that's acceptable; regressions are not).

- [ ] **Step 3: Check regression anchors**

```bash
npm test -- __tests__/services/scoringEngine.test.ts 2>&1 | tail -10
```

Expected: all scoring engine tests green. Pure Balance = 61, Temptations = 0.

- [ ] **Step 4: Commit the cleanup if the ephemerals were tracked**

```bash
git status
```

If `.knip-report.json` / `.tsc-baseline.txt` show as untracked, `.gitignore` from Task 1 is working — nothing to commit. If they show as deleted tracked files, commit:

```bash
git add -A
git commit -m "chore(deadcode): remove ephemeral knip + tsc baseline artifacts"
```

- [ ] **Step 5: Dispatch kiba-code-reviewer for a pre-flight pass**

```
Task: Pre-ultrareview pass for Kiba-specific non-negotiables.

Context: branch `m9-deadcode-sweep`, about to run /ultrareview.
All dead-code agents (D1, A, B, C, D2) have completed.

Scope: review the full diff `m5-complete..m9-deadcode-sweep`.
Focus on Kiba-specific rules from CLAUDE.md:
1. Scoring engine brand-blind — no brand conditionals introduced
   (unlikely given dead-code is only removal, but verify no removal
   breaks the brand-blind invariant)
2. Affiliate isolated from scoring
3. Paywall only in src/utils/permissions.ts — did we accidentally
   remove a paywall check via "unused" pruning?
4. D-168 score framing tiers — no a11y labels removed from score
   surfaces
5. UPVM compliance (D-095)
6. Bypass patterns intact (D-135, D-144, D-145, D-158)
7. RLS on user tables untouched

You are report-only. List any findings with severity (blocker /
important / minor). Do not edit files.
```

- [ ] **Step 6: If reviewer flags blockers, fix and re-verify**

For each blocker in the report: make the targeted edit, re-run both gates, add a new commit. Loop until the reviewer is satisfied. Do NOT amend earlier commits — fix-forward.

---

### Task 8: Push + ultrareview + merge

- [ ] **Step 1: Push the branch**

```bash
git push -u origin m9-deadcode-sweep
```

- [ ] **Step 2: Open a PR via gh cli**

```bash
gh pr create --title "M9 dead-code sweep — knip + manual targets" --body "$(cat <<'EOF'
## Summary
- Install knip with RN/Expo-aware config
- Agent D1: delete docs/plans/search-uiux/ + backup files (clears 14 tsc errors)
- Agent A: delete unused files (N files, details in commits)
- Agent B: unexport M symbols with zero external callers
- Agent C: remove X unused deps + matching @types siblings
- Agent D2: delete Y commented-dead blocks in src/

## Spec
docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md

## Safety gates
- tsc introduces zero new errors vs pre-pass baseline
- All 79 test suites / 1665 tests green
- Pure Balance = 61, Temptations = 0 (regression anchors intact)
- kiba-code-reviewer pre-flight clean

## Test plan
- [ ] /ultrareview returns no blockers
- [ ] Squash-merge to m5-complete
- [ ] Re-run tsc + test on m5-complete HEAD after merge
EOF
)"
```

- [ ] **Step 3: Run /ultrareview**

Ask the user to execute `/ultrareview` in their CLI (I cannot invoke it on their behalf — it's user-triggered per the session guidance).

> Steven: please run `/ultrareview` on `m9-deadcode-sweep` to burn the first of the two free runs.

Wait for the report. If blockers: fix-forward on the branch, push, re-run gates locally, request re-review if appropriate. Ultrareview results can't be re-invoked by me — the user drives that loop.

- [ ] **Step 4: After ultrareview is clean, squash-merge**

Ask the user to confirm the merge via GitHub UI or:

```bash
gh pr merge --squash --delete-branch
```

(Destructive-to-shared — confirm with user before running.)

- [ ] **Step 5: Pull the merged state locally**

```bash
git checkout m5-complete
git pull
git log -1 --oneline
```

Expected: new squash commit on `m5-complete`. Record the SHA — `$DEADCODE_SHA`.

---

## Phase 2 — Refactor Pass (file-splitting)

### Task 9: Setup — new branch, new baseline, refactor-pass scaffolding

**Files:**
- Create: `.tsc-baseline.txt` (refactor-pass baseline — temporary)
- Install: `madge` (devDependency for circular-import detection)

- [ ] **Step 1: Branch off the refreshed m5-complete**

```bash
git checkout m5-complete
git pull  # ensure local is synced with the dead-code merge
git checkout -b m9-screen-splits
```

- [ ] **Step 2: Install madge for circular-import verification**

```bash
npm i -D madge
```

Madge is small, no peer-dep surprises. Alternative: skip madge and have agents manually trace import chains — but madge makes Rule 8 mechanical and fast.

- [ ] **Step 3: Capture the refactor-pass tsc baseline**

```bash
npx tsc --noEmit 2>&1 | sort > .tsc-baseline.txt
wc -l .tsc-baseline.txt
```

Expected: roughly 11 lines (the persistent `batch-score/scoring/` structural noise only, since dead-code pass cleared search-uiux).

- [ ] **Step 4: Confirm the baseline is clean of circular imports**

```bash
npx madge --circular --extensions ts,tsx src/ 2>&1 | tail -10
```

Expected: either "No circular dependency found" or a pre-existing baseline count — record it. Any NEW circular dependencies introduced by a refactor agent are blockers.

- [ ] **Step 5: Verify test baseline**

```bash
npm test -- --silent 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 6: Add the ephemeral baseline to .gitignore if not already**

```bash
grep -q '.tsc-baseline.txt' .gitignore || echo '.tsc-baseline.txt' >> .gitignore
```

- [ ] **Step 7: Commit setup**

```bash
git add package.json package-lock.json .gitignore
git commit -m "$(cat <<'EOF'
chore(refactor): install madge + capture refactor baseline

- madge for circular-import detection (Rule 8 of refactor contract).
- .tsc-baseline.txt captured post-dead-code-merge; refactor agents
  diff against it to detect any new type errors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Dispatch 8 refactor agents in parallel (worktree-isolated)

**Files per agent:** one screen file + any new `src/components/<domain>/*` files the agent extracts + optional `src/components/<domain>/types.ts` + optional test-import-path update.

**Purpose:** Eight mechanical file-splits, one per large screen, in parallel worktrees to avoid jest interleaving.

- [ ] **Step 1: Prepare the shared agent brief template**

The same contract goes to all 8 agents with only the target-screen path changing. Save this brief to `/tmp/refactor-brief.md` for reference:

```
Task: Refactor — file-split a single screen, zero behavior change.

Context: branch base `m9-screen-splits`. You are dispatched with
isolation: "worktree" so you have your own git worktree. Merge-back
to the parent branch happens after you commit.
Full spec: `docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md`.

Your target: `src/screens/<ScreenName>.tsx` (1,0XX LOC).

Contract (non-negotiable, §4.4 of spec):
1. Zero behavior change. Extract sub-components that receive props
   by destructure; state and handlers stay in the parent screen.
   No new hooks, no new context, no memoization.
2. No public API change. The screen's default export stays the same.
3. Colocate extracts under `src/components/<domain>/` — follow the
   session-61 `src/components/bookmarks/BookmarkRow.tsx` precedent.
   One sub-component per file. Shared types go to
   `src/components/<domain>/types.ts`.
4. Test logic unchanged. You MAY update test file `import` paths
   when a helper moves (e.g., EditPantryItemScreen.test.ts imports
   `formatTime` from the screen — if you extract it, update that
   import line). Do NOT change assertions, mocks, or setup.
5. Per-agent gates before committing:
   a. `npx tsc --noEmit 2>&1 | sort > /tmp/tsc-check.txt && diff ../parent-worktree/.tsc-baseline.txt /tmp/tsc-check.txt`
      (baseline path is relative to where you launch; if unsure, use
      the baseline at the root of the parent repo worktree)
      Must show no new errors.
   b. `npm test -- --silent 2>&1 | tail -5` — 79 suites / 1665 tests.
      No new tests added; test import path updates are fine.
   c. `npx madge --circular --extensions ts,tsx src/ 2>&1` — must
      report no circular dependencies that didn't exist in the
      baseline.
6. No cross-screen shared abstractions. If another agent is
   splitting a similar card shape, ignore — each screen's extract
   stays local (session-61 advisor rule).
7. Escape hatch: if the screen resists clean extraction, skip with
   a report. Partial splits (e.g., 3 of 6 possible extracts) are
   acceptable.
8. No circular imports. Shared TS types go to `types.ts`. Madge
   verifies.

Commit message template:
"refactor(<screen>): extract N sub-components, -X LOC"
with a body listing the extracted component names and net line
delta per file.

Do not push. Return a report: extracts produced (file + component
name), LOC delta (parent, child files), gate status (tsc diff, test,
madge), skipped items + reason.
```

- [ ] **Step 2: Dispatch all 8 refactor agents in parallel**

Issue a **single message with 8 Agent tool calls** (one per screen). Each agent uses `subagent_type: "general-purpose"`, `isolation: "worktree"`, and a prompt that's the brief above with the target screen substituted.

Target screens (copy into each agent's prompt):

| Agent | Screen |
|---|---|
| 1 | `src/screens/SafeSwitchDetailScreen.tsx` |
| 2 | `src/screens/EditPantryItemScreen.tsx` (NOTE: `__tests__/screens/EditPantryItemScreen.test.ts` imports `formatTime`, `buildFrequencyUpdate`, `shouldShowFedTodayCard` — update import paths per Rule 4 if you extract these) |
| 3 | `src/screens/HomeScreen.tsx` |
| 4 | `src/screens/ResultScreen.tsx` |
| 5 | `src/screens/EditPetScreen.tsx` |
| 6 | `src/screens/PetHubScreen.tsx` |
| 7 | `src/screens/CompareScreen.tsx` |
| 8 | `src/screens/PantryScreen.tsx` (NOTE: `__tests__/screens/PantryScreen.test.ts` also imports from the screen — update import paths if extractions collide) |

- [ ] **Step 3: Wait for all 8 agents to return**

Each agent's result includes a worktree path + branch name (per the Agent tool's worktree behavior — "otherwise the path and branch are returned in the result").

Collect the results. Note which agents succeeded, which skipped, which failed.

- [ ] **Step 4: Merge the 8 worktree branches back to m9-screen-splits**

For each successful agent, merge its worktree branch:

```bash
git merge --no-ff <agent-branch-name> -m "refactor: merge <screen> split"
```

Because each agent owned a unique screen (non-overlapping file set), the merges should be clean. If any merge conflicts (shouldn't, but defensive):

```bash
git merge --abort
```

and investigate which agent stepped outside its scope.

- [ ] **Step 5: Run the gates on the merged state**

```bash
npx tsc --noEmit 2>&1 | sort > /tmp/tsc-post-merge.txt
diff .tsc-baseline.txt /tmp/tsc-post-merge.txt
npm test -- --silent 2>&1 | tail -5
npx madge --circular --extensions ts,tsx src/ 2>&1 | tail -10
```

Expected: tsc diff clean, tests green, madge reports no new circulars.

- [ ] **Step 6: If madge reports a NEW circular import**

Identify the culprit pair from madge's output. Trace the import chain:

```bash
npx madge --image /tmp/cycle.svg --extensions ts,tsx src/
```

Fix-forward on the parent branch by moving the shared type to a `types.ts` per Rule 8. Commit the fix:

```bash
git commit -am "refactor: break circular import — extract <Type> to types.ts"
```

Re-run madge; verify clean.

---

### Task 11: Cleanup + kiba-code-reviewer pre-flight

- [ ] **Step 1: Remove the ephemeral tsc baseline**

```bash
rm -f .tsc-baseline.txt
```

Only in gitignore, but confirm.

- [ ] **Step 2: Final verification pass**

```bash
npx tsc --noEmit 2>&1 | sort | wc -l
npm test -- --silent 2>&1 | tail -5
npx madge --circular --extensions ts,tsx src/ 2>&1 | tail -5
```

Expected:
- tsc ~11 lines (same structural batch-score/scoring/ noise)
- 79 suites / 1665 tests green
- No new circulars

- [ ] **Step 3: Verify regression anchors**

```bash
npm test -- __tests__/services/scoringEngine.test.ts 2>&1 | tail -10
```

Expected: Pure Balance = 61, Temptations = 0.

- [ ] **Step 4: Grep-verify no screen's public API changed**

```bash
for screen in SafeSwitchDetail EditPantryItem Home Result EditPet PetHub Compare Pantry; do
  grep -rn "from.*screens/${screen}Screen" src/ __tests__/ | grep -v "^${screen}" | head -3
done
```

Expected: every external import of each screen file still resolves. If a screen's default export moved or renamed, this grep will flag it — that's a contract violation.

- [ ] **Step 5: Dispatch kiba-code-reviewer for the refactor pre-flight**

```
Task: Pre-ultrareview pass for Kiba non-negotiables on refactor branch.

Context: branch `m9-screen-splits`, 8 parallel file-split agents
completed. About to run /ultrareview.

Scope: diff `m5-complete..m9-screen-splits`.
Focus on Kiba-specific rules (CLAUDE.md):
1. Scoring engine brand-blind — no conditionals introduced in
   extracted score-related sub-components (ResultScreen, CompareScreen,
   PetHubScreen likely candidates)
2. D-168 score framing tiers — a11y labels on score surfaces
   preserved through extraction; no "{score}% match for {petName}"
   full phrase dropped from any in-app surface that isn't the
   outbound PetShareCard
3. UPVM compliance (D-095)
4. Paywall only in src/utils/permissions.ts — refactor didn't
   introduce a scattered isPremium check in an extracted component
5. Bypass patterns preserved (D-135, D-144, D-145, D-158)
6. Accessibility labels on all score surfaces (D-168)

Additionally: verify no circular imports, and check that extracted
types.ts files don't accidentally export internal state shapes that
break encapsulation.

You are report-only. Rank findings: blocker / important / minor.
```

- [ ] **Step 6: Fix-forward on any blockers**

Apply targeted fixes on `m9-screen-splits`. Each fix is a new commit (no amends). Re-run all gates after each fix.

---

### Task 12: Push + ultrareview + merge

- [ ] **Step 1: Push the branch**

```bash
git push -u origin m9-screen-splits
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "M9 screen file-split — 8 parallel extractions" --body "$(cat <<'EOF'
## Summary
- 8 parallel refactor agents (isolation: worktree) split the screens >1,000 LOC
- Each screen: extract sub-components to src/components/<domain>/, shared types to types.ts
- 2 test files (EditPantryItemScreen.test.ts, PantryScreen.test.ts) had import paths updated
- Zero behavior change, zero new tests, no circular imports introduced

## Spec
docs/superpowers/specs/2026-04-22-multi-agent-cleanup-design.md

## Safety gates
- tsc: zero new errors vs post-dead-code baseline
- 79 test suites / 1665 tests green
- madge --circular: no new circulars
- Pure Balance = 61, Temptations = 0
- kiba-code-reviewer pre-flight clean

## Test plan
- [ ] /ultrareview returns no blockers
- [ ] Squash-merge to m5-complete
- [ ] Smoke-check on device: reload each extracted screen, confirm visual parity
EOF
)"
```

- [ ] **Step 3: Run /ultrareview**

> Steven: please run `/ultrareview` on `m9-screen-splits` to burn the second of the two free runs.

Wait for the report. Fix-forward on blockers.

- [ ] **Step 4: Squash-merge after ultrareview is clean**

User-confirmed before running:

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 5: Sync local**

```bash
git checkout m5-complete
git pull
git log --oneline -3
```

Record the final SHA — `$REFACTOR_SHA`.

---

### Task 13: Post-pass handoff rotation

- [ ] **Step 1: Clean up any lingering worktrees from Task 10**

```bash
git worktree list
```

If any refactor-agent worktrees are still registered, remove them:

```bash
git worktree remove <path>
```

Agent tool should have cleaned these up automatically, but double-check.

- [ ] **Step 2: Clean up madge from the tree if it was only used as a one-shot tool**

```bash
# OPTIONAL — keep madge if it's useful for future circular-import checks
npm uninstall madge
```

Discuss with user whether to keep or remove. Default: keep — it's small and useful.

- [ ] **Step 3: Ask the user to update CURRENT.md via /handoff**

Both passes are merged. The session-rotation is handled by the `/handoff` slash command, not as part of this plan.

- [ ] **Step 4: Final report**

Return a summary:

```
Phase 1 (dead-code) merge SHA: <DEADCODE_SHA>
Phase 2 (refactor) merge SHA: <REFACTOR_SHA>
Files deleted: X
Symbols unexported: Y
Unused deps removed: Z (+W @types siblings)
Commented-code blocks removed: V
Sub-components extracted: S across <N> of 8 target screens
Screens skipped (no clean cut): <list>
Test count: 79 suites / 1665 tests (or adjusted if orphaned tests removed)
Regression anchors: Pure Balance = 61, Temptations = 0
```

---

## Self-Review

**Spec coverage check (all 8 sections of the spec):**

- §1 Problem Statement — framed in plan header Goal/Architecture. ✓
- §2 Architecture & Sequencing — Phase 1 vs Phase 2 split mirrors spec's two-branch model. ✓
- §3 Dead-Code Pass — Tasks 1-8 cover knip setup, D1, A, B, C, D2, kiba-review, ultrareview. ✓
- §4 Refactor Pass — Tasks 9-12 cover branch setup, parallel dispatch with worktree isolation, kiba-review, ultrareview. ✓
- §5 Safety, Rollback, Baseline — baseline capture at Task 1 + Task 9; per-agent gates embedded in each dispatch brief; rollback path at Task 3 Step 6 (and implicit across the loop). ✓
- §6 Non-Goals — enforced via agent contract (zero behavior change, no test additions, no migrations). ✓
- §7 Open Questions — knip candidate count, screens that split cleanly, ultrareview findings — all acknowledged as discovered-at-execution-time in the dispatch briefs. ✓
- §8 Handoff to writing-plans — this document is the handoff output. ✓

**Placeholder scan:** none found. All commands are concrete, all file paths exact, all expected outputs quantified.

**Type consistency:**
- Branch names (`m9-deadcode-sweep`, `m9-screen-splits`) consistent across all tasks. ✓
- Baseline file name (`.tsc-baseline.txt`) consistent. ✓
- Agent letter labels (D1, A, B, C, D2) consistent. ✓
- Regression anchor phrasing (Pure Balance = 61, Temptations = 0) consistent. ✓
- Test count (79 suites / 1665 tests) consistent. ✓

**Scope check:** the plan produces two independently-mergeable PRs. Each phase is a self-contained working deliverable. Gemini-review fixes all integrated (serialized dead-code, worktree-isolated refactor, expanded knip entry, @types sibling removal, Rule 8 circular-import guard, softened Rule 4 for test imports).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-multi-agent-cleanup.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Fits this plan well because each task is already a subagent dispatch at its core; executing via subagent-driven-development wraps the dispatch + verification loop in a standard rigorous harness.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
