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
- **Decisions:** 113 entries (D-001 through D-166, gaps in numbering)
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
- **Accomplished:** v7 reimport (19,058 products), HomeScreen v2, Community tab, PetHub restructure, project root cleanup, context optimization setup
- **Not done yet:** M6 features not started
- **Next session should:** Begin M6 scope — start with compare flow or safe swaps
