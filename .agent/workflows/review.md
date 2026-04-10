---
description: Multi-pass code review of uncommitted/unpushed changes against project rules
---

## Pre-Review: Gather the diff

// turbo
1. Run `cd /Users/stevendiaz/kiba-antigravity && git diff HEAD --stat` to see which files changed and how many lines.

// turbo
2. Run `cd /Users/stevendiaz/kiba-antigravity && git diff HEAD` to get the full diff of all uncommitted changes.

## Pass 1: Project Rules Compliance

3. Read the project rules files:
   - `/Users/stevendiaz/kiba-antigravity/CLAUDE.md` (main project context + non-negotiable rules)
   - `/Users/stevendiaz/kiba-antigravity/__tests__/CLAUDE.md` (test conventions)
   - `/Users/stevendiaz/kiba-antigravity/.cursorrules` (architecture patterns)

4. Review the diff against the project rules. Check specifically:
   - **Self-Check items** from CLAUDE.md (scoring deterministic, UPVM compliance, paywall in permissions.ts only, RLS, bypasses intact)
   - **Non-Negotiable Rules** — any violations?
   - **Schema Traps** — are the correct table/column names used?
   - **Score framing** — is D-094 suitability framing used everywhere?
   - **No `any` types** in core entities?
   - **Do NOT Build** list — are we building something forbidden?

## Pass 2: Code Quality

5. Review the diff for:
   - **TypeScript errors** — missing types, unsafe casts, unused imports
   - **React Native anti-patterns** — inline styles that should be StyleSheet, missing keys, missing error boundaries
   - **Dead code** — unused variables, unreachable branches, commented-out code
   - **Performance** — unnecessary re-renders, missing useMemo/useCallback deps, expensive operations in render
   - **Security** — API keys in client code, missing RLS mentions for new tables
   - **Edge cases** — null checks, empty arrays, division by zero

## Pass 3: Test Coverage

// turbo
6. Run `cd /Users/stevendiaz/kiba-antigravity && npx jest --silent 2>&1 | tail -20` to check if tests pass.

7. Review whether new functionality has adequate test coverage. Flag any complex logic that lacks tests.

## Report

8. Create an artifact at the conversation artifacts directory called `code_review.md` with:
   - **Summary** — one-line verdict (✅ Ship it / ⚠️ Fix first / 🛑 Rethink)
   - **Files Changed** — table from git diff --stat
   - **Rule Violations** — any project rule breaches (with line references)
   - **Issues** — categorized as 🔴 Must Fix / 🟡 Should Fix / 🔵 Nitpick
   - **What's Good** — things done well worth calling out
   - **Suggested Next Steps** — what to do before pushing
