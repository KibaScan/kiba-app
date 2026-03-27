Run a full context freshness audit for Kiba. Check each file against the actual codebase and fix any drift:

1. **CLAUDE.md** — verify environment versions match package.json, key deps still correct, regression anchors current
2. **docs/status/CURRENT.md** — run `npx jest` and compare test count/suites, count decisions (`grep -c "^### D-" DECISIONS.md`), count migrations (`ls supabase/migrations/*.sql | wc -l`), verify milestone phase against ROADMAP.md
3. **docs/references/scoring-rules.md** — verify section headers map to actual functions in `src/services/scoring/`, verify weight constants match `src/utils/constants.ts` SCORING_WEIGHTS, check all D-number references are valid
4. **docs/references/scoring-details.md** — verify category-adaptive weights, DCM rules, allergen override, supplemental classification, color systems, regression targets against implementation
5. **docs/references/ui-components.md** — verify directory tree, component inventory, screen list against actual files
6. **docs/references/project-context.md** — verify decisions, schema, health conditions, milestone scope against current state
7. **DECISIONS.md** — find all `Supersedes:` lines, verify each target has a reciprocal SUPERSEDED marker. Report any orphaned supersessions.
8. **Scoped CLAUDE.md files** — verify each is under 30 lines, directory references still valid

For each file, report:
- What changed (before → after)
- What was already accurate
- Anything suspicious needing human review

Do NOT change advice, structure, or tone — only update data to match reality.
