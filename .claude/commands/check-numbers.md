Quick freshness check — compare documented values in docs/status/CURRENT.md to reality:

1. Run `npx jest` → compare test count and suite count to CURRENT.md
2. Count decisions: `grep -cE "^#{2,3} D-[0-9]" DECISIONS.md` → compare to CURRENT.md
3. Count migration files in supabase/migrations/ → compare to CURRENT.md
4. Check ROADMAP.md for current milestone → compare to CURRENT.md
5. Verify Pure Balance regression target = 62
6. Verify Temptations regression target = 9

Report what's drifted. If anything is off, update CURRENT.md with the correct values.
