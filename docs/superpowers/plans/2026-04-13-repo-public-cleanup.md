# Repo Public Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the Kiba repo to be temporarily public (~1 week) for employer portfolio review: delete scratch/provenance files, add README + LICENSE + ARCHITECTURE.md, switch GitHub default branch to `m5-complete`, and preserve everything removed in a gitignored local `_scratch/` directory.

**Architecture:** Pure file-hygiene + content work on a dedicated feature branch (`m9-repo-public-cleanup`, already created off `m5-complete`). No `src/`, `supabase/`, or `__tests__/` touched. Each logical chunk gets its own commit for reviewability.

**Tech Stack:** git (+ gh CLI for GitHub metadata), bash, markdown. The Jest suite must continue to pass at 1473 / 63 suites as a non-regression check.

---

## Spec Reference

Design spec: `docs/superpowers/specs/2026-04-13-repo-public-cleanup-design.md` (branch `m9-repo-public-cleanup`, commit `49e045f`).

## File Structure

**Created:**
- `_scratch/` (directory, gitignored, never tracked) — local backup of every removed file
- `LICENSE` — source-available notice
- `README.md` — portfolio-oriented landing doc
- `docs/ARCHITECTURE.md` — one-page architecture tour

**Modified:**
- `.gitignore` — append `_scratch/` entry
- `docs/references/dataset-field-mapping.md` — soften retailer names in header (lines 6, 10-12)
- `CLAUDE.md` — drop retailer names from one line in Schema Traps
- `package.json` — add `description`, `author`, `license`, `repository` fields

**Deleted (from git + disk, after backup to `_scratch/`):**
- 20 root-level scratch markdowns (enumerated in Task 2)
- 2 root-level PNGs (enumerated in Task 3)
- `.cursorrules`
- `scripts/import/V7_REIMPORT_INSTRUCTIONS.md`

**Disk-only:**
- `.DS_Store` at repo root (never tracked; just delete from disk before pushing)

---

## Regression Anchors

Before starting AND before PR:
- `npm test` → 1473 passing / 63 suites
- `npx tsc --noEmit` → clean in `src/` + `__tests__/` (79 pre-existing errors in `docs/plans/search-uiux/*` + Deno scoring imports are expected baseline)

These validate nothing in `src/` was touched accidentally.

---

## Task 1 — `_scratch/` backup directory + `.gitignore` entry

**Why first:** everything else depends on `_scratch/` existing. Gitignore must be updated in the SAME commit so no `_scratch/` contents ever get tracked.

**Files:**
- Create: `_scratch/.keep` (empty file so git tracks the directory intent? no — actually we want it completely untracked; just create directory on disk)
- Modify: `.gitignore` (append one line)

- [ ] **Step 1.1: Verify current branch is `m9-repo-public-cleanup`**

Run: `git branch --show-current`
Expected: `m9-repo-public-cleanup`

If not, run: `git checkout m9-repo-public-cleanup` (branch was created in the brainstorming session).

- [ ] **Step 1.2: Create `_scratch/` directory on disk**

Run: `mkdir -p _scratch && ls -la _scratch`
Expected: directory exists, empty.

- [ ] **Step 1.3: Append `_scratch/` to `.gitignore`**

Append this line to the end of `.gitignore`:

```
# local-only backup of files removed during repo cleanup — never tracked
_scratch/
```

- [ ] **Step 1.4: Verify the entry is active**

Run: `touch _scratch/testfile && git check-ignore -v _scratch/testfile && rm _scratch/testfile`
Expected output includes `.gitignore:N:_scratch/` showing ignore rule matched.

- [ ] **Step 1.5: Commit the gitignore change**

```bash
git add .gitignore
git commit -m "chore: add _scratch/ to .gitignore for local backups"
```

Expected: one file changed, 3 insertions (comment + blank + entry).

---

## Task 2 — Back up + delete 20 root scratch markdowns

**Files:**
- Backup to: `_scratch/` (20 files)
- Delete from git + disk: 20 root-level `.md` files

- [ ] **Step 2.1: Copy all 20 scratch markdowns to `_scratch/`**

```bash
cp M6_HANDOFF.md M6_WEIGHT_MANAGEMENT_PROMPT.md M6_COMPARE_SCREEN_PROMPT.md M6_HEALTH_CONDITIONS_PART2_PROMPT.md \
   m9walkthrough.md m9scorewalkthrough.md m9pantrywalkthrough.md m9safewalkthrough.md m9Mewalkthrough.md \
   walkthrough3.md kibawalkthrough.md \
   implementation_plan.md implementation_plan_review.md m9implementation_plan.md m9homeimplementation_plan.md m9Safeimplementation_plan.md kibaindeximplementation_plan.md \
   KIBA_INDEX_SECTION_SPEC.md SEARCH_SCREEN_SPEC.md ui_improvements_review.md \
   _scratch/
```

- [ ] **Step 2.2: Verify 20 files are in `_scratch/`**

Run: `ls _scratch/*.md | wc -l`
Expected: `20`

- [ ] **Step 2.3: `git rm` the 20 files**

```bash
git rm M6_HANDOFF.md M6_WEIGHT_MANAGEMENT_PROMPT.md M6_COMPARE_SCREEN_PROMPT.md M6_HEALTH_CONDITIONS_PART2_PROMPT.md \
       m9walkthrough.md m9scorewalkthrough.md m9pantrywalkthrough.md m9safewalkthrough.md m9Mewalkthrough.md \
       walkthrough3.md kibawalkthrough.md \
       implementation_plan.md implementation_plan_review.md m9implementation_plan.md m9homeimplementation_plan.md m9Safeimplementation_plan.md kibaindeximplementation_plan.md \
       KIBA_INDEX_SECTION_SPEC.md SEARCH_SCREEN_SPEC.md ui_improvements_review.md
```

- [ ] **Step 2.4: Verify no root-level scratch markdowns remain in working tree**

Run: `ls /Users/stevendiaz/kiba-antigravity | grep -E "^(M6_|m9|walkthrough|kibawalkthrough|implementation_plan|KIBA_INDEX|SEARCH_SCREEN|ui_improvements)" | wc -l`
Expected: `0`

- [ ] **Step 2.5: Commit the deletions**

```bash
git commit -m "chore: remove 20 root-level scratch/planning docs

Session-specific walkthroughs, implementation plans, and prompt handoffs
that accumulated during active dev. Polished long-lived equivalents live
in DECISIONS.md, ROADMAP.md, CLAUDE.md, and docs/. Backups are in
local _scratch/ (gitignored)."
```

Expected: 20 files changed, deletions.

---

## Task 3 — Back up + delete 2 root PNGs

**Files:**
- Backup to: `_scratch/`
- Delete from git + disk: `safe_switch_redesign_1775412634761.png`, `vet_report_page1_v2_1774716694435.png`

- [ ] **Step 3.1: Copy both PNGs to `_scratch/`**

```bash
cp safe_switch_redesign_1775412634761.png vet_report_page1_v2_1774716694435.png _scratch/
```

- [ ] **Step 3.2: Verify both backups exist**

Run: `ls -la _scratch/*.png`
Expected: 2 PNGs listed, sizes matching originals (~362KB + ~526KB).

- [ ] **Step 3.3: `git rm` the PNGs**

```bash
git rm safe_switch_redesign_1775412634761.png vet_report_page1_v2_1774716694435.png
```

- [ ] **Step 3.4: Commit**

```bash
git commit -m "chore: remove root-level design mockup PNGs

Scratch design assets from planning sessions. Not portfolio material;
originals preserved in _scratch/."
```

---

## Task 4 — Back up + delete `.cursorrules`

**Why:** stale (says M4.5 / M5 while we're on M9), and `CLAUDE.md` is the canonical AI-briefing file.

- [ ] **Step 4.1: Backup**

```bash
cp .cursorrules _scratch/
```

- [ ] **Step 4.2: `git rm` the file**

```bash
git rm .cursorrules
```

- [ ] **Step 4.3: Commit**

```bash
git commit -m "chore: remove stale .cursorrules

CLAUDE.md is the canonical AI-briefing file. .cursorrules referenced
M4.5 / M5 Pantry phase while project is on M9 — dual guidance files
caused drift. Backup in _scratch/."
```

---

## Task 5 — Back up + delete `V7_REIMPORT_INSTRUCTIONS.md`

**Why:** single most direct scraping-provenance file in the repo; explicit ops playbook with zero portfolio value.

- [ ] **Step 5.1: Backup**

```bash
cp scripts/import/V7_REIMPORT_INSTRUCTIONS.md _scratch/
```

- [ ] **Step 5.2: `git rm`**

```bash
git rm scripts/import/V7_REIMPORT_INSTRUCTIONS.md
```

- [ ] **Step 5.3: Commit**

```bash
git commit -m "chore: remove V7_REIMPORT_INSTRUCTIONS ops playbook

Internal reimport playbook; not portfolio material. Retrievable
from git history or _scratch/ backup if needed for a future v8
reimport."
```

---

## Task 6 — Soften retailer names in 2 tracked files

**Files:**
- Modify: `docs/references/dataset-field-mapping.md`
- Modify: `CLAUDE.md`

- [ ] **Step 6.1: Edit `docs/references/dataset-field-mapping.md` header**

Replace the first 12 lines' retailer-specific content. The "before" state:

```markdown
# Dataset Field Mapping — Product Data → Supabase

> Documents which fields from the scraped datasets were imported into the products table,
> which were dropped, and why.
>
> Last updated: March 26, 2026 (v7 reimport — migration 020, 19,058 products from Chewy + Amazon + Walmart)

---

## Source

- **Current dataset:** v7 reimport (March 25, 2026) — 19,058 products from Chewy, Amazon, Walmart
- **Previous:** v6 merged (9,089 records, Chewy only) — fully superseded by v7
- **Import script:** `scripts/import/import_products.py`
```

Replace with (softened):

```markdown
# Dataset Field Mapping — Product Data → Supabase

> Documents which fields from the source datasets were imported into the products table,
> which were dropped, and why.
>
> Last updated: March 26, 2026 (v7 reimport — migration 020, 19,058 products from publicly available retailer product pages)

---

## Source

- **Current dataset:** v7 reimport (March 25, 2026) — 19,058 products
- **Previous:** v6 merged (9,089 records, single-source) — fully superseded by v7
- **Import script:** `scripts/import/import_products.py`
```

- [ ] **Step 6.2: Verify `dataset-field-mapping.md` has no retailer names in lines 1-15**

Run: `head -15 docs/references/dataset-field-mapping.md | grep -iE "chewy|amazon|walmart"`
Expected: empty output (no match).

- [ ] **Step 6.3: Edit `CLAUDE.md` line 62 (Schema Traps → `products` bullet)**

Find this line in `CLAUDE.md` (the exact line is at ~62 but may shift as CLAUDE.md evolves):

```
- `products` — `is_supplemental`, `is_vet_diet`, `is_variety_pack` (migration 029, ~1,706 flagged), `affiliate_links` JSONB (invisible to scoring). v7 enrichment (migration 020): `ga_*_dmb_pct` (pre-computed DMB), `aafco_inference` (derivation audit trail), `chewy_sku`/`asin`/`walmart_id` (retailer dedup), `image_url`, `source_url`. 19,058 products from Chewy + Amazon + Walmart.
```

Replace with:

```
- `products` — `is_supplemental`, `is_vet_diet`, `is_variety_pack` (migration 029, ~1,706 flagged), `affiliate_links` JSONB (invisible to scoring). v7 enrichment (migration 020): `ga_*_dmb_pct` (pre-computed DMB), `aafco_inference` (derivation audit trail), retailer dedup IDs, `image_url`, `source_url`. 19,058 products in catalog.
```

Changes: (a) `` `chewy_sku`/`asin`/`walmart_id` (retailer dedup) `` → `retailer dedup IDs`; (b) `19,058 products from Chewy + Amazon + Walmart.` → `19,058 products in catalog.`

- [ ] **Step 6.4: Verify `CLAUDE.md` has no retailer names**

Run: `grep -iE "chewy|amazon|walmart" CLAUDE.md`
Expected: empty output.

- [ ] **Step 6.5: Commit both edits**

```bash
git add docs/references/dataset-field-mapping.md CLAUDE.md
git commit -m "docs: soften retailer names in dataset provenance lines

Remove 'Chewy + Amazon + Walmart' from dataset-field-mapping.md header
and CLAUDE.md Schema Traps → products bullet. Repo stays accurate about
having a product catalog, just doesn't name retailers in docs that
recruiters are likely to open first. Internal decision logs
(DECISIONS.md, ROADMAP.md, CURRENT.md) unchanged — engineering-rigor
signal there exceeds the value of scrubbing."
```

---

## Task 7 — Delete `.DS_Store` from disk

**Why:** already gitignored (never tracked), but a stray macOS `.DS_Store` sits at repo root. Tidy it before pushing.

- [ ] **Step 7.1: Delete `.DS_Store`**

```bash
find . -name ".DS_Store" -not -path "./node_modules/*" -not -path "./.git/*" -delete
```

- [ ] **Step 7.2: Verify**

Run: `find . -name ".DS_Store" -not -path "./node_modules/*" -not -path "./.git/*"`
Expected: empty output.

No commit — nothing tracked changed.

---

## Task 8 — Add `package.json` metadata

**Files:**
- Modify: `package.json`

- [ ] **Step 8.1: Add new fields after `"main"` line**

Current `package.json` top section:

```json
{
  "name": "kiba",
  "version": "1.0.0",
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
```

Change to:

```json
{
  "name": "kiba",
  "version": "1.0.0",
  "description": "iOS pet food scanner with ingredient-level, species-specific scoring",
  "main": "index.ts",
  "author": "Steven Diaz <steven.diaz08@gmail.com>",
  "license": "UNLICENSED",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/KibaScan/kiba-app.git"
  },
  "scripts": {
    "start": "expo start",
```

- [ ] **Step 8.2: Verify `package.json` still parses as valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`
Expected: exits 0, no output. Any syntax error will throw here.

- [ ] **Step 8.3: Verify new fields present**

Run: `node -e "const p = require('./package.json'); console.log({desc: p.description, author: p.author, license: p.license, repo: p.repository?.url});"`
Expected:
```
{
  desc: 'iOS pet food scanner with ingredient-level, species-specific scoring',
  author: 'Steven Diaz <steven.diaz08@gmail.com>',
  license: 'UNLICENSED',
  repo: 'git+https://github.com/KibaScan/kiba-app.git'
}
```

- [ ] **Step 8.4: Commit**

```bash
git add package.json
git commit -m "chore(package): add description, author, license, repository

Senior-engineer hygiene: package.json now carries basic metadata so
npm/GitHub correctly surface ownership, license, and repo URL. 'UNLICENSED'
is the npm-canonical value for all-rights-reserved (see docs.npmjs.com/
cli/v10/configuring-npm/package-json#license)."
```

---

## Task 9 — Write `LICENSE`

**Files:**
- Create: `LICENSE`

- [ ] **Step 9.1: Create `LICENSE` with this exact content**

```
Copyright (c) 2026 Steven Diaz. All rights reserved.

This repository is made available for portfolio review purposes. You
may view and reference the code. You may not copy, modify, distribute,
fork, or use this code for any commercial or derivative purpose without
prior written permission from the copyright holder.

The scoring engine, product decisions, ingredient taxonomy, and all
associated documentation are proprietary intellectual property of the
Kiba project (kibascan.com).

For inquiries: steven.diaz08@gmail.com
```

- [ ] **Step 9.2: Verify file exists and is readable**

Run: `wc -l LICENSE && head -1 LICENSE`
Expected: `12 LICENSE` (or close — 11 lines + trailing newline) and first line begins with `Copyright (c) 2026 Steven Diaz`.

- [ ] **Step 9.3: Commit**

```bash
git add LICENSE
git commit -m "docs: add LICENSE (source-available / view-only)

Copyright Steven Diaz, all rights reserved. Repo is made public only
for portfolio review; no fork / redistribute / commercial use."
```

---

## Task 10 — Write `docs/ARCHITECTURE.md`

**Files:**
- Create: `docs/ARCHITECTURE.md`

- [ ] **Step 10.1: Create `docs/ARCHITECTURE.md` with this exact content**

```markdown
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
└── navigation/           React Navigation stacks + param lists

supabase/
├── migrations/           38 migrations (001–038), RLS enforced on every user table
└── functions/            Deno Edge Functions
    ├── batch-score/      Bulk scoring with delta optimization + two-phase execution
    ├── auto-deplete/     pg_cron-triggered pantry depletion + push notifications
    ├── parse-ingredients/ Haiku-backed OCR parse + classification
    └── weekly-digest/    User activity digest (daily / weekly modes)

__tests__/                Jest, 1473 tests / 63 suites, regression anchors tracked
docs/
├── references/           Scoring rules, dataset mapping, design system
├── specs/                Product specs (pantry, nutrition, portion calc, breed mods)
├── plans/                Implementation plans (active + archived)
└── status/               CURRENT.md — latest session state, "up next" queue

.agent/                   Matte Premium design system (tokens, card anatomy, anti-patterns)
DECISIONS.md              129 decisions, D-001 → D-167 with explicit supersessions
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
| Score framing (D-094)         | `src/utils/constants.ts::getScoreColor()` + `ScoreRing.tsx` |
| UPVM compliance (D-095)       | Never say prescribe / treat / cure / prevent / diagnose in UI copy |
| Regression targets            | `__tests__/services/scoring/regressionTrace.test.ts`      |

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
```

- [ ] **Step 10.2: Verify file renders well (markdown sanity)**

Run: `head -5 docs/ARCHITECTURE.md && wc -l docs/ARCHITECTURE.md`
Expected: first line is `# Architecture`, total lines 100-140.

- [ ] **Step 10.3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: add ARCHITECTURE.md one-page tour

Map of repo layout, scoring pipeline diagram, data flow, and a 'where
to look' table. For reviewers who want one level more detail than
the README."
```

---

## Task 11 — Write `README.md`

**Files:**
- Create: `README.md`

**Why last:** references all the files created/updated in earlier tasks.

- [ ] **Step 11.1: Create `README.md` with this exact content**

```markdown
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
```

- [ ] **Step 11.2: Verify README renders**

Run: `head -10 README.md`
Expected: starts with `# Kiba — iOS Pet Food Scanner`, followed by the tagline.

- [ ] **Step 11.3: Verify no broken internal links**

Run:
```bash
grep -oE '\[[^]]+\]\([^)]+\)' README.md | grep -oE '\([^)]+\)' | tr -d '()' | while read link; do
  # skip URLs
  if [[ "$link" == http* ]]; then continue; fi
  # skip shields.io image srcs (also http)
  if [[ "$link" == *img.shields.io* ]]; then continue; fi
  if [[ ! -e "$link" ]]; then echo "BROKEN: $link"; fi
done
```
Expected: no `BROKEN:` output. All referenced paths resolve.

- [ ] **Step 11.4: Commit**

```bash
git add README.md
git commit -m "docs: add README.md portfolio landing doc

Recruiter-first structure: hero → 'why this is interesting' → tech
stack → architecture diagram → annotated reading list → running
locally → regression anchors → data/IP disclosure → license →
author + temporary-public disclaimer. Numbers and paths link to
sources so every claim is verifiable in-repo."
```

---

## Task 12 — Validate cold-install + test suite

**Why:** regression gate. Nothing in `src/` or `__tests__/` was touched; these should pass unchanged.

- [ ] **Step 12.1: Run full test suite**

Run: `npm test 2>&1 | tail -20`
Expected (last ~5 lines):
```
Test Suites: 63 passed, 63 total
Tests:       3 snapshots, 1473 passed, 1473 total
Snapshots:   3 passed, 3 total
```

If counts differ: STOP and investigate. No src/ file should have been touched; a diff must be explainable as a pre-existing flake, not a regression from this work.

- [ ] **Step 12.2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | tail -30`
Expected: 79 pre-existing errors, all in `docs/plans/search-uiux/*` or `supabase/functions/batch-score/scoring/*.ts`. Zero errors in `src/` or `__tests__/`.

If any NEW error appears in `src/` or `__tests__/`: STOP and investigate — no source file was intentionally modified.

- [ ] **Step 12.3: Verify regression anchors explicitly**

Run: `npm test -- --testPathPattern=regressionTrace 2>&1 | tail -10`
Expected: regression test file passes with Pure Balance = 61 and Temptations = 0 outputs.

- [ ] **Step 12.4: Confirm `_scratch/` is fully populated and gitignored**

Run:
```bash
ls _scratch/ | wc -l
git check-ignore _scratch/
```
Expected: count ≥ 24 (20 markdowns + 2 PNGs + `.cursorrules` + `V7_REIMPORT_INSTRUCTIONS.md`); `_scratch/` line confirms ignore.

- [ ] **Step 12.5: Confirm no unexpected working-tree state**

Run: `git status`
Expected: working tree clean (all commits made in Tasks 1-11).

---

## Task 13 — Push branch + open PR

**Goal:** land cleanup on `m5-complete` via normal PR review.

- [ ] **Step 13.1: Push the branch**

Run: `git push -u origin m9-repo-public-cleanup`
Expected: new branch created upstream; hash matches local tip.

- [ ] **Step 13.2: Open PR**

```bash
gh pr create --base m5-complete --title "M9: repo public cleanup" --body "$(cat <<'EOF'
## Summary

Prepare the repo to go temporarily public (~1 week) for portfolio review.

- Delete 20 root-level scratch markdowns + 2 PNGs + `.cursorrules` + `scripts/import/V7_REIMPORT_INSTRUCTIONS.md`
- Soften retailer names in `docs/references/dataset-field-mapping.md` header and one `CLAUDE.md` line
- Add `LICENSE` (source-available), `README.md` (portfolio-oriented), `docs/ARCHITECTURE.md` (one-page tour)
- Add `package.json` metadata (description, author, license, repository)
- `_scratch/` safety-net directory (gitignored) holds local copies of every removed file
- No `src/`, `supabase/`, or `__tests__/` changes

Design spec: `docs/superpowers/specs/2026-04-13-repo-public-cleanup-design.md`

## Test plan

- [ ] `npm test` → 1473 / 63 suites passing (unchanged)
- [ ] `npx tsc --noEmit` → only pre-existing 79 errors outside `src/` + `__tests__/`
- [ ] `_scratch/` populated and gitignored
- [ ] No retailer names in `dataset-field-mapping.md` lines 1-15 or `CLAUDE.md`
- [ ] README internal links all resolve
- [ ] `git status` clean after all commits

## Post-merge user actions (not in this PR)

1. Rotate secrets: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, SCRAPEDO_API_KEY
2. Change GitHub default branch to `m5-complete`
3. Delete merged remote feature branches (verify via `gh pr list --state merged`)
4. Set GitHub repo description + topics
5. Flip repo visibility to public via Settings
6. (~1 week later) Flip back to private

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Capture for the review cycle.

---

## Task 14 — (User action) Rotate secrets

**Not automated.** Steven runs this before flipping the repo public.

- [ ] **Step 14.1: Rotate `SUPABASE_SERVICE_ROLE_KEY`**

- Go to https://app.supabase.com/project/jvvdghwbikwrzrowmlmt/settings/api
- Under "Project API keys", click the "Reset service_role key" option
- Copy the new key
- Update `.env` locally
- Update any deployed Edge Function secrets via `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new>` or the Supabase dashboard

- [ ] **Step 14.2: Rotate `ANTHROPIC_API_KEY`**

- Go to https://console.anthropic.com/settings/keys
- Revoke the current key; generate a new one
- Update `.env` and any Edge Function secrets

- [ ] **Step 14.3: Rotate `SCRAPEDO_API_KEY`**

- Log in to scrape.do dashboard; rotate the API key
- Update `.env` (and any automation using it)

- [ ] **Step 14.4: Verify app still works**

Run the scan flow on a dev build end-to-end. If any Edge Function 401s, a secret is stale. Update and retry.

---

## Task 15 — (User action) Switch GitHub default branch to `m5-complete`

- [ ] **Step 15.1: Via CLI (fastest)**

Run: `gh api -X PATCH repos/KibaScan/kiba-app -f default_branch=m5-complete`
Expected: JSON response with `"default_branch": "m5-complete"` in it.

Alternate (GUI): Settings → Branches → "Default branch" → edit icon → pick `m5-complete` → confirm.

- [ ] **Step 15.2: Verify**

Run: `gh api repos/KibaScan/kiba-app --jq '.default_branch'`
Expected: `m5-complete`

Visit https://github.com/KibaScan/kiba-app in an incognito window. The repo should land on `m5-complete` and show the new README.

---

## Task 16 — (User action) Delete merged remote feature branches

**Verify each branch via PR merge status before deleting, NOT via `git merge-base --is-ancestor` (GitHub squash-merges rewrite history).**

- [ ] **Step 16.1: List merged PRs to confirm branches**

Run:
```bash
gh pr list --state merged --limit 30 --json number,title,headRefName | jq '.[] | select(.headRefName | IN("m4.5-cleanup", "fix/pantry-pet-switch-latency", "m9-dry-food-cups", "m9-pantry-polish"))'
```
Expected: 4 entries returned. If fewer, STOP — one of the branches may have unmerged work; do not delete it.

- [ ] **Step 16.2: Delete each verified-merged branch**

For each branch whose PR is confirmed merged:

```bash
git push origin --delete m4.5-cleanup
git push origin --delete fix/pantry-pet-switch-latency
git push origin --delete m9-dry-food-cups
git push origin --delete m9-pantry-polish
```

- [ ] **Step 16.3: Verify**

Run: `git ls-remote --heads origin | grep -E "m4.5-cleanup|fix/pantry-pet-switch-latency|m9-dry-food-cups|m9-pantry-polish"`
Expected: empty output.

- [ ] **Step 16.4: Remote kept alive**

Remaining remote branches after cleanup: `main`, `m5-complete`, `m9-repo-public-cleanup` (pre-merge), plus any active dev branches.

---

## Task 17 — (User action) Set GitHub repo description + topics

- [ ] **Step 17.1: Description**

Run: `gh repo edit KibaScan/kiba-app --description "iOS pet food scanner with ingredient-level, species-specific scoring engine. 1473 tests, 129 product decisions documented."`

- [ ] **Step 17.2: Topics**

Run: `gh repo edit KibaScan/kiba-app --add-topic react-native --add-topic expo --add-topic typescript --add-topic supabase --add-topic pet-food`

- [ ] **Step 17.3: Verify**

Run: `gh repo view KibaScan/kiba-app --json description,repositoryTopics`
Expected: description string matches; topics list contains the 5 tags.

---

## Task 18 — (User action) Flip repo visibility to public

- [ ] **Step 18.1: Change visibility**

Via GUI: Settings → General → "Danger zone" → Change repository visibility → Make public → confirm.

CLI alternative: `gh repo edit KibaScan/kiba-app --visibility public --accept-visibility-change-consequences`

- [ ] **Step 18.2: Verify**

Open https://github.com/KibaScan/kiba-app in an incognito window. README renders. `m5-complete` is default.

- [ ] **Step 18.3: Sanity checks on the live public repo**

- No retailer names on default landing view (README + first-screen scroll of CLAUDE.md/DECISIONS.md).
- `_scratch/` directory not visible anywhere (verify by searching "_scratch" in the GitHub UI).
- `.env` not visible (it never was, but check once).
- License renders at the top-right badge.
- Topics show under the description.

---

## Task 19 — (User action, ~1 week later) Flip back to private

- [ ] **Step 19.1: Change visibility back**

Via GUI: Settings → General → "Danger zone" → Change repository visibility → Make private → confirm.

CLI: `gh repo edit KibaScan/kiba-app --visibility private --accept-visibility-change-consequences`

- [ ] **Step 19.2: (Optional) Switch default branch back**

If you want the default branch back to `main`, it is now safe to:
- Fast-forward `main` from `m5-complete`: `git checkout main && git merge --ff-only m5-complete && git push origin main`
- Switch default back: `gh api -X PATCH repos/KibaScan/kiba-app -f default_branch=main`

Or leave `m5-complete` as default — either is fine since the repo is private.

- [ ] **Step 19.3: `_scratch/` disposition**

Leave it on disk indefinitely — it is gitignored and costs nothing. Or clean it up: `rm -rf _scratch/`.

---

## Plan Summary

| Task | What                                          | User or automated | Commits |
|------|-----------------------------------------------|-------------------|---------|
| 1    | `_scratch/` + gitignore                       | auto              | 1       |
| 2    | Delete 20 root scratch markdowns              | auto              | 1       |
| 3    | Delete 2 root PNGs                            | auto              | 1       |
| 4    | Delete `.cursorrules`                         | auto              | 1       |
| 5    | Delete `V7_REIMPORT_INSTRUCTIONS.md`          | auto              | 1       |
| 6    | Soften retailer names in 2 files              | auto              | 1       |
| 7    | Delete `.DS_Store` from disk                  | auto              | 0       |
| 8    | `package.json` metadata                       | auto              | 1       |
| 9    | Write `LICENSE`                               | auto              | 1       |
| 10   | Write `docs/ARCHITECTURE.md`                  | auto              | 1       |
| 11   | Write `README.md`                             | auto              | 1       |
| 12   | Cold validation                               | auto              | 0       |
| 13   | Push + open PR                                | auto              | 0 (PR)  |
| 14   | Rotate secrets                                | user              | —       |
| 15   | Switch default branch                         | user              | —       |
| 16   | Delete merged remote branches                 | user              | —       |
| 17   | Set description + topics                      | user              | —       |
| 18   | Flip to public                                | user              | —       |
| 19   | (1 week later) Flip to private                | user              | —       |

Total automated commits: 10. Tasks 1-13 are reviewable in the PR as 10 distinct commits on `m9-repo-public-cleanup`.
