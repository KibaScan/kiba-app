Closing milestone: $ARGUMENTS

1. Run the full test suite — report results (count, suites, failures)
2. Verify regression anchors: `npx jest --testPathPattern=regressionAnchors`
   - Pure Balance (Dog) = 60
   - Temptations (Cat Treat) = 0
3. Run /check-numbers — fix any drift in CURRENT.md
4. Update docs/status/CURRENT.md with current project state:
   - Move milestone to "Last Completed"
   - Update "What Works", "What's Broken", numbers
5. Create docs/status/milestones/$ARGUMENTS.md with:
   - What was accomplished
   - Key decisions made (reference D-numbers)
   - Tech debt introduced
   - Test coverage summary (count, suites)
6. Update CLAUDE.md if anything structural changed (new dirs, new conventions, version bumps)
7. Update docs/errors.md with any new error patterns found this milestone
8. Check if new decisions should be added to CLAUDE.md Non-Negotiable Rules or Schema Traps
9. Run /audit-context for full reference file drift check
10. Update ROADMAP.md — mark milestone complete, note what's next
11. Final commit: `M[N]: milestone complete — [summary]`
