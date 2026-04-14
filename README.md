# Kiba — iOS Pet Food Scanner

> Scan a pet food barcode, get an ingredient-level, species-specific
> suitability score personalized to your dog or cat. Built like Yuka,
> focused on pets.

**Live product:** [kibascan.com](https://kibascan.com)
**Status:** Active development — M9 (UI polish & search) in progress

![TypeScript 5.9 strict](https://img.shields.io/badge/typescript-5.9%20strict-3178C6)
![Expo SDK 55](https://img.shields.io/badge/expo-SDK%2055-000020)
![React Native 0.83](https://img.shields.io/badge/react--native-0.83-61DAFB)
![1473 tests](https://img.shields.io/badge/jest-1473%20tests-99425B)
![License UNLICENSED](https://img.shields.io/badge/license-UNLICENSED-red)

---

## Why this repo is interesting

- **Three-layer scoring engine** — Ingredient Quality + Nutritional Profile + Formulation Completeness, with species-specific rules (dog DCM pulse-load advisory, cat carb overload) and per-pet personalization (breed modifiers, health conditions, allergen dual-IQ). Category-adaptive weights (55/30/15 daily food, 65/35/0 supplemental, 100/0/0 treats). See `src/services/scoring/`.
- **Brand-blind by architecture** — the scoring engine has no awareness of brand names, by design. `affiliate_links` is invisible to the engine at the code level, not by policy.
- **129-decision product log** — every non-trivial product or technical choice is numbered, dated, and carries rationale + rejected alternatives in `DECISIONS.md`. Supersession is explicit (e.g., D-013 superseded by D-137 when the DCM advisory was rewritten from a grain-free gate to positional pulse-load detection).
- **Supabase RLS on every user table** — `auth.uid() = user_id` enforced in 38 migrations. External API keys live server-side only, called through Edge Functions.
- **Offline-first pantry** — write operations throw `PantryOfflineError` when the network is down; reads degrade to empty. Cache invalidation on pet-switch uses stale-while-revalidate for sub-second UI.
- **Matte Premium design system** — tokens, card anatomy, typography, and anti-patterns formalized in `.agent/design.md`. Enforced via a token-sweeper subagent.

## Tech stack

Expo SDK 55 / React Native 0.83 / TypeScript 5.9 strict / Zustand 5 /
Supabase (Postgres + Auth + Storage + RLS + pg_cron) / RevenueCat /
Jest via jest-expo.

## Architecture at a glance

```
  Camera scan → UPC lookup → products table
                                 ↓
                       3-layer scoring engine
                    (bypasses → Base → Species → Personalization)
                                 ↓
              ┌──────────────────┼──────────────────┐
              ↓                  ↓                  ↓
         scan_history     pet_product_scores   Kiba Index votes
         (per-user log)       (cache)        (community taste / tummy)

  Pantry → pantry_items + pantry_pet_assignments
             ↓
       pg_cron (auto-deplete every 30m)
             ↓
       Expo Push API (low stock, empty, recall, feeding, appointment)
```

Full walkthrough: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## If you are evaluating this codebase, start here

| Path                                    | Why                                                         |
|-----------------------------------------|-------------------------------------------------------------|
| `src/services/scoring/`                 | The core product. 3 layers + bypasses, pure functions, deterministic. |
| `DECISIONS.md`                          | 129 decisions with rationale, dated, superseded ones marked. |
| `docs/references/scoring-rules.md`      | Authoritative scoring math: AAFCO thresholds, DMB, curves.  |
| `.agent/design.md`                      | Design system. Tokens, card anatomy, anti-patterns.         |
| `supabase/migrations/`                  | 38 migrations. RLS applied per user-data table.             |
| `__tests__/services/scoring/regressionTrace.test.ts` | Regression anchors — Pure Balance = 61, Temptations = 0. |
| `docs/ARCHITECTURE.md`                  | One-page tour of layout, pipeline, and "where to look."     |

## Running locally

This repo is primarily for code review. A full bootable demo requires
Supabase + RevenueCat accounts not included here. What does work cold:

```bash
npm install
npm test            # 1473 passing / 63 suites
npx tsc --noEmit    # clean in src/ + __tests__/
```

If you want the app to build, you'd need to provision a Supabase
project (schema is in `supabase/migrations/`), a RevenueCat account,
and fill in `.env` from `.env.example`.

## Regression anchors

Deterministic scoring is the product. These are checked on every
scoring change:

| Input                                    | Expected score |
|------------------------------------------|----------------|
| Pure Balance (Dog, daily food)           | 61             |
| Temptations (Cat Treat)                  | 0              |
| Pure Balance + cardiac dog (DCM zero-out) | 0              |
| Pure Balance + pancreatitis dog (fat penalty) | 53        |

Test: `__tests__/services/scoring/regressionTrace.test.ts`.

## Data & IP

The product catalog is populated from publicly available retailer
product pages. Only derived aggregate ingredient metadata (canonical
names, severity tags, occurrence counts) is included in this repo —
raw product datasets are gitignored and stay out of source control.
Pipeline code is data-source-agnostic on its face.

## License

[`LICENSE`](LICENSE) — source-available for portfolio review only.
All rights reserved. No fork / redistribute / commercial use.

---

**Author:** Steven Diaz (steven.diaz08@gmail.com)
**Note:** This repository is temporarily public for portfolio review (April 2026). It will be switched back to private after the review window.
