#!/bin/bash
# Hook: PreToolUse guard — before git commit, if scoring files are staged,
# run regression anchor tests. Block commit if anchors fail.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input?.command || ''); }
    catch { console.log(''); }
  });
")

# Only intercept git commit commands
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

# Check if scoring files are staged
SCORING_STAGED=$(git diff --cached --name-only 2>/dev/null | grep "src/services/scoring/" || true)

if [[ -z "$SCORING_STAGED" ]]; then
  exit 0
fi

# Run regression anchor tests
OUTPUT=$(npx jest --testPathPattern=regressionAnchors --silent 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  cat <<JSONEOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "REGRESSION GATE: Scoring files staged but anchor tests failed. Fix before committing.\n\nStaged scoring files:\n${SCORING_STAGED}\n\nTest output:\n${OUTPUT}"
  }
}
JSONEOF
  exit 0
fi
