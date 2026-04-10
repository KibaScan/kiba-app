# Kiba Custom Subagents — Testing Guide

Four project-level Claude Code subagents live in this directory. This document is the walkthrough for validating them after a fresh Claude Code session picks them up from disk.

## The Roster

| Agent | Model | Role | Tools |
|---|---|---|---|
| `kiba-scoring-architect` | opus | Design-time validator for scoring changes (no code, design docs only) | Read, Grep, Glob, Bash |
| `kiba-code-reviewer` | opus | Pre-commit reviewer for Kiba rule violations (report-only) | Read, Grep, Glob, Bash |
| `kiba-migration-writer` | sonnet | End-to-end Supabase migrations + RLS + backfills + types | Read, Grep, Glob, Edit, Write, Bash |
| `kiba-token-sweeper` | haiku | Mechanical multi-file design token sweeps and audits | Read, Grep, Glob, Edit, Bash |

Full system prompts in the `.md` file for each agent. Design rationale: `/Users/stevendiaz/.claude/plans/noble-waddling-babbage.md`.

---

## Before You Start

1. **Restart Claude Code.** `.claude/agents/*.md` is scanned at session start — mid-session file creation is NOT hot-reloaded.
2. **Run `/agents`** — confirm all 4 appear in the list with the correct model badges (opus / sonnet / haiku). If any are missing, check the YAML frontmatter for parse errors (`head -10 .claude/agents/*.md`).
3. **Run the tests below in rollout order** — lowest-risk first, highest-leverage last. Each test exercises a specific set of enforcement rules. Record the outcome before moving to the next.
4. **Prefer natural-language invocation** — it tests both auto-discovery AND routing. Only fall back to explicit `Use the <agent-name> subagent` if the natural-language form routes to `general-purpose` or another agent instead.

---

## Rollout Order

1. `kiba-token-sweeper` (mechanical, lowest risk, fastest feedback)
2. `kiba-migration-writer` (structured deliverable, no runtime impact)
3. `kiba-code-reviewer` (reasoning over real code)
4. `kiba-scoring-architect` (highest leverage, hardest to validate)

---

## Test 1 — `kiba-token-sweeper`

Already validated in-session via manual simulation. This test confirms the infrastructure (auto-discovery, system prompt loading, tool restrictions) matches the simulated output.

### Natural language prompt

```
Sweep src/components/ and src/screens/ for hardcoded Matte Premium color
regressions. Look for:

1. Hardcoded #1C1C1E (pre-session-21 cardSurface hex)
2. Hardcoded #242424 (current cardSurface hex inlined directly)
3. Hardcoded rgba(255,255,255,0.12) (ambiguous — could be chipSurface
   or hairlineBorder depending on semantic intent)

Fix the unambiguous cases (1 and 2) by replacing with Colors.cardSurface.
For the ambiguous rgba cases, stop and report without editing — I'll pick
the right token myself. Verify with a re-grep afterward and report edit
counts per file.
```

### Explicit fallback

```
Use the kiba-token-sweeper subagent to run the above.
```

### Success criteria

Expected findings: **5 hits across 4 files.**

| File | Line | Pattern | Expected action |
|---|---|---|---|
| `src/components/browse/SubFilterChipRow.tsx` | 67 | `#1C1C1E` | Auto-fix → `Colors.cardSurface` |
| `src/components/browse/SubFilterChipRow.tsx` | 83 | `#1C1C1E` | Auto-fix → `Colors.cardSurface` |
| `src/components/pet/PetShareCard.tsx` | 185 | `'#242424'` | Auto-fix → `Colors.cardSurface` |
| `src/components/scoring/BenchmarkBar.tsx` | 195 | `rgba(255, 255, 255, 0.12)` | **Stop-and-report** — no edit |
| `src/components/TreatBatteryGauge.tsx` | 162 | `rgba(255,255,255,0.12)` | **Stop-and-report** — no edit |

After the run, `rg "#1C1C1E|'#242424'" src/` should return zero hits.

**Bonus validation:** The sweeper should also flag `pressOverlay` as an architectural orphan (defined in `src/utils/constants.ts:17`, zero references anywhere in `src/`). This tests that the "Flag zero-use tokens" workflow step fires correctly.

### Failure modes

| What you see | What it means | Fix |
|---|---|---|
| Natural-language prompt routes to `general-purpose` | Sweeper's `description` field isn't specific enough for auto-invoke | Add keywords like "token migration" or "hardcoded hex" to the description, restart, re-test |
| Auto-fixes the rgba cases | "Stop on ambiguity" rule not sticking | Strengthen step 6 in the sweeper's "How You Work" section |
| Misses `SubFilterChipRow.tsx` | Grep scope doesn't include nested subdirectories like `browse/` | Check the sweeper's Grep invocation — should use glob `**/*.{ts,tsx}` |
| Tries to edit files in `src/services/scoring/` or `supabase/migrations/` | "What You Refuse to Touch" not firing | Elevate that section earlier in the system prompt |
| Does NOT flag `pressOverlay` as orphan | New step 7 (zero-use token detection) isn't being applied | Verify step 7 exists in `.claude/agents/kiba-token-sweeper.md` |

---

## Test 2 — `kiba-migration-writer`

Concrete schema deliverable. Tests that the agent reads existing migrations, uses the correct number, coordinates TypeScript type alignment, and reasons about cache invalidation.

### Natural language prompt

```
Draft (but don't commit) migration 039 for the pets table — add a
last_weight_source column: text, nullable, with a CHECK constraint
allowing only 'manual' or 'accumulator'. Include the RLS verification
(pets already has RLS), the TypeScript type update in src/types/pet.ts,
and a note on whether pet_product_scores needs invalidation. Produce
your structured output; don't write any files.
```

### Explicit fallback

```
Use the kiba-migration-writer subagent to draft this.
```

### Success criteria

- Uses migration number **039** (highest existing is 038 — confirms the agent read `supabase/migrations/` first)
- Notes that `pets` already has RLS — new columns inherit, no extra policy needed
- TypeScript type update in `src/types/pet.ts` showing the new `last_weight_source?: 'manual' | 'accumulator'` field
- Notes `pet_product_scores` does **NOT** need invalidation (this column is not a scoring input — it's metadata about how weight was set)
- Structured output: SQL code block + TypeScript diff + cache rationale + verification steps
- Does **NOT** actually write `supabase/migrations/039_*.sql` or edit `src/types/pet.ts` — produces the draft inline in its response

### Failure modes

| What you see | What it means | Fix |
|---|---|---|
| Uses a wrong migration number | Didn't read `supabase/migrations/` first | Strengthen "Your Workflow" step 1 — make the `ls` call mandatory |
| Misses the TypeScript type update | "TypeScript Type Alignment" rule isn't sticking | Elevate that section in the system prompt |
| Wipes `pet_product_scores` unnecessarily | Doesn't understand which columns are scoring inputs | Add `last_weight_source` to an explicit "NOT a scoring input" exclusion list |
| Writes the files without being asked | "Never commit or push" is too permissive — it doesn't distinguish draft vs commit | Tighten the "Your Output Format" section to require user confirmation before writing files |
| Missing RLS check | Agent assumes new columns need new policies | Add an explicit note: "new columns on existing tables inherit RLS" |

---

## Test 3 — `kiba-code-reviewer`

Reviews real existing code with known violations. Tests rule coverage, specific file:line citations, and report-only behavior.

### Natural language prompt

```
Review src/components/browse/SubFilterChipRow.tsx. Focus on Matte Premium
design token compliance and any other Kiba rule violations. I'm about to
stage this file — catch anything blocker-worthy before I do.
```

### Explicit fallback

```
Use the kiba-code-reviewer subagent to review that file.
```

### Success criteria

- **Blockers** section flags lines 67 and 83 — hardcoded `#1C1C1E`
- Cites the **"Matte Premium Design System"** check under Additional Kiba-Specific Checks (not one of the 13 core rules — this tests that the additional checks section is being loaded)
- Suggests `Colors.cardSurface` as the specific fix for each blocker
- Structured output: **Blockers / Warnings / Nits / Passed** with grouped findings
- Report-only: the reviewer does **NOT** apply the fix itself
- Notes the file otherwise looks clean (no other blockers) — the "Passed" section should list which checks fired without issue

### Failure modes

| What you see | What it means | Fix |
|---|---|---|
| Misses the `#1C1C1E` regression | "Matte Premium Design System" check in the Additional Checks section isn't firing | Add an explicit grep pattern for `#1C1C1E`, `#242424`, `#333333` to the check description |
| Tries to apply the fix | Reviewer isn't respecting its read-only role | Tighten the "What You Do NOT Do" section — elevate "never edit code" to the top |
| Reports nothing ("Passed") across the board | Grep scope or rule coverage is wrong | Verify the reviewer is actually reading the full file, not just a summary |
| Routes to `/code-review` command instead | Auto-invoke is confusing the reviewer agent with the slash command | Description drift — the reviewer should be "post-edit, pre-commit, single-file focus" |
| Cites a rule that doesn't exist in the system prompt | Model hallucination | Strengthen the rule-citation format: "cite the D-number or CLAUDE.md line, not a generalization" |

---

## Test 4 — `kiba-scoring-architect`

Highest leverage, hardest to validate. Tests reasoning over regression anchors, the critical engine copy trap, citation enforcement, and design-doc-not-code discipline.

### Natural language prompt

```
I want to add a new scoring penalty: -5 points for citric acid appearing
in the top 5 ingredients of raw or freeze-dried cat food. Rationale:
citric acid in acidified raw diets has been associated with mild gastric
irritation in cats. Design it — produce a full design doc with anchor
impact predictions and cite the specific sources I should verify before
implementing.
```

### Explicit fallback

```
Use the kiba-scoring-architect subagent to design this penalty.
```

### Success criteria

- **Produces a design document, NOT code.** No TypeScript, no SQL, no file edits. Structured text only.
- Predicts numerical delta on all 4 regression anchors **with reasoning**:
  - Pure Balance (Dog) = 61 → delta 0 (rule is cat-only)
  - Temptations (Cat treat) = 0 → delta depends on whether rule applies to treats (check scope)
  - Pure Balance + cardiac dog = 0 → delta 0 (same reason as #1)
  - Pure Balance + pancreatitis dog = 53 → delta 0 (same reason)
- Notes **BOTH** engine file locations: `src/services/scoring/` AND `supabase/functions/batch-score/scoring/`
- Instructs the implementer to run `scripts/verify-engine-copy.ts` after the change
- Identifies that `ingredients_dict` needs an entry for citric acid with:
  - `cat_base_severity` set appropriately
  - A real `citation_source`
  - `tldr` / `detail_body` fields populated (D-105)
- **Rejects** the vague "has been associated with" citation — requests a specific peer-reviewed source or AAFCO/FDA reference (Rule #6)
- Drafts a proposed new `D-NNN` entry for `DECISIONS.md` with LOCKED/ACTIVE status
- Notes `pet_product_scores` needs invalidation — scoped to cat products only, ideally
- Produces a verification checklist (regression tests to add/update, snapshot rebuilds, etc.)

### Failure modes

| What you see | What it means | Fix |
|---|---|---|
| Writes actual TypeScript code | "Never write code" rule isn't absolute enough | Elevate "Your output is always a design doc" to the very top of the system prompt, repeat in "What You Do NOT Do" |
| Predicts anchor deltas without showing reasoning | Prompt doesn't enforce "show your work" | Add explicit "show reasoning for each prediction" instruction |
| Forgets to mention the engine copy trap | The CRITICAL section isn't being loaded consistently | Move it even earlier in the system prompt or repeat it in the output format |
| Accepts the vague citation without pushback | Rule #6 enforcement is too soft | Add: "Reject editorial or anecdotal sources. Require AAFCO, FDA CVM, peer-reviewed journal, or veterinary clinical reference." |
| Produces a design for the WRONG four anchors | Anchors drifted in CURRENT.md but the agent has stale values | Ensure the agent reads `docs/status/CURRENT.md` on every invocation (it's already in "Files You Load" — verify) |
| Doesn't propose a new D-entry | "DECISIONS.md impact" step isn't firing | Make it mandatory in the output format |

---

## Iteration Workflow

When a test fails:

1. **Identify the specific failure mode** from the table above — they map to specific lines in the agent's system prompt
2. **Edit the agent's `.md` file** in `.claude/agents/` to address the gap
3. **Commit the fix** with a message like `M9: kiba-<agent> — <what was tightened>`
4. **Restart Claude Code** (remember: no hot-reload)
5. **Re-run the test** that failed
6. **Repeat** until the test passes cleanly

**Meta-rule:** Tune the `description` field first (for auto-invoke accuracy), then the system prompt body (for output quality). If auto-invoke routes wrong, the description is the issue. If auto-invoke routes right but the output is wrong, the body is the issue.

---

## If All Tests Pass

You now have a validated starter roster. Next steps:

1. **Use them in anger** — let the agents auto-invoke during normal work. If they're not being picked up for obvious targets, tune the descriptions.
2. **Track first-week usage** — which agents fire often, which never fire. Agents that never fire after a week are either too narrow or have a description that doesn't match Claude's routing heuristics.
3. **Iterate on the system prompts** based on real-world outputs. The plan file (`/Users/stevendiaz/.claude/plans/noble-waddling-babbage.md`) has the full design rationale and "intentionally not building" notes if you want to expand the roster later.
4. **Consider new agents** only after the starter four have earned their spots. Tempting rejected candidates: `kiba-test-writer`, `kiba-decisions-librarian`, `kiba-compliance-auditor` — all folded into the current four. Revisit the plan file's "Intentionally NOT Building" section if the needs change.

---

## Notes on Agent Discovery

- `.claude/agents/*.md` is read at session start. Files added or modified mid-session do NOT hot-reload.
- YAML frontmatter parse errors cause an agent to silently disappear from `/agents`. Verify with `head -10 .claude/agents/*.md` if any are missing.
- Project-level agents (here, in `.claude/agents/`) take precedence over user-level agents (in `~/.claude/agents/`) with the same name.
- Auto-invoke is based on keyword/pattern matching against the `description` field. Be specific — "use when editing files in `src/services/scoring/`" beats "use for scoring work".
- Agents cannot call each other directly. If one agent determines another should handle the task, it reports back to the parent Claude, which then delegates.
- Each agent invocation gets its own context window. The agent does NOT see the main conversation, so its system prompt must be self-contained.
