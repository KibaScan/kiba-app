# Claude Code AI Agent Optimization — Comprehensive Cheat Sheet

> **Core Principle:** Context is king. Every minute spent generating context artifacts saves ten minutes of debugging in future sessions. The agent is only as good as the context it starts with.

> **🐾 = Directly applicable to Kiba** (Expo + TypeScript + Supabase + Zustand pet food scanner)

---

## 1. Project Structure & Directory Management

### Scaffold an Agent-Ready Project

```
Prompt:
"Analyze my project structure and reorganize it so an AI coding agent
can navigate it efficiently. Create a clear directory hierarchy, add
README files to each major directory explaining its purpose, and ensure
naming conventions are consistent and descriptive."
```

### Modularize for Safe Agent Edits 🐾

```
Prompt:
"Refactor any files over 300 lines into smaller, single-responsibility
modules. Each module should have a clear interface so an AI agent can
edit one without understanding the entire system."
```

> **Kiba context:** The scoring engine pipeline (IQ → NP → FC → species rules → personalization) is a prime candidate. Each scoring layer should be independently editable without breaking the pipeline bypass order.

### Add Inline Context 🐾

```
Prompt:
"Add JSDoc/docstrings to all exported functions and types, focusing on
*why* not *what* — explain intent, edge cases, and invariants that an
agent wouldn't infer from the code alone."
```

> **Kiba context:** Critical for functions like `distributeRounded()`, DMB conversion, and allergen dual-IQ scoring where the *why* is non-obvious and mistakes are catastrophic.

### Scoped CLAUDE.md Files (Subdirectory Context) 🐾

You can place additional CLAUDE.md files in subdirectories for domain-specific rules. The root file stays lean; subdirectories carry local detail the agent only loads when working in that area.

```
Prompt:
"Create scoped CLAUDE.md files for each major subdirectory that has
domain-specific rules. Each should be under 30 lines and cover only
what's unique to that directory — patterns, gotchas, and relationships
to other modules. Don't repeat what's in the root CLAUDE.md."
```

> **Kiba examples of scoped files:**
> - `src/scoring/CLAUDE.md` — pipeline bypass order, regression target (Pure Balance = 61), "never use is_legume for DCM"
> - `src/db/CLAUDE.md` — migration naming/ordering rules, RLS requirements, schema gotchas table
> - `src/components/CLAUDE.md` — severity display labels, score colors vs severity colors, clinical copy rules

### Recommended Directory Layout

```
my-project/
├── CLAUDE.md                    # Agent briefing (stable, rarely changes)
├── .claudeignore                # Files/dirs agent should skip
├── .claude/
│   ├── settings.json            # Tool permissions, model config
│   ├── commands/                # Reusable slash command templates
│   │   ├── boot.md              # Fresh session startup
│   │   ├── new-endpoint.md      # Add a new API route
│   │   ├── new-migration.md     # Add a DB migration
│   │   └── milestone-close.md   # Run at milestone completion
│   └── hooks/                   # Pre/post commit automation
├── docs/
│   ├── architecture.md          # Current system design
│   ├── errors.md                # Error message → root cause lookup
│   ├── decisions/               # Decision log (numbered)
│   │   ├── 001-chose-postgres.md
│   │   ├── 002-switched-to-zod.md
│   │   └── 003-migrated-to-hono.md
│   └── status/
│       ├── CURRENT.md           # ★ THE most important file
│       └── milestones/
│           ├── v0.1-auth.md
│           ├── v0.2-payments.md
│           └── v0.3-orders.md
├── types/                       # Single source of truth for types
├── src/
│   ├── scoring/
│   │   └── CLAUDE.md            # Scoped: scoring-specific rules
│   ├── db/
│   │   └── CLAUDE.md            # Scoped: migration/schema rules
│   ├── components/
│   │   └── CLAUDE.md            # Scoped: UI conventions
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   └── utils/
└── tests/
```

---

## 2. CLAUDE.md — The Agent Briefing

### What to Include

| Section                        | Purpose                                      | Example                                                              |
|--------------------------------|----------------------------------------------|----------------------------------------------------------------------|
| **Build & test commands**      | Agent verifies its own work                  | `npm run build`, `pytest tests/test_foo.py::test_bar`                |
| **Single-file test cmd**       | Incremental verification                     | `npx jest --testPathPattern=<file>`                                  |
| **Lint / typecheck**           | Catch errors before commit                   | `npm run lint`, `mypy src/`                                          |
| **Architecture (brief)**       | 10–20 line map of what lives where           | "All API routes register in `src/routes/index.ts`"                   |
| **Conventions & patterns**     | Implicit rules a newcomer wouldn't know      | "We use Zustand for state, never React context"                      |
| **Don't-touch list**           | Files the agent must not modify              | "Never edit `generated/`, `vendor/`, or CI configs"                  |
| **How to add common things**   | Step-by-step for frequent changes            | "New endpoint: handler in X → route in Y → types in Z → test in W"  |
| **Error-prone areas**          | Where mistakes have severe consequences      | "Changing `auth.ts` requires the full integration suite"             |
| **Environment & deps** *(NEW)* | Runtime, package manager, key versions       | "Node 20, pnpm, Postgres 16, Expo SDK 52"                           |
| **Regression targets** *(NEW)* | Numbers that must not change without review  | "Pure Balance = 61. Check after ANY scoring change."                 |

### What NOT to Include

| Anti-Pattern                              | Why It Hurts                                                  |
|-------------------------------------------|---------------------------------------------------------------|
| File-by-file descriptions (500+ lines)    | Noise drowns out important bits, wastes context window        |
| Restating what code already says           | Agent can read the code — it needs context code doesn't give |
| Aspirational rules you don't follow       | "We use strict TDD" + no tests = confused agent              |
| General programming advice                | "Write clean code" wastes tokens, tells agent nothing         |
| Stale info (deleted dirs, old commands)   | Actively misleads — worse than no CLAUDE.md                  |
| Over-constraining ("never create files")  | Cripples agent autonomy; be specific about real risks         |

### Bad vs Good CLAUDE.md Entries (Before/After)

```markdown
# ❌ BAD: Vague, aspirational, wastes tokens

## Guidelines
- Write clean, maintainable code
- Follow best practices for React Native
- Make sure everything works properly
- Use TypeScript features effectively
- Keep files organized
```

```markdown
# ✅ GOOD: Specific, actionable, verifiable

## Conventions
- State: Zustand only (no React context for global state)
- Validation: Zod schemas in src/validation/ — never inline
- No `any` types on core entities (scoring, products, pets)
- Paywall checks ONLY in src/utils/permissions.ts
- Scores always framed as "[X]% match for [Pet Name]"
```

```markdown
# ❌ BAD: File-by-file inventory

## Files
- src/scoring/iq.ts — calculates ingredient quality score
- src/scoring/np.ts — calculates nutrient profile score
- src/scoring/fc.ts — calculates food composition score
- src/scoring/dcm.ts — handles DCM risk calculations
- src/scoring/allergen.ts — handles allergen overrides
... (200 more lines)
```

```markdown
# ✅ GOOD: Pattern + gotcha, not inventory

## Scoring Engine
Three layers: Base (IQ+NP+FC) → Species Rules → Personalization
Pipeline bypass order: vet diet → species mismatch → variety pack → supplemental → normal
⚠ DCM uses is_pulse/is_pulse_protein — NEVER is_legume
⚠ Pure Balance regression target = 60. Check after ANY scoring change.
→ Full math: references/scoring-details.md
```

### Example CLAUDE.md

```markdown
# CLAUDE.md

## Build & Run
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`

## Testing
- Full suite: `npm test`
- Single file: `npx jest --testPathPattern=<file>`
- Watch mode: `npx jest --watch`

## Environment
- Node 20, npm, TypeScript strict mode
- Expo SDK 52 (React Native)
- Supabase (Postgres + Auth + RLS)
- RevenueCat (payments)

## Architecture
- src/routes/       → API route handlers, registered in index.ts
- src/services/     → Business logic, one file per domain
- src/scoring/      → Scoring engine (see src/scoring/CLAUDE.md)
- src/middleware/    → Auth, rate limiting, validation
- src/db/           → Schema and migrations (see src/db/CLAUDE.md)
- types/            → Shared TypeScript types (single source of truth)
- references/       → Detailed specs (scoring-details.md, ui-components.md)

## Conventions
- State: Zustand only (no React context for global state)
- DB access: repository pattern — never query directly from routes
- Errors: throw AppError(code, message) — middleware handles response
- No `any` types on core entities
- Paywall checks ONLY in src/utils/permissions.ts

## Do Not Touch
- generated/        → auto-generated, overwritten on build
- .github/          → CI config managed separately
- Migration files   → order-sensitive, NEVER rename

## Adding a New API Endpoint
1. Create handler in src/routes/[domain].ts
2. Register route in src/routes/index.ts
3. Add request/response types in types/[domain].ts
4. Add validation schema in src/validation/[domain].ts
5. Write tests in tests/routes/[domain].test.ts
6. Run: npx jest --testPathPattern=[domain]

## Regression Targets
- Pure Balance = 61. Check after ANY scoring change.
- 558 tests passing, 28 suites. Don't drop below without justification.

## Error-Prone Areas
- Scoring: DCM uses is_pulse/is_pulse_protein — NEVER is_legume
- Scoring: position_reduction_eligible must be checked before discounts
- Wet food scoring catastrophically low = DMB conversion probably missing
- Migration files are order-sensitive — NEVER rename them
```

### Audit Prompt

```
Prompt:
"Read my CLAUDE.md and audit it against these criteria:
(1) Does it include exact build, test, and lint commands including
    single-file test invocation?
(2) Is the architecture section under 20 lines?
(3) Does it list concrete patterns and conventions actually used in
    the codebase — verify by checking the code?
(4) Does it flag genuinely error-prone areas?
(5) Does it describe how to add the 2-3 most common types of changes?
(6) Does it include environment/runtime/key dependency versions?
(7) Are there regression targets that must be checked after changes?
(8) Flag anything stale, vague, aspirational, redundant with the code,
    or over-constraining.
Rewrite it with only what an AI agent actually needs to work safely
and fast."
```

### Keep It Honest Over Time

```
Prompt:
"Diff my CLAUDE.md against the actual project state. Flag any commands
that don't work, directories that don't exist, patterns described that
aren't followed, and conventions that have drifted. Fix CLAUDE.md to
match reality."
```

---

## 3. Context Window Budgeting *(NEW)*

Your context docs only work if they actually fit in the agent's context window together. If CLAUDE.md + CURRENT.md + decision logs exceed the window, the agent loses the tail end — usually the most recent and important context.

### The Budget Rule

| File                   | Target Size     | Why                                         |
|------------------------|-----------------|---------------------------------------------|
| CLAUDE.md (root)       | < 100 lines     | Loaded every session — must be lean          |
| Scoped CLAUDE.md       | < 30 lines each | Only loaded when agent works in that dir     |
| CURRENT.md             | < 60 lines      | Freshness matters more than completeness     |
| Decision log (each)    | < 30 lines      | Boot prompt loads last 3 — total ~90 lines   |
| references/*.md        | Unlimited        | Loaded on-demand, not at boot                |

### Prompt to Enforce

```
Prompt:
"Audit all my context files (CLAUDE.md, CURRENT.md, decision docs,
scoped CLAUDE.md files). Calculate total line count that loads at
session boot via the /boot command. If it exceeds 300 lines, trim:
move detailed specs to references/ files that load on-demand, cut
redundancy, and compress verbose sections. The boot context must
fit comfortably in one pass."
```

> **🐾 Kiba context:** Your references/ directory (scoring-details.md, ui-components.md, scoring-rules.md, project-context.md) already follows this pattern — heavy detail lives on-demand while CLAUDE.md stays lean. This is the right architecture.

---

## 4. CURRENT.md — The Fresh Context File 🐾

This is the file the agent reads first on every fresh session. It answers: **"What is true right now?"**

### Template

```markdown
# Project Status — Last updated YYYY-MM-DD

## What Works
- Auth flow (signup, login, password reset) — fully tested
- PostgreSQL schema v3 is live
- API routes: /users, /sessions, /products are stable

## What's In Progress
- Payment integration (Stripe) — checkout session creation works,
  webhooks NOT yet implemented

## What's Broken / Known Issues
- Rate limiter middleware throws on empty headers (issue #42)
- Test suite for /orders is flaky — retry logic needed

## Recent Changes That Affect Everything
- Migrated from Express to Hono on 2026-03-20. All middleware
  signatures changed. Old Express patterns will NOT work.
- Switched validation from Joi to Zod. Do not use Joi.

## Regression Check
- Pure Balance = 61 ✅ (last verified YYYY-MM-DD)
- Test count: 558 passing, 28 suites ✅

## Next Milestone
- Complete Stripe webhook handling and order fulfillment flow
- See docs/milestones/v0.3-orders.md for full spec

## Last Session
- Modified: src/routes/payments.ts, src/services/stripe.ts
- Accomplished: Stripe checkout session creation
- Not done yet: webhook signature verification
- Next session should: implement webhook handler in src/routes/webhooks.ts
```

### Auto-Generate at Milestones 🐾

```
Prompt:
"We just completed [milestone X]. Do the following:
(1) Run the full test suite and record what passes/fails.
(2) Scan the codebase and update docs/status/CURRENT.md with:
    what works, what's in progress, what's broken, and any
    architectural changes since the last update.
(3) Generate a milestone snapshot at
    docs/status/milestones/[milestone-name].md capturing the
    state of the project, key decisions made, and tech debt introduced.
(4) Update CLAUDE.md if any build commands, conventions, or
    directory structures changed.
(5) Check that all commands in CLAUDE.md actually work — run them.
(6) Verify regression targets (run scoring tests, confirm Pure Balance = 61)."
```

---

## 5. Decision Log — Stop the Agent From Relitigating 🐾

> **🐾 Kiba context:** You already have DECISIONS.md with 147 decisions (D-001 through D-147). This is one of Kiba's strongest agent-readiness features. The format below is for projects that don't have this yet. For Kiba, the key is keeping DECISIONS.md canonical and making sure new decisions get appended.

### Template

```markdown
# Decision 002: Switched from Joi to Zod

## Date: 2026-03-15
## Status: Final

## Context
Joi doesn't infer TypeScript types from schemas.
We needed runtime validation that produces static types.

## Decision
Use Zod for all validation. Migrate existing Joi schemas.

## Consequences
- All request validation uses z.object() pattern
- Types are inferred with z.infer<typeof schema>
- DO NOT install or import Joi
```

### Auto-Generate Decisions

```
Prompt:
"Review the last N commits/changes. If any significant technical
decisions were made (new library, pattern change, architecture shift,
removed dependency), create a decision doc in docs/decisions/ following
the existing format. Number it sequentially."
```

### Supersession Tracking 🐾

When a decision replaces an older one, explicitly mark it:

```markdown
## Status: Final (supersedes D-013)
```

```
Prompt:
"Scan the decision log for any decisions that contradict or replace
earlier ones. Add explicit supersession markers (e.g., 'supersedes D-013')
to the newer decision and add a 'SUPERSEDED by D-137' note to the
older one. An agent should never follow a superseded decision."
```

---

## 6. Slash Commands — Reusable Agent Workflows

Place these in `.claude/commands/` as markdown files.

### boot.md — Fresh Session Startup 🐾

```markdown
Read these files in order before doing anything:
1. CLAUDE.md
2. docs/status/CURRENT.md
3. The most recent file in docs/status/milestones/
4. The last 3 entries in docs/decisions/

Then tell me: what's your understanding of where this project
stands and what we should work on next?
```

> **Kiba-specific boot.md:**
> ```markdown
> Read these files in order before doing anything:
> 1. CLAUDE.md
> 2. DECISIONS.md (scan for any D-numbers referenced in current milestone)
> 3. ROADMAP.md (identify current milestone scope)
> 4. docs/status/CURRENT.md
>
> Then tell me: what milestone are we in, what's done,
> what's next, and what decisions constrain the current work?
> ```

### new-endpoint.md — Add an API Route

```markdown
Create a new API endpoint for $ARGUMENTS:
1. Create handler in src/routes/ following existing patterns
2. Register the route in src/routes/index.ts
3. Add Zod validation schema
4. Add TypeScript types in types/
5. Write tests covering happy path + error cases
6. Run the tests for the new file only
7. Run lint and typecheck
```

### new-scoring-rule.md — Add a Scoring Rule 🐾

```markdown
Add scoring rule for $ARGUMENTS:
1. Check DECISIONS.md for any related decisions — follow them
2. Determine which scoring layer this belongs to (Base / Species / Personalization)
3. Implement in the correct module following pipeline bypass order
4. Ensure position_reduction_eligible is checked if relevant
5. Add citation_source for any new penalty
6. Write tests covering: normal case, edge case, bypass case
7. Run scoring test suite
8. Verify Pure Balance regression target = 60
9. Run full test suite to check for side effects
```

### milestone-close.md — Wrap Up a Milestone 🐾

```markdown
We're closing milestone: $ARGUMENTS

1. Run the full test suite — report results
2. Verify regression target: Pure Balance = 61
3. Update docs/status/CURRENT.md with current project state
4. Create docs/status/milestones/[name].md with:
   - What was accomplished
   - Key decisions made (reference D-numbers)
   - Tech debt introduced
   - Test coverage summary (count, suites)
5. Update CLAUDE.md if anything structural changed
6. Verify all CLAUDE.md commands still work
7. Update docs/errors.md with any new error patterns found
8. Check ROADMAP.md — what's the next milestone?
```

### handoff.md — End-of-Session Context Save 🐾

```markdown
Before we end, generate a handoff note and update
docs/status/CURRENT.md under "## Last Session":
- Files changed this session
- What was accomplished
- What's not done yet
- What the next session should start with
- Any gotchas or context the next session needs
- Current test count and regression target status
```

---

## 7. Hooks — Automated Guardrails

### Post-Test Context Update 🐾

```
Prompt:
"Create a hook that fires after test runs. It should update the
'What's broken' section of docs/status/CURRENT.md with any new
failures and remove entries for tests that now pass. Include the
exact test name and file path for each failure."
```

### Auto-Lint on Change 🐾

```
Prompt:
"Create .claude/hooks that automatically lint and format any file
I change before committing. Include a pre-commit hook that runs
tests on affected files only."
```

### Type-Check After Save 🐾

```
Prompt:
"Add a hook that runs type-checking after every file save. If there
are errors, surface them immediately so we can fix them in the
same session."
```

### Regression Gate Hook 🐾

```
Prompt:
"Create a hook that runs after any change to files in src/scoring/.
It should automatically run the Pure Balance regression test and
block the commit if the score drifts from 62. Surface the actual
vs expected value if it fails."
```

### CI Mirror Hook *(NEW)* 🐾

```
Prompt:
"Review my CI pipeline config (.github/workflows/ or equivalent).
Create a local pre-push hook that runs the same checks CI will run:
lint, typecheck, test suite. The agent should never push code that
will fail CI. Document the hook in CLAUDE.md so the agent knows
it exists."
```

---

## 8. .claudeignore and .claude/settings.json *(NEW)*

### .claudeignore — Tell the Agent What to Skip 🐾

Like .gitignore but for agent context. Prevents the agent from wasting context window on irrelevant files.

```
Prompt:
"Create a .claudeignore file that excludes: node_modules, build
artifacts, generated files, large data files, vendor directories,
lock files, and any directory over 10MB that isn't source code.
The agent should spend context on source and docs, not noise."
```

Example `.claudeignore`:
```
node_modules/
dist/
build/
.expo/
*.lock
coverage/
*.map
android/
ios/
assets/images/
```

### .claude/settings.json — Configure Agent Behavior

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Edit(docs/**)",
      "Bash(npm test*)",
      "Bash(npm run lint*)",
      "Bash(npx tsc*)"
    ],
    "deny": [
      "Edit(.github/**)",
      "Edit(*.lock)",
      "Edit(generated/**)",
      "Bash(rm -rf*)",
      "Bash(git push*)"
    ]
  }
}
```

```
Prompt:
"Create a .claude/settings.json that gives the agent permission
to read everything, edit source and test files, and run test/lint
commands — but blocks editing CI configs, lock files, generated
files, and running destructive bash commands. Review my project
structure to set appropriate boundaries."
```

---

## 9. Plugin / Extensibility Architecture

### Build a Plugin System

```
Prompt:
"Design a plugin architecture for this project where new features
can be added as self-contained directories with a manifest file,
an entry point, and isolated dependencies. An AI agent should be
able to scaffold a new plugin without modifying core code."
```

### Example Plugin Structure

```
plugins/
├── email-notifications/
│   ├── manifest.json       # name, version, dependencies, entry
│   ├── index.ts            # entry point
│   ├── handlers/
│   ├── types.ts
│   └── tests/
└── export-csv/
    ├── manifest.json
    ├── index.ts
    └── tests/
```

---

## 10. Debugging Reduction Techniques

### Error Inventory 🐾

Create `docs/errors.md` — a lookup table that turns repeat debugging into a search:

```markdown
# Common Errors & Fixes

## "Cannot read property 'id' of undefined" in order flow
**Cause:** Stripe webhook payload changed after API version bump
**Fix:** Check stripe.webhooks.constructEvent API version in config.ts

## "ECONNREFUSED 127.0.0.1:5432"
**Cause:** Local Postgres isn't running
**Fix:** `docker compose up db`

## Wet food scoring catastrophically low (< 20)
**Cause:** DMB conversion not applied — dry matter basis missing
**Fix:** Check DMB conversion in scoring pipeline for wet food category

## "ingredients_dict.category" not found
**Cause:** category is on products table, not ingredients_dict
**Fix:** JOIN through products table — see Schema Gotchas in CLAUDE.md
```

```
Prompt:
"Scan git history for the last 20 bugs fixed. For each, add an
entry to docs/errors.md with the error message, root cause, and
fix. This is a lookup table for future agent sessions."
```

### Type Boundary Files 🐾

```
Prompt:
"Create a types/ directory as the single source of truth for all
shared TypeScript types. Deduplicate any types currently scattered
across the codebase. Add to CLAUDE.md: 'Always check types/ before
creating new interfaces. Never duplicate a type that exists here.'"
```

> **Kiba context:** Especially important for scoring types (ScoreResult, PipelineBypass, SeverityEnum), product types, and pet profile types. The agent must not create parallel type definitions that drift.

### Contract Tests at Module Boundaries 🐾

```
Prompt:
"For every exported function in src/services/, ensure there's a
contract test that validates its input/output shape. These tests
should be fast and run automatically when any service file changes."
```

> **Kiba context:** Critical for the scoring engine boundary. If the scoring pipeline's input/output shape changes, everything downstream breaks — UI, persistence, the Kiba Index.

### Snapshot Guardrails 🐾

```
Prompt:
"Add snapshot or golden-file tests for critical outputs (API
responses, generated configs, scoring results) so an AI agent gets
immediate feedback if it accidentally changes behavior."
```

> **Kiba context:** Golden-file tests for scoring are extremely high leverage. Snapshot a set of known products (including Pure Balance) with expected scores. Any scoring change that shifts these snapshots triggers an immediate review.

### Agent-Safe Test Harness 🐾

```
Prompt:
"Set up a test suite that an AI agent can run incrementally. Add
a script that takes a file path and runs only the tests related
to that file. Put this in CLAUDE.md so the agent knows to use it."
```

### Testing Pyramid Guidance *(NEW)* 🐾

Tell the agent *which kind* of test to write, not just how to run them.

Add this to CLAUDE.md or a scoped `tests/CLAUDE.md`:

```markdown
## When to Write Which Test

| Change Type                    | Test Type       | Why                                          |
|--------------------------------|-----------------|----------------------------------------------|
| New utility/helper function    | Unit test       | Pure logic, fast, isolated                   |
| New scoring rule               | Unit + snapshot | Verify logic AND check regression targets    |
| New API endpoint               | Integration     | Needs DB, auth, middleware in the loop        |
| UI component                   | Snapshot        | Catch unintended visual regressions          |
| Bug fix                        | Regression test | Prove the bug is fixed, prevent recurrence   |
| Refactor (no behavior change)  | Run existing    | Don't write new — existing suite is the gate |
```

```
Prompt:
"Add a testing guide to CLAUDE.md or tests/CLAUDE.md that tells the
agent which kind of test to write for each type of change. Include:
unit tests for pure logic, integration tests for routes/DB, snapshot
tests for scoring outputs and UI, and regression tests for bug fixes.
The agent should never guess — the guide should make it obvious."
```

---

## 11. Prompt Chaining — Breaking Large Tasks *(NEW)* 🐾

One mega-prompt that tries to do everything at once overloads the agent and produces sloppy results. Break large tasks into sequential prompts that build on each other.

### Anti-Pattern: The Mega-Prompt

```
❌ BAD:
"Add a complete recall alert system: design the schema, create the
Supabase tables with RLS, build the API endpoints, create the UI
screens, add push notifications, write all the tests, and update
the docs."
```

### Pattern: Sequential Chain

```
✅ GOOD — Chain of 5 focused prompts:

Prompt 1 (Design):
"Design the schema for a recall alert system. Consider: what data
do we store, how does it relate to products and users, what RLS
policies are needed. Output a migration file and update types/.
Do NOT build any endpoints or UI yet."

Prompt 2 (API):
"Using the schema from the last change, create API endpoints for
recall alerts: list, get-by-product, mark-as-seen. Follow existing
route patterns. Write integration tests. Do NOT build UI yet."

Prompt 3 (UI):
"Using the API endpoints from the last change, build the recall
alert UI screens. Follow existing component patterns in
references/ui-components.md. Use SEVERITY_COLORS from constants."

Prompt 4 (Notifications):
"Add push notification triggers for new recall alerts. Follow
the existing notification patterns. Write tests."

Prompt 5 (Verify & Document):
"Run the full test suite. Verify regression targets. Update
CURRENT.md and CLAUDE.md if needed. Generate a handoff note."
```

### Chain Rule of Thumb

| Task Size         | Prompts | Example                                       |
|-------------------|---------|-----------------------------------------------|
| Small (1 file)    | 1       | Fix a bug, add a helper function               |
| Medium (3-5 files)| 2-3     | New endpoint with tests, new component          |
| Large (feature)   | 4-6     | New system (schema + API + UI + tests + docs)   |
| Epic (milestone)  | 6-10    | Full milestone with multiple features           |

---

## 12. Rollback & Recovery *(NEW)* 🐾

When the agent breaks something, you need a fast path back to a known good state.

### Git Checkpoint Strategy

```
Prompt:
"Before starting this task, create a git checkpoint:
git add -A && git commit -m 'checkpoint: before [task description]'
If anything goes wrong, we can revert to this commit."
```

### Add to boot.md

```markdown
Before starting work:
- Run `git status` to check for uncommitted changes
- If the working tree is dirty, stash or commit before proceeding
- After each successful sub-task, commit with a descriptive message
```

### Recovery Prompts

```
Prompt (soft rollback):
"The last change broke something. Run the test suite to identify
what's failing. Try to fix it. If you can't fix it in 2 attempts,
revert to the last passing commit and explain what went wrong."

Prompt (hard rollback):
"Revert all changes since the last commit. Run the test suite to
confirm we're back to a clean state. Then explain what you were
trying to do so we can approach it differently."

Prompt (surgical rollback):
"Revert only the changes to [specific file]. Keep everything else.
Run the tests for that file to confirm it's back to working state."
```

---

## 13. Dependency & Environment Context *(NEW)* 🐾

The agent needs to know what runtime and versions matter. Subtle version bugs are among the hardest to debug.

### Add to CLAUDE.md

```markdown
## Environment
- Node: 20.x (required for native fetch)
- Package manager: npm (not yarn, not pnpm)
- TypeScript: strict mode, no `any` on core entities
- Expo SDK: 52
- React Native: (managed by Expo)
- Supabase: Postgres + Auth + Storage + RLS
- RevenueCat: payments
- expo-camera: barcode scanning (NOT expo-barcode-scanner)
- expo-av: scan tone audio
```

```
Prompt:
"Scan package.json (and any lock files) and add an Environment section
to CLAUDE.md listing: runtime version, package manager, framework
versions, and any dependencies where the specific version matters
(e.g., breaking changes between majors). Flag any dependency that
has a known gotcha — like 'use expo-camera, NOT expo-barcode-scanner'."
```

---

## 14. The Meta-Prompts — Highest Leverage

### Full Project Audit

```
Prompt:
"Audit this entire project from the perspective of an AI coding
agent that needs to make changes safely and efficiently. Identify
the top 5 things that would cause an agent to make mistakes or
waste time, then fix them. Prioritize: missing context files,
unclear module boundaries, lack of incremental test commands,
inconsistent patterns, and undocumented side effects."
```

### Context System Bootstrap

```
Prompt:
"Set up a complete context management system for this project:
1. Create CLAUDE.md with build/test/lint commands, architecture,
   conventions, environment, regression targets, and how-to guides.
2. Create docs/status/CURRENT.md with the current project state.
3. Create scoped CLAUDE.md files for complex subdirectories.
4. Create docs/decisions/ with a template and backfill any major
   decisions visible in the codebase.
5. Create docs/errors.md from recent bug fixes in git history.
6. Create .claude/commands/ with boot.md, handoff.md, and
   milestone-close.md slash commands.
7. Create .claude/settings.json with appropriate permissions.
8. Create .claudeignore to exclude noise from agent context.
9. Verify everything is accurate by running commands and
   checking the code."
```

### Kiba-Specific Full Audit 🐾

```
Prompt:
"Audit Kiba from the perspective of an AI agent joining the project
for the first time. Read CLAUDE.md, DECISIONS.md, and ROADMAP.md.
Then check:
(1) Can the agent find and run single-file tests?
(2) Are scoring pipeline bypass rules documented in the right places?
(3) Are schema gotchas (severity columns, category location, is_pulse
    vs is_legume) surfaced where the agent would encounter them?
(4) Is DECISIONS.md referenced correctly (no superseded decisions
    without markers)?
(5) Are regression targets (Pure Balance = 61, test count) in CURRENT.md?
(6) Are the top 5 common pitfalls from git history in docs/errors.md?
Fix whatever's missing."
```

---

## 15. Impact Ranking — What Reduces Debugging Most

| Rank | Technique                          | Why It Matters                                                    | Kiba |
|------|------------------------------------|-------------------------------------------------------------------|------|
| 1    | CURRENT.md kept fresh              | Prevents working with stale assumptions (#1 source of agent bugs) | 🐾   |
| 2    | Single-file test command           | Agent verifies as it goes instead of batching errors              | 🐾   |
| 3    | Decision log                       | Stops agent from undoing your choices or introducing conflicts    | 🐾   |
| 4    | Regression targets in CLAUDE.md    | Agent knows what numbers must not change                          | 🐾   |
| 5    | Post-session handoff notes         | Prevents next session from repeating or contradicting the last    | 🐾   |
| 6    | Error inventory                    | Turns repeat debugging into a lookup, not investigation           | 🐾   |
| 7    | Prompt chaining (not mega-prompts) | Focused tasks produce better results than overloaded ones         | 🐾   |
| 8    | Scoped CLAUDE.md files             | Domain rules load only when needed, keeps root lean               | 🐾   |
| 9    | Slash commands                     | Standardizes common workflows, reduces improvisation errors       | 🐾   |
| 10   | Git checkpoints before tasks       | Fast rollback when agent breaks something                         | 🐾   |
| 11   | Type boundary files                | Single source of truth prevents type drift and duplication        | 🐾   |
| 12   | Snapshot/golden-file tests         | Catches unintended behavior changes immediately                   | 🐾   |
| 13   | Context window budgeting           | If docs don't fit in context, they don't exist to the agent       | 🐾   |
| 14   | .claudeignore                      | Agent wastes context on noise without this                        | 🐾   |
| 15   | CI mirror hooks                    | Agent never pushes code that fails pipeline                       | 🐾   |
| 16   | Testing pyramid guide              | Agent writes the right *kind* of test, not just any test          | 🐾   |
| 17   | Contract tests                     | Catches boundary breaks immediately, not downstream               | 🐾   |
| 18   | Modular files (<300 lines)         | Agent can edit one module without understanding entire system     | 🐾   |
| 19   | .claude/settings.json              | Prevents agent from touching dangerous files/commands             | 🐾   |
| 20   | Hooks (lint/test/typecheck)        | Automated guardrails catch errors the agent won't notice          | 🐾   |

---

## Quick Reference Card

```
START OF SESSION       →  /boot (slash command)
BEFORE BIG TASK        →  Git checkpoint: git commit -m "checkpoint: before X"
MAKING CHANGES         →  Run single-file tests after each change
LARGE FEATURE          →  Break into 4-6 chained prompts, not one mega-prompt
SCORING CHANGE         →  Verify Pure Balance = 61 after every change  🐾
MADE A DECISION        →  Add to docs/decisions/NNN-name.md
HIT A BUG              →  Add to docs/errors.md after fixing
SOMETHING BROKE        →  Revert to last checkpoint, re-approach differently
END OF SESSION         →  /handoff (slash command)
CLOSING A MILESTONE    →  /milestone-close (slash command)
WEEKLY MAINTENANCE     →  Audit CLAUDE.md against actual project state
```

---

*The guiding principle: CLAUDE.md is not documentation for humans — it's a briefing for an agent about to make changes. Every line should either help it do the right thing or stop it from doing the wrong thing. Everything else is noise eating context window.*
