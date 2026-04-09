Before we end this session, do the following:

1. Update docs/status/CURRENT.md under "## Last Session":
   - Files changed this session
   - What was accomplished
   - What's not done yet
   - What the next session should start with
   - Any gotchas or context the next session needs

2. Run the test suite and update the test count in CURRENT.md if it changed.

3. Verify regression anchors: Pure Balance = 60, Temptations = 0.

4. Decision drift check: count D-number entries in DECISIONS.md (grep -c "^### D-"),
   compare to the count in CURRENT.md under "## Numbers". Update CURRENT.md if drifted.

5. If this session added new decisions: note the new D-numbers in the handoff.

6. If this session changed scoring logic: flag that scoring reference files
   (docs/references/scoring-details.md, docs/references/scoring-rules.md)
   may need auditing next session.

7. If this session added migrations or new tables: update migration count
   in CURRENT.md and flag schema gotchas that may need updating.

8. Run /check-numbers. If anything drifted, fix before closing.
