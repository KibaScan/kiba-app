#!/bin/bash
# Hook: PreToolUse guard — before git push, run typecheck + full test suite.
# Blocks push if either fails. Replaces CI mirror (no CI pipeline exists).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input?.command || ''); }
    catch { console.log(''); }
  });
")

# Only intercept git push commands
if [[ "$COMMAND" != *"git push"* ]]; then
  exit 0
fi

FAILURES=""

# Run typecheck
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?
if [[ $TSC_EXIT -ne 0 ]]; then
  TSC_SUMMARY=$(echo "$TSC_OUTPUT" | tail -5)
  FAILURES="${FAILURES}TypeScript errors:\n${TSC_SUMMARY}\n\n"
fi

# Run full test suite
JEST_OUTPUT=$(npx jest --silent 2>&1)
JEST_EXIT=$?
if [[ $JEST_EXIT -ne 0 ]]; then
  JEST_SUMMARY=$(echo "$JEST_OUTPUT" | tail -10)
  FAILURES="${FAILURES}Test failures:\n${JEST_SUMMARY}"
fi

if [[ -n "$FAILURES" ]]; then
  cat <<JSONEOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "QUALITY GATE: Issues detected before push. Review and confirm.\n\n${FAILURES}"
  }
}
JSONEOF
  exit 0
fi
