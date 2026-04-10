---
description: Session teardown — updates CURRENT.md, runs tests, verifies regression anchors, checks numbers
---

## Step 1: Capture what changed this session

// turbo
1. Run `cd /Users/stevendiaz/kiba-antigravity && git diff HEAD --stat` to see all changed files.

// turbo
2. Run `cd /Users/stevendiaz/kiba-antigravity && git diff HEAD --name-only` to get the full file list.

## Step 2: Run the test suite

// turbo
3. Run `cd /Users/stevendiaz/kiba-antigravity && npx jest --silent 2>&1 | tail -30` to verify all tests pass. Record the pass/fail count and suite count.

## Step 3: Verify regression anchors

// turbo
4. Run `cd /Users/stevendiaz/kiba-antigravity && npx jest --testPathPattern="scoring" --silent 2>&1 | tail -10` to confirm scoring tests pass.

5. Verify these regression anchors are still intact (check test output or code):
   - **Pure Balance (Dog, daily food) = 62**
   - **Temptations (Cat, treat) = 9**
   - **Pure Balance + cardiac dog = 0** (DCM zero-out)
   - **Pure Balance + pancreatitis dog = 57** (fat >12% DMB penalty)
   If any anchor has shifted, flag it as 🛑 **REGRESSION** and do NOT proceed.

## Step 4: Check for decision drift

6. Read `/Users/stevendiaz/kiba-antigravity/DECISIONS.md` — scan for any decisions that were violated or contradicted by this session's changes. Flag any drift.

## Step 5: Check numbers (/check-numbers)

// turbo
7. Run `cd /Users/stevendiaz/kiba-antigravity && npx jest --silent 2>&1 | grep -E "Test Suites:|Tests:"` to get the current test count.

// turbo
8. Run `cd /Users/stevendiaz/kiba-antigravity && grep -c "^### D-" /Users/stevendiaz/kiba-antigravity/DECISIONS.md` to count decisions.

// turbo
9. Run `cd /Users/stevendiaz/kiba-antigravity && ls /Users/stevendiaz/kiba-antigravity/supabase/migrations/ | wc -l` to count migrations.

10. Compare these numbers against what's documented in `docs/status/CURRENT.md` under "Numbers". If they don't match, update them.

## Step 6: Update CURRENT.md

11. Update `/Users/stevendiaz/kiba-antigravity/docs/status/CURRENT.md` with:
   - **"Last Session" section** — replace entirely with:
     - **Date:** today's date
     - **Accomplished:** bullet list of what was done this session
     - **Files changed:** full list from git diff
     - **Not done yet:** remaining items
     - **Next session should:** recommended starting point
     - **Gotchas for next session:** anything the next session needs to know
     - **Decision/scoring changes:** note if any were made (or "No new decisions. No scoring logic changed.")
   - **"Numbers" section** — update test count, suite count, decisions, migrations if changed
   - **"What's Broken" section** — add/remove known issues based on this session
   - **"What Works" section** — add any newly shipped features

## Step 7: Final report

12. Present a summary to the user:
   - ✅ / ❌ Tests passing (count)
   - ✅ / ❌ Regression anchors intact
   - ✅ / ❌ Decision drift (any violations?)
   - ✅ / ❌ Numbers match
   - 📝 CURRENT.md updated
   - List of files ready to commit
   - Suggested commit message following project convention (e.g. `M6: compare flow with side-by-side scoring`)
