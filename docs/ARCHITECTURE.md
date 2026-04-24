# Architecture

A one-page tour of the Kiba codebase for reviewers who want one level
more detail than the README.

## Repo layout

```
src/
├── screens/              Navigation surfaces (pet hub, scan, pantry, community, me)
├── components/           Reusable UI (cards, sheets, SwipeableRow, design-system atoms)
├── services/             Domain logic
│   ├── scoring/          3-layer scoring engine (see below)
│   ├── pantryService.ts  CRUD + offline-guard pantry operations
│   ├── appointmentService.ts
│   ├── kibaIndexService.ts
│   ├── topMatches.ts     Cache-aware top-match fetch
│   └── affiliateService.ts
├── stores/               Zustand global state (active pet, pantry cache, treat battery)
├── utils/                Pure helpers (constants, pantryHelpers, weightGoal, network)
├── types/                Shared TypeScript types (single source of truth)
├── navigation/           React Navigation stacks + param lists
├── data/                 Static datasets (breeds, conditions, allergens)
├── constants/            App-wide constants not tied to a domain module
├── config/               Feature-flag and integration config (e.g. affiliate)
└── content/              User-facing copy and explainer content

supabase/
├── migrations/           38 migrations (001–038), RLS enforced on every user table
└── functions/            Deno Edge Functions
    ├── batch-score/      Bulk scoring with delta optimization + two-phase execution
    ├── auto-deplete/     pg_cron-triggered pantry depletion + push notifications
    ├── parse-ingredients/ Haiku-backed OCR parse + classification
    ├── recall-check/     FDA recall lookup (D-125: always free, no paywall)
    ├── upc-lookup/       External UPC lookup for the database-miss flow
    └── weekly-digest/    User activity digest (daily / weekly modes)

__tests__/                Jest, 1508 tests / 64 suites, regression anchors tracked
docs/
├── references/           Scoring rules, dataset mapping, design system
├── specs/                Product specs (pantry, nutrition, portion calc, breed mods)
├── plans/                Implementation plans (active + archived)
└── status/               CURRENT.md — latest session state, "up next" queue

.agent/                   Matte Premium design system (tokens, card anatomy, anti-patterns)
DECISIONS.md              130 decisions, D-001 → D-168 with explicit supersessions
ROADMAP.md                Milestone plan, M0–M9 complete/in-progress, M10+ backlog
CLAUDE.md                 Canonical AI-assistant briefing (lean; detail in references/)
```

## Scoring engine (`src/services/scoring/`)

The core product. Pure functions; deterministic; brand-blind by
architectural rule.

Pipeline sequence (early exits called "bypasses"):

```
Scan → Load product + pet + ingredients
     ↓
  Bypasses (return without scoring):
     ├── Recalled product (D-158)
     ├── Variety pack (D-145)
     ├── Vet diet (D-135)
     └── Species mismatch (D-144)
     ↓
  Layer 1 — Base score:
     ├── Ingredient Quality (position-weighted, 55% / 65% / 100%)
     ├── Nutritional Profile (AAFCO + DMB, 30% / 35% / 0%)
     └── Formulation Completeness (statement + preservatives + naming, 15% / 0% / 0%)
     ↓
  Layer 2 — Species rules:
     ├── Dog: DCM pulse-load advisory (D-137), taurine/L-carnitine mitigation
     └── Cat: carb overload, taurine requirement, UGT1A6 warnings
     ↓
  Layer 3 — Personalization:
     ├── Allergen dual-IQ scoring (D-129 override)
     ├── Life stage matching (D-150)
     ├── Breed modifiers (±10 cap; 23 dog + 21 cat breeds)
     └── Health-condition adjustments (12 conditions, P0-P3 severity)
```

Category-adaptive weights: daily food 55/30/15, supplemental 65/35/0,
treats 100/0/0 (IQ / NP / FC).

Regression anchors verified on every scoring change:
- Pure Balance (Dog, daily food) = 61
- Temptations (Cat Treat) = 0
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 53 (fat penalty)

## Data flow: scan → score → persist → notify

```
Camera scan → UPC lookup → product_upcs junction → products table
                                                       ↓
                                            scoring engine (3 layers)
                                                       ↓
                                   ┌───────────────────┼───────────────────┐
                                   ↓                   ↓                   ↓
                              scan_history       pet_product_scores   Kiba Index votes
                            (per-user log)         (cache table)      (community taste/tummy)

Pantry adds → pantry_items + pantry_pet_assignments (per-pet config)
                                   ↓
                          pg_cron (auto-deplete, every 30m)
                                   ↓
                       Expo Push API (low stock / empty transitions)
```

All user-data tables have Supabase RLS policies (`auth.uid() = user_id`)
applied in migrations. External API keys are server-side only — all
outbound calls go through Supabase Edge Functions (D-127).

## Where to look for specific concerns

| Concern                       | File / path                                               |
|-------------------------------|-----------------------------------------------------------|
| Paywall boundary              | `src/utils/permissions.ts` (single source)                |
| Design system                 | `.agent/design.md`                                        |
| Offline writes                | `src/utils/network.ts` + `PantryOfflineError`             |
| Batch scoring                 | `supabase/functions/batch-score/` + `src/services/topMatches.ts` |
| Push notifications            | `src/utils/notifications.ts` + `src/services/*Scheduler.ts` |
| Score framing (D-094)         | `src/utils/constants.ts::getScoreColor()` + `src/components/scoring/ScoreRing.tsx` |
| UPVM compliance (D-095)       | Never say prescribe / treat / cure / prevent / diagnose in UI copy |
| Regression targets            | `__tests__/services/scoring/regressionAnchors.test.ts`    |

## Non-negotiable rules

See `CLAUDE.md` for the full list. Summary:

1. Scoring engine is brand-blind (no brand-specific modifiers)
2. `affiliate_links` column is invisible to the scoring engine
3. Paywall checks only in `src/utils/permissions.ts`
4. Dogs and cats only
5. Every penalty has a `citation_source`
6. RLS on every user-data table
7. No `any` types on core entities
8. Scores always framed as "[X]% match for [Pet Name]"
9. Bypasses (vet diet / species mismatch / variety pack / recalled) always run before scoring
