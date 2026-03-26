# Agent Optimization Handoff — 2026-03-26

> One-time reference for the next session continuing the optimization cheatsheet.
> Delete this file once all sections are complete.

## Source docs
- `docs/optimization/claude-code-agent-optimization-cheatsheet.md` (14 sections)
- `docs/optimization/kiba-context-maintenance-guide.md` (not started)

---

## What was done

### S1: Project Structure & Directory Management
- Created 5 scoped CLAUDE.md files (< 30 lines each):
  - `src/services/scoring/CLAUDE.md` — bypass order, DCM gotchas, regression anchors
  - `src/services/CLAUDE.md` — offline patterns, auth, service relationships
  - `src/components/CLAUDE.md` — UI rules, color systems, subdirectory layout
  - `supabase/CLAUDE.md` — migration rules, Edge Functions, schema traps
  - `src/screens/CLAUDE.md` — navigation stacks, tab bar, paywall rule
- Modularized 3 large files:
  - ResultScreen.tsx: 1917 → 924 (styles, 5 bypass views, removed dead imports)
  - PetHubScreen.tsx: 1135 → 671 (styles, helpers — test import updated)
  - AddToPantrySheet.tsx: 1029 → 746 (styles)
- Added JSDoc to 8 non-obvious functions: `scoreProduct`, `computeScore`, `applySpeciesRules`, `isPremium`, `computeAutoServingSize`, `resolveCalories`, `checkDuplicateUpc`, `getRecentScans`

### S3: Context Window Budgeting
- All scoped CLAUDE.md files under 30 lines
- CURRENT.md at 44 lines (target < 60)
- Root CLAUDE.md trimmed (replaced 30+ path inventory with 2-line pointer)

### S4: CURRENT.md
- Created `docs/status/CURRENT.md` from scratch with full template

### S6: Slash Commands
- `.claude/commands/boot.md` — session startup, reads 4 files, reports understanding
- `.claude/commands/handoff.md` — session end, updates CURRENT.md, decision drift check
- `.claude/commands/check-numbers.md` — lightweight freshness: tests, decisions, migrations, regression anchors

### S8 (partial): .claudeignore
- Created `.claudeignore` excluding: node_modules, .expo, ios, android, docs/archive, data, assets/images, assets/fonts, *.xlsx/docx/zip, package-lock.json, supabase/.temp

### S10 (partial): Debugging Reduction
- Created `docs/errors.md` — 15 bug-fix lookup entries from git history
- JSDoc on 8 functions (see S1 above)

### S5 (partial): Decision Log
- Normalized all headings to `###` format (was mixed #/##/###/bare)
- Fixed count: 128 decisions (D-001–D-166, non-sequential)
- Fixed false heading: "### D-095 Compliance Check" inside D-136 → bold text

---

## What needs finishing

### S2: CLAUDE.md Audit
- Run the audit prompt from the cheatsheet (verify commands work, check stale info)
- Add environment/deps section (Node version, package manager, expo-camera not expo-barcode-scanner, etc.)
- Verify architecture section is under 20 lines

### S5: Decision Supersession Audit
- Scan for decisions that contradict or replace earlier ones
- Add explicit supersession markers (known: D-013→D-137, D-113→D-136, D-061→D-160)
- Verify no unmarked supersessions exist

### S7: Hooks
- Regression gate hook: block commits if Pure Balance drifts from 62 after scoring changes
- CI mirror hook: local pre-push runs same checks as CI (lint, typecheck, test)
- Post-test hook: update "What's Broken" in CURRENT.md with new failures
- Auto-lint on change: pre-commit lint + format

### S8: settings.json Audit
- Review `.claude/settings.json` permissions against cheatsheet's allow/deny pattern
- Ensure Edit blocked for generated/, *.lock, .github/
- Ensure destructive Bash commands blocked (rm -rf, git push)

### S10: Remaining Debugging Reduction
- Snapshot/golden-file tests for scoring (Pure Balance, Temptations, + more products)
- Testing pyramid guide in CLAUDE.md or `tests/CLAUDE.md` (which test type for which change)
- Contract tests at service boundaries (scoring engine input/output shape)

### S12: Rollback & Recovery
- Add checkpoint instructions to `boot.md` ("before starting work, commit or stash dirty state")

### S13: Environment & Dependency Context
- Add detailed environment section to CLAUDE.md:
  - Node 20.x, npm, TypeScript strict
  - Expo SDK 52, React Native (managed)
  - Supabase (Postgres + Auth + Storage + RLS + pg_cron)
  - expo-camera (NOT expo-barcode-scanner), expo-av, RevenueCat
  - Python 3.9 for import scripts (not 3.10+ — no `str | None` syntax)

---

## Sections that need no action

| Section | Why |
|---------|-----|
| S9: Plugin Architecture | Not applicable to Kiba's monolithic Expo app |
| S11: Prompt Chaining | Usage pattern guidance, not a codebase artifact |
| S14: Meta-Prompts | Audit prompts to run on demand — no artifact needed |

---

## After the cheatsheet: kiba-context-maintenance-guide

Entirely not started. Key deliverables:
- `/audit-context` slash command (full drift audit across all reference files)
- Audit `references/scoring-rules.md` against actual scoring implementation
- Audit `references/ui-components.md` against actual component inventory
- Audit `references/project-context.md` against current schema/decisions
- Add drift-prevention steps to existing `/milestone-close` workflow

---

## Pre-existing issues (not introduced by this session)
- TS error in `SharePantrySheet.tsx`: Product type mismatch on scoring calls (lines 113, 172)
- TS error in `feedingNotificationScheduler.ts`: `"servings"` vs `"units"` type overlap (line 87)
