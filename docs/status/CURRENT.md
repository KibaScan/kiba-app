# Project Status — Last updated 2026-03-26

## Active Milestone
**M6 — Alternatives Engine** (compare flow, safe swaps, weight management, BCS reference, vet report PDF)

## Last Completed
**M5 — Pantry + Appointments + HomeScreen v2** (March 26, 2026, branch `m5-complete`)

## What Works
- Scan-to-score pipeline: barcode → 3-layer scoring (IQ/NP/FC) → result screen
- 19,058 products (v7 reimport, Chewy + Amazon + Walmart)
- Pet profiles, pantry (auto-deplete, budget-aware servings), treat battery
- Appointments (CRUD, recurring, reminders, health records)
- Push notifications (feeding, low stock, empty, recall, appointment, digest)
- HomeScreen v2, Community tab, Top Matches, RevenueCat paywall

## What's Broken / Known Issues
- Pre-existing TS errors: SharePantrySheet.tsx (Product type), feedingNotificationScheduler.ts (unit type)

## Numbers
- **Tests:** 939 passing / 47 suites
- **Decisions:** 128 (D-001 through D-166, non-sequential, all `###` normalized)
- **Migrations:** 20 (001–020)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9

## Up Next (M6)
- Compare flow, Safe Swap recommendations, Weight goal slider (D-160)
- Caloric accumulator (D-161), BCS reference (D-162), Vet Report PDF

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-26
- **Accomplished:** Completed ALL remaining optimization cheatsheet sections (S2, S5, S7, S8, S10, S12, S13) and kiba-context-maintenance-guide deliverables. Key changes:
  - S5: Decision supersession markers (D-061→D-160, D-141→D-143, D-152→D-165)
  - S7: Regression gate + quality gate hooks in .claude/hooks/
  - S8: settings.json deny rules, fixed portable hook path, macOS notification
  - S10: Regression anchor snapshot tests (Pure Balance=62, Temptations=9), contract tests (ScoredResult shape), __tests__/CLAUDE.md testing guide
  - S12: Checkpoint instruction in boot.md
  - S13: Environment section in CLAUDE.md (Expo SDK 55, expo-audio, exact versions)
  - S2: CLAUDE.md audit — trimmed decisions row, verified scoped CLAUDE.md files
  - Maintenance guide: created scoring-details.md (287 lines), audited scoring-rules.md + dataset-field-mapping.md, created /audit-context + /milestone-close commands, deleted handoff doc
- **Files changed:** CLAUDE.md, DECISIONS.md, .claude/settings.json, .claude/commands/boot.md, .claude/commands/handoff.md, .claude/commands/audit-context.md, .claude/commands/milestone-close.md, .claude/hooks/regression-gate.sh, .claude/hooks/quality-gate.sh, __tests__/services/scoring/regressionAnchors.test.ts, __tests__/services/scoring/contracts.test.ts, __tests__/CLAUDE.md, docs/references/scoring-details.md, docs/references/scoring-rules.md, docs/references/dataset-field-mapping.md
- **Not done yet:** M6 features (compare flow, safe swaps, weight goal slider, caloric accumulator, BCS reference, vet report PDF)
- **Next session should:** Start M6 Alternatives Engine — run /boot, review ROADMAP.md for M6 scope
- **No new decisions added. No scoring logic changed. No migrations added.**
