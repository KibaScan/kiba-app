# Project Reorganization & Hooks Configuration

**Date:** March 19, 2026
**Branch:** m4.5-cleanup
**Session:** Post-M4.5, pre-M5

---

## Part 1: Directory Reorganization

### Problem

The root directory had 60+ files — specs, session logs, prompt guides, handoffs, 55MB of JSON datasets, and 22 Windows Zone.Identifier artifacts all mixed together. Components (30 files) were flat in `src/components/` with no grouping.

### Changes Made

#### Tier 1: Root Cleanup (60+ files to 20)

| What moved | From | To |
|---|---|---|
| 13 session progress files | `session*-progress.md` | `docs/archive/sessions/` |
| 3 prompt guides | `M1_PROMPT_GUIDE.md`, etc. | `docs/archive/prompt-guides/` |
| 4 handoff/consumed docs | `M5_HANDOFF.md`, etc. | `docs/archive/handoffs/` |
| 5 summaries/schema docs | `M2-SUMMARY.md`, etc. | `docs/archive/summaries/` |
| 6 spec files | `NUTRITIONAL_PROFILE_BUCKET_SPEC.md`, etc. | `docs/specs/` |
| 2 reference files | `references/scoring-rules.md`, etc. | `docs/references/` |
| 1 plan file | `TOP_MATCHES_PLAN.md` | `docs/plans/` |
| 2 JSON datasets (55MB) | `dataset_kiba_v6_merged.json`, `kiba_cleaned.json` | `data/` |
| 2 duplicate scripts | `scripts/import_products.py`, `scripts/import_tiers.py` | Deleted (older copies of `scripts/import/` versions) |
| 22 Zone.Identifier files | Scattered across root | Deleted (WSL artifacts, already gitignored) |

**Kept in root:** `CLAUDE.md`, `DECISIONS.md`, `ROADMAP.md` (active reference docs).

#### Tier 2: Component Reorganization (30 flat to 4 subdirectories + 2 root)

| Subdirectory | Files | Contents |
|---|---|---|
| `components/scoring/` | 9 | ScoreRing, ScoreWaterfall, BenchmarkBar, AafcoProgressBars, BonusNutrientGrid, ConcernTags, SeverityBadgeStrip, PositionMap, WhatGoodLooksLike |
| `components/ingredients/` | 5 | IngredientList, IngredientDetailModal, FlavorDeceptionCard, SplittingDetectionCard, DcmAdvisoryCard |
| `components/pet/` | 7 | BreedSelector, AllergenSelector, ConditionChip, BreedContraindicationCard, NursingAdvisoryCard, PetPhotoSelector, PetShareCard |
| `components/ui/` | 7 | CollapsibleSection, InfoTooltip, LoadingTerminal, ScannerOverlay, MetadataBadgeStrip, FormulaChangeTimeline, DevMenu |
| `components/` (root) | 2 | PortionCard, TreatBatteryGauge (feature-specific, stay at root) |

**Import updates required in 9 files:**
- `ResultScreen.tsx` — 24 component imports updated
- `CreatePetScreen.tsx` — 2 imports (PetPhotoSelector, BreedSelector)
- `EditPetScreen.tsx` — 2 imports (PetPhotoSelector, BreedSelector)
- `HealthConditionsScreen.tsx` — 2 imports (ConditionChip, AllergenSelector)
- `ScanScreen.tsx` — 1 import (ScannerOverlay)
- `PetHubScreen.tsx` — 2 imports (DevMenu, PetShareCard)
- `scoring/ScoreWaterfall.tsx` — InfoTooltip cross-reference (`./` to `../ui/`)
- `scoring/AafcoProgressBars.tsx` — InfoTooltip cross-reference (`./` to `../ui/`)
- `TreatBatteryGauge.tsx` — InfoTooltip cross-reference (`./` to `./ui/`)

**No test changes required** — tests only import PortionCard and TreatBatteryGauge (both stayed at root).

#### CLAUDE.md Path Updates

All spec file references updated from root paths to `docs/` paths:
- `references/scoring-rules.md` to `docs/references/scoring-rules.md`
- `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` to `docs/specs/NUTRITIONAL_PROFILE_BUCKET_SPEC.md`
- `BREED_MODIFIERS_DOGS.md` to `docs/specs/BREED_MODIFIERS_DOGS.md`
- etc.

Decision count updated: 151 to 159 (D-152 through D-159 appended earlier this session).

### Final Root Directory

```
kiba-app/
  .claude/           ← settings, hooks, commands
  App.tsx
  CLAUDE.md          ← project context (active)
  DECISIONS.md       ← 159 decisions (active)
  ROADMAP.md         ← milestone plan (active)
  __tests__/         ← 641 tests, 32 suites
  app.json
  assets/
  babel.config.js
  data/              ← datasets + Excel
  docs/              ← all documentation
    archive/         ← historical (sessions, guides, handoffs, summaries)
    plans/           ← future work (TOP_MATCHES_PLAN.md)
    references/      ← scoring-rules.md, dataset-field-mapping.md
    specs/           ← active spec files (6 files)
  eas.json
  index.ts
  metro.config.js
  package.json
  scripts/           ← data pipeline scripts
  src/               ← app source
    components/
      scoring/       ← 9 score display components
      ingredients/   ← 5 ingredient display components
      pet/           ← 7 pet profile components
      ui/            ← 7 general UI components
      PortionCard.tsx
      TreatBatteryGauge.tsx
    screens/         ← 16 screens
    services/        ← business logic + scoring engine
    stores/          ← 3 Zustand stores
    types/           ← TypeScript types
    utils/           ← 15 utilities
    data/            ← static data (breeds, conditions)
    content/         ← explainer content
    navigation/      ← React Navigation config
  supabase/          ← backend (migrations, edge functions)
  tsconfig.json
```

### Verification

- 641/641 tests pass (no regressions)
- All component imports resolve correctly
- CLAUDE.md paths verified

---

## Part 2: Claude Code Hooks

### Configuration File

**Location:** `.claude/settings.json` (project-level, committable)

### Hook 1: TypeScript Type-Check (PostToolUse)

**Trigger:** After every `Edit` or `Write` tool call
**Behavior:** Runs `tsc --noEmit` asynchronously, surfaces last 20 lines of output
**Timeout:** 30 seconds

```json
{
  "type": "command",
  "command": "cd /home/pc/kiba-app && npx tsc --noEmit 2>&1 | tail -20",
  "timeout": 30,
  "async": true
}
```

**Why:** Project uses TypeScript strict mode. Catches type errors immediately after edits without blocking the workflow.

### Hook 2: Jest Affected Tests (PostToolUse)

**Trigger:** After every `Edit` or `Write` tool call
**Behavior:** Runs only tests affected by changed files, asynchronously
**Timeout:** 60 seconds

```json
{
  "type": "command",
  "command": "cd /home/pc/kiba-app && npx jest --onlyChanged --silent 2>&1 | tail -10",
  "timeout": 60,
  "async": true
}
```

**Why:** 641 tests across 32 suites. Running the full suite after every edit is slow; `--onlyChanged` targets only what's relevant.

### Hook 3: Scoring Engine File Protection (PreToolUse)

**Trigger:** Before any `Edit` or `Write` to a protected file
**Behavior:** Forces a confirmation prompt. Does not block non-protected files.
**Script:** `.claude/hooks/protect-scoring.sh`

**Protected files:**
- `src/services/scoring/engine.ts`
- `src/services/scoring/pipeline.ts`
- `src/services/scoring/ingredientQuality.ts`
- `src/services/scoring/nutritionalProfile.ts`
- `src/services/scoring/formulationScore.ts`
- `src/services/scoring/speciesRules.ts`
- `src/services/scoring/personalization.ts`
- `docs/references/scoring-rules.md`

**How it works:** Reads the tool input JSON from stdin, extracts the file path via Node.js, checks against the protected list. If matched, returns a `permissionDecision: "ask"` response forcing user confirmation. Non-matches pass through silently.

**Why:** The scoring engine is the core IP. Regression anchors (Pure Balance = 60, Temptations = 0) must hold after any change. This forces a pause before editing scoring logic.

### Hook 4: Regression Anchor Reminder (SessionStart)

**Trigger:** Every session start
**Behavior:** Injects a system message with regression anchors

```json
{
  "type": "command",
  "command": "echo '{\"systemMessage\": \"Scoring regression anchors: Pure Balance (Dog) = 60, Temptations (Cat Treat) = 0. Verify after any scoring changes.\"}'"
}
```

**Why:** After context compaction or new sessions, Claude may lose awareness of the regression anchors. This ensures they're always present.

### Hook 5: Desktop Notification (Notification)

**Trigger:** When Claude Code needs user attention
**Behavior:** Sends desktop notification via `notify-send` (Linux) or terminal beep via PowerShell (WSL fallback)

```json
{
  "type": "command",
  "command": "notify-send 'Claude Code' 'Waiting for your input' 2>/dev/null || powershell.exe -Command \"[console]::beep(800,200)\" 2>/dev/null || true"
}
```

**Why:** Prevents missed prompts when multitasking. Falls back gracefully across environments.

### Hook Summary Table

| # | Event | Matcher | Async | Purpose |
|---|-------|---------|-------|---------|
| 1 | PostToolUse | Edit\|Write | Yes | TypeScript type-check |
| 2 | PostToolUse | Edit\|Write | Yes | Jest affected tests |
| 3 | PreToolUse | Edit\|Write | No | Scoring file protection gate |
| 4 | SessionStart | (all) | No | Regression anchor injection |
| 5 | Notification | (all) | No | Desktop alert / beep |

### Managing Hooks

- View/edit: `/hooks` command in Claude Code
- Config file: `.claude/settings.json`
- Protection script: `.claude/hooks/protect-scoring.sh`
- To add a protected file: append its path to the `PROTECTED` array in `protect-scoring.sh`
- To disable all hooks temporarily: add `"disableAllHooks": true` to settings
