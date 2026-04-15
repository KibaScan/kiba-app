# .agent/workflows/

Reusable prompt templates for recurring Claude Code sessions. Each file is a self-contained instruction set an agent can execute end-to-end without prior conversation context.

## How workflows are invoked

Two modes:

1. **In-session:** reference the file by path (e.g. *"follow `.agent/workflows/boot.md`"*). Claude reads the steps and executes them in the current session.
2. **As a standalone prompt:** copy the body (everything after the frontmatter) into a fresh Opus/Sonnet session pointed at the Kiba repo. Workflows are written to be self-contained — no prior context assumed.

Workflows are **not** slash commands. Slash commands live at `.claude/commands/*.md` and use richer frontmatter (`allowed-tools`, etc.). Workflows are simpler and instructional — the agent reads and follows, nothing intercepts the invocation.

## Available workflows

| File | Purpose |
|---|---|
| `boot.md` | Session startup — load project context, summarize status, establish rollback baseline |
| `handoff.md` | Session teardown — update `CURRENT.md`, run tests, verify regression anchors, check numbers |
| `design.md` | Reference the Matte Premium design system before touching any UI |
| `review.md` | Multi-pass code review of uncommitted/unpushed changes against project rules |
| `ios.md` | Start iOS simulator with Expo cache clear |
| `legacy-token-migration.md` | Finish the `Colors.card` / `Colors.cardBorder` → `cardSurface` / `hairlineBorder` migration across remaining screens (M9) |

## File format

Every workflow is a markdown file with YAML frontmatter and numbered steps.

```yaml
---
description: One-line description of what this workflow does
---
```

The `description` field is the only required frontmatter. Body uses `## Step N:` headers for phases and numbered lists for sequential actions. Keep prose minimal — workflows are procedures, not essays.

### The `// turbo` annotation

Read-only bash commands (git status, grep, typecheck, test runs, file reads) are prefixed with a `// turbo` comment on the line above. This signals that the step is safe to auto-approve — no individual prompt required.

```markdown
// turbo
1. Run `git status --short` to check for uncommitted changes.
```

Mutating operations (file edits, commits, pushes, migrations) are **never** marked `// turbo` — they always require explicit approval.

Use `// turbo-all` (see `ios.md`) when every sub-step in the block is read-only or pre-authorized.

## Self-containment rule

An agent reading the workflow should not need to look up prior conversation context to execute it. In practice:

- **Absolute paths** — always `/Users/stevendiaz/kiba-antigravity/...` or `src/...`, never `the file you just read`.
- **Inline constraints** — rules the agent must follow (do/don't) live in the file, not in memory or an earlier message.
- **Fresh greps over stale inventories** — when a workflow references specific line numbers, it must also tell the agent to re-grep before editing. Line numbers drift; procedures shouldn't.

## Adding a new workflow

1. Create `.agent/workflows/<kebab-case-name>.md`.
2. Add YAML frontmatter with a `description:` field.
3. Use `## Step N:` section headers and numbered actions.
4. Prefix every read-only bash call with `// turbo`.
5. Keep the body self-contained — any context the agent needs goes inline or references an absolute path.
6. Append a row to the **Available workflows** table above.
7. If the workflow is long-lived and you want to document why it exists, put the reasoning in a brief `## Mission` section at the top of the file body — not in this README.

## Workflow vs. subagent vs. slash command

| Kind | Lives at | Use when |
|---|---|---|
| **Workflow** | `.agent/workflows/*.md` | A scripted procedure you'll run repeatedly on the same task type. Multi-step, clear start/finish. (boot, handoff, migration sweep, code review) |
| **Subagent** | `.claude/agents/*.md` (not currently used in this repo) | An autonomous role for parallel or delegated work — research, exploration, multi-agent fan-out |
| **Slash command** | `.claude/commands/*.md` | A user-facing `/command` trigger with optional `allowed-tools` scoping. Use when you want a named invocation surface or need to restrict tools |

Workflows are the simplest of the three and the default for scripted work in this repo. Reach for subagents when you need parallelism; reach for slash commands when you need a named trigger or tool scoping.
