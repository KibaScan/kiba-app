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
- **Tests:** 925 passing / 45 suites
- **Decisions:** 128 (D-001 through D-166, non-sequential, all `###` normalized)
- **Migrations:** 20 (001–020)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9

## Up Next (M6)
- Compare flow, Safe Swap recommendations, Weight goal slider (D-160)
- Caloric accumulator (D-161), BCS reference (D-162), Vet Report PDF

## Optimization Cheatsheet Progress
- **Done:** S1 (structure, scoped CLAUDE.md, modularization), S3 (context budgeting), S4 (CURRENT.md), S6 (slash commands)
- **Partial:** S2 (trimmed, not audited), S8 (.claudeignore done, settings.json not), S10 (errors.md + JSDoc, no golden-file tests), S12 (used checkpoints, not in boot.md)
- **Skipped:** S5 (supersession audit), S7 (hooks), S9 (N/A), S11 (pattern), S13 (env section), S14 (meta-prompts)
- **Not started:** kiba-context-maintenance-guide

## Last Session
- **Date:** 2026-03-26
- **Accomplished:** Agent optimization across S1–S13 (see progress above). Modularized 3 large files (ResultScreen 1917→924, PetHubScreen 1135→671, AddToPantrySheet 1029→746). Created context infrastructure (.claudeignore, CURRENT.md, errors.md, 5 scoped CLAUDE.md, 3 slash commands). Added JSDoc to 8 functions. Normalized DECISIONS.md headings to ### (128 count).
- **Not done yet:** Remaining optimization sections, kiba-context-maintenance-guide, M6 features
- **Next session should:** Finish optimization (S2 audit, S5 supersession, S7 hooks, S10 golden-file tests, S13 env section), then maintenance guide, then M6
