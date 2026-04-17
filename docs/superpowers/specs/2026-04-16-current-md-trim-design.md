# CURRENT.md trim — design

**Date:** 2026-04-16
**Author:** Steven (product) + Claude
**Status:** approved, pending implementation plan

## Problem

`docs/status/CURRENT.md` has grown to 850 lines / 70,567 tokens. It exceeds the Read tool's 25,000-token limit, so `/boot` can no longer single-shot it — every session pays the cost of strategic re-reading. The bloat source is ~500 lines of stacked historical session handoffs (`## Session 46` through `## Session 52`) plus a `## What Works` block (~50 lines) that duplicates ROADMAP.md's `## Current Status` list.

The file's purpose is to orient the next session (`/boot`), track live numbers (`/check-numbers`), and carry forward the previous session's bridge (`/handoff`). Historical session detail is not load-bearing — it is recoverable from `git log` and `gh pr view`.

## Goals

- CURRENT.md stays under the 25,000-token Read limit, indefinitely.
- Zero loss of forward-looking context (current state, numbers, next-step guidance).
- Keep the most-recent handoff + one prior for 2-session continuity.
- `/handoff` enforces the trim pattern so the file cannot re-bloat.

## Non-goals

- Restructuring `## Up Next` or `## Optimization Status` (small, not the bloat source).
- Capping the length of an individual handoff block — session 53's 49-line block was load-bearing detail. Format reform is a separate exercise.
- Migrating any other status/reference docs (DECISIONS.md, ROADMAP.md, spec files).

## Design

### One-time cleanup of existing CURRENT.md

**Delete outright** (recoverable via git):
- `## Session 52` (line 155 – ~line 193)
- `## Session 51` (line 194 – ~line 217)
- `## Session 50` (line 218 – ~line 237)
- `## Session 49` (line 238 – ~line 257)
- `## Session 48` (line 258 – ~line 274)
- `## Session 47` (line 275 – ~line 334)
- `## Session 46` (line 335 – end of file)

**Rewrite `## What Works`** (~50 lines → ~6 lines):

Replace the current bullet-per-shipped-feature list with:

```markdown
## What Works

See `ROADMAP.md ## Current Status` for the full M0–M8 completed list. M9 highlights:

- Behavioral Feeding architecture (migration 034) + Custom Feeding Style
- Matte Premium design system + legacy token migration (cardSurface / hairlineBorder / chipSurface)
- HomeScreen category browse + Top Picks dedicated screen (PR #10)
- Safe Switch premium UI overhaul with outcome-aware completion card
- D-094 score framing extended to new browse components
```

The exact M9 bullets get re-tuned during implementation — the rule is: only items shipped since M9 started, max 5 bullets, ROADMAP owns the full history.

**Keep verbatim:**
- `## Active Milestone`
- `## Last Completed`
- `## What's Broken / Known Issues`
- `## Numbers`
- `## Regression Anchors`
- `## Up Next`
- `## Optimization Status`
- `## Last Session` (the session 53 block — becomes `## Previous Session` after the next `/handoff` runs)

### Rolling 2-session window going forward

CURRENT.md holds at most two session blocks:

- `## Last Session` — most recent handoff.
- `## Previous Session` — the one before it.

Anything older is deleted on each `/handoff`. `## Session NN`-numbered blocks are forbidden — if one shows up, `/handoff` deletes it defensively.

### `/handoff.md` command update

Replace step 1 of `.claude/commands/handoff.md` with an explicit sequence that enforces the rolling window:

```markdown
1. Update docs/status/CURRENT.md:
   a. If a `## Last Session` block already exists, rename its heading to `## Previous Session` (overwriting any existing `## Previous Session` — do not stack).
   b. Delete every section whose heading matches `## Session \d+` (defensive — catches any legacy archive stragglers).
   c. Write the new `## Last Session` block containing:
      - Files changed this session
      - What was accomplished
      - What's not done yet
      - What the next session should start with
      - Any gotchas or context the next session needs
```

Steps 2–8 of `handoff.md` are unchanged.

### Expected end state

- CURRENT.md: 850 lines → ~300 lines. Single-read-able by the Read tool.
- `/boot` no longer needs strategic re-reads of CURRENT.md.
- Every `/handoff` produces the same file shape: canonical sections on top, exactly two session blocks at the bottom.
- Historical session detail lives in: commit messages, PR descriptions (`gh pr view`), `git log` for files changed per session. Not lost — just not in-context by default.

## Verification

After the one-time cleanup commit:
1. `wc -l docs/status/CURRENT.md` should report ~300 lines.
2. `grep -c '^## Session ' docs/status/CURRENT.md` should report `0`.
3. Read tool should be able to read the file in a single call without the 25,000-token error.
4. All canonical sections (Active Milestone, Last Completed, What Works, What's Broken, Numbers, Regression Anchors, Up Next, Optimization Status, Last Session) still present.
5. `## Last Session` block is unchanged from its session-53 content.

After the next `/handoff` runs post-merge:
6. `## Previous Session` header exists and contains the session-53 content.
7. `## Last Session` header exists and contains the new session's content.
8. No `## Session NN` headings exist.

## Risks

- **Losing useful historical context by deleting old sessions.** Mitigated: git has every version. If the next session needs session 48's specifics, `git show HEAD~N:docs/status/CURRENT.md` retrieves it.
- **`/handoff` regression on the rename step.** Mitigated: the defensive `grep '^## Session \d+' ` delete in step 1b catches mistakes even if the rename fails.
- **M9 highlights drift from truth over time.** Mitigated: the 5-bullet cap forces pruning on each handoff when a new highlight displaces an old one. If the bullet list outgrows 5, that's the signal to close M9.

## Out of scope (user-flagged)

- `## Up Next` (~20 lines of carry-over items from sessions 20/21/38/39/41) stays verbatim. Useful for picking next scope. If it ever grows, consider a separate `BACKLOG.md` — not this spec.
- Handoff block length cap — left uncapped. Session 53's 49 lines were load-bearing.
