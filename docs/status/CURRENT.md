# Project Status — Last updated 2026-03-26

## Active Milestone
**M6 — Alternatives Engine** (compare flow, safe swaps, weight management, BCS reference, vet report PDF)

## Last Completed
**M5 — Pantry + Appointments + HomeScreen v2** (March 26, 2026, branch `m5-complete`)

## What Works
- Scan-to-score pipeline: barcode → 3-layer scoring (IQ/NP/FC) → result screen
- 19,058 products (v7 reimport, Chewy + Amazon + Walmart)
- Pet profiles: create/edit/delete, breeds, allergens, health conditions
- Pantry: add/edit/share/remove, auto-deplete cron, budget-aware servings (D-165)
- Treat battery: per-pet daily kcal/count tracking with midnight reset
- Appointments: CRUD, recurring, local reminders, health record logging
- Push notifications: feeding, low stock, empty, recall, appointment, weekly/daily digest
- HomeScreen v2: search, browse categories, scan counter, recall siren, appointment card
- Community tab (replaced Search tab): 5 teaser sections
- Top Matches: batch-score cache, category filter, text search
- RevenueCat paywall (5 free scans/week, premium unlimited)

## What's Broken / Known Issues
- None currently tracked

## Numbers
- **Tests:** 925 passing / 45 suites
- **Decisions:** 128 (D-001 through D-166, non-sequential)
- **Migrations:** 20 (001–020)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9

## Up Next (M6)
- Compare flow (side-by-side product comparison)
- Safe Swap recommendations (higher-scoring alternatives)
- Weight goal slider on PortionCard (D-160)
- Caloric accumulator in auto-deplete (D-161)
- BCS reference tool (D-162, educational only)
- Vet Report PDF

## Last Session
- **Branch:** m5-complete
- **Date:** 2026-03-26
- **Accomplished:** Section 1 agent optimization (cheatsheet)
  - Created `.claudeignore`, `docs/status/CURRENT.md`, `docs/errors.md` (15 bug-fix entries)
  - Created 5 scoped CLAUDE.md files (scoring, services, components, supabase, screens)
  - Created 3 slash commands (`/boot`, `/handoff`, `/check-numbers`)
  - Trimmed root CLAUDE.md (replaced 30+ path inventory with pointers to scoped files)
  - Modularized ResultScreen.tsx: 1917 → 924 lines (styles + 5 bypass views extracted)
  - Modularized PetHubScreen.tsx: 1135 → 671 lines (styles + helpers extracted)
  - Extracted AddToPantrySheet.tsx styles: 1029 → 746 lines
  - Added targeted JSDoc to 8 non-obvious exported functions (scoring, permissions, pantry, calorie)
  - Removed 3 dead imports + 1 dead null check in ResultScreen
- **Files changed:** `.claudeignore`, `CLAUDE.md`, `docs/status/CURRENT.md`, `docs/errors.md`, `src/services/scoring/CLAUDE.md`, `src/services/CLAUDE.md`, `src/components/CLAUDE.md`, `supabase/CLAUDE.md`, `src/screens/CLAUDE.md`, `.claude/commands/boot.md`, `.claude/commands/handoff.md`, `.claude/commands/check-numbers.md`, `src/screens/ResultScreen.tsx`, `src/screens/result/ResultScreenStyles.ts` (new), `src/screens/result/ResultBypassViews.tsx` (new), `src/screens/PetHubScreen.tsx`, `src/screens/pethub/PetHubStyles.ts` (new), `src/screens/pethub/petHubHelpers.ts` (new), `__tests__/screens/PetHubScreen.test.ts`, `src/components/pantry/AddToPantrySheet.tsx`, `src/components/pantry/AddToPantryStyles.ts` (new), `src/services/scoring/pipeline.ts`, `src/services/scoring/engine.ts`, `src/services/scoring/speciesRules.ts`, `src/utils/permissions.ts`, `src/utils/pantryHelpers.ts`, `src/utils/calorieEstimation.ts`, `src/services/pantryService.ts`, `src/services/scanHistoryService.ts`
- **Optimization cheatsheet progress:**
  - Done: S1 (project structure), S3 (context window budgeting), S4 (CURRENT.md), S6 (slash commands)
  - Partial: S2 (CLAUDE.md trimmed, not fully audited — missing environment/deps section), S8 (.claudeignore done, settings.json not audited), S10 (errors.md + JSDoc done, no snapshot/golden-file tests or testing pyramid guide), S12 (used git checkpoints, not formalized in boot.md)
  - Skipped: S5 (decision supersession audit), S7 (new hooks — regression gate, CI mirror, post-test), S9 (plugin architecture — N/A), S11 (prompt chaining — usage pattern, no artifact), S13 (environment section in CLAUDE.md), S14 (meta-prompts — audit prompts, no artifact)
  - Not started: kiba-context-maintenance-guide (reference file drift audits, /audit-context command)
- **Not done yet:** Remaining optimization sections above. M6 features not started.
- **Next session should:** Finish remaining optimization (S2 audit, S5 supersession, S7 hooks, S10 golden-file tests, S13 environment section), then kiba-context-maintenance-guide, then M6 scope
- **Gotchas:** Pre-existing TS errors in SharePantrySheet.tsx (Product type mismatch) and feedingNotificationScheduler.ts (unit type overlap) — not introduced this session, existed before
