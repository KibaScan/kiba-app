---
description: Session startup — loads project context, summarizes status, establishes rollback baseline
---

## Step 1: Load project context (read in order)

1. Read the following files in this exact order to build full context:
   - `/Users/stevendiaz/kiba-antigravity/CLAUDE.md` — project overview, non-negotiable rules, schema traps, spec file index
   - `/Users/stevendiaz/kiba-antigravity/DECISIONS.md` — all decisions (D-001 through D-166). Scan the header for supersession pairs and recent additions.
   - `/Users/stevendiaz/kiba-antigravity/ROADMAP.md` — milestone plan, current scope
   - `/Users/stevendiaz/kiba-antigravity/docs/status/CURRENT.md` — what works, what's broken, last session notes, gotchas, numbers

## Step 2: Establish rollback baseline

// turbo
2. Run `cd /Users/stevendiaz/kiba-antigravity && git status --short` to check for uncommitted changes.

// turbo
3. Run `cd /Users/stevendiaz/kiba-antigravity && git log --oneline -5` to see the last 5 commits.

// turbo
4. Run `cd /Users/stevendiaz/kiba-antigravity && git stash list` to check for any stashed changes.

## Step 3: Summarize and prompt

5. Present a structured summary to the user:
   - **Active Milestone** — name, scope, what's in/out
   - **What's Done** — completed items from CURRENT.md
   - **What's Broken** — known issues, pre-existing TS errors
   - **Relevant Constraints** — non-negotiable rules, recent decisions that constrain upcoming work
   - **Gotchas** — anything from CURRENT.md "Gotchas for next session" that could bite us
   - **Next Work Items** — from CURRENT.md "Not done yet" + "Next session should"
   - **Git State** — clean/dirty, uncommitted files, last commit
   - Then ask: **"What do you want to work on?"**
