#!/bin/bash
# Hook: PreToolUse guard for critical scoring engine files.
# Forces a confirmation prompt before Claude edits protected paths.

INPUT=$(cat)
FILE=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input?.file_path || ''); }
    catch { console.log(''); }
  });
")

PROTECTED=(
  "src/services/scoring/engine.ts"
  "src/services/scoring/pipeline.ts"
  "src/services/scoring/ingredientQuality.ts"
  "src/services/scoring/nutritionalProfile.ts"
  "src/services/scoring/formulationScore.ts"
  "src/services/scoring/speciesRules.ts"
  "src/services/scoring/personalization.ts"
  "docs/references/scoring-rules.md"
)

for pattern in "${PROTECTED[@]}"; do
  if [[ "$FILE" == *"$pattern" ]]; then
    cat <<JSONEOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "Protected: $pattern — scoring engine critical path. Verify regression anchors after changes."
  }
}
JSONEOF
    exit 0
  fi
done
