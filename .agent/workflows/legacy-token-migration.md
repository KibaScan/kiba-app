---
description: Finish the Colors.card / Colors.cardBorder → cardSurface / hairlineBorder migration across remaining screens
---

## Mission

Finish a visual-token-only sweep. `Colors.card` → `Colors.cardSurface` and `Colors.cardBorder` → `Colors.hairlineBorder` across ~40 remaining files. You are making style changes only — no logic, no tests, no scoring, no JSX structure, no imports. Reference `.agent/design.md` lines 589–619 if you need context. You do not need to read the whole file.

## Step 1: Migration Rule

| Legacy | Replace with | Notes |
|---|---|---|
| `Colors.card` (`#242424`) | `Colors.cardSurface` (`#242424`) | All card backgrounds. Zero visual delta (same hex). |
| `Colors.cardBorder` (`#333333`) | `Colors.hairlineBorder` (`rgba(255,255,255,0.12)`) | All borders and dividers. Slight visual delta (softer tint). |

**"Border" means exactly one of:** `borderColor`, `borderTopColor`, `borderBottomColor`, `borderLeftColor`, `borderRightColor`. Nothing else. Any other use of `Colors.cardBorder` (chip fills, toggle tracks, timeline nodes, slider rails, drag handles, progress-ring `TRACK_COLOR` constants, accent backgrounds, image placeholders) is **non-border** — flag, do not swap.

## Step 2: Hard Constraints

- **DO NOT** touch any file under `src/services/scoring/`. If the guardrail grep in Step 4 finds one, stop and report.
- **DO NOT** run Jest. Verification is `npx tsc --noEmit` + visual QA on sim. Token swaps cannot break types — Jest adds no signal.
- **DO NOT** introduce new color tokens. Only `Colors.cardSurface` and `Colors.hairlineBorder`, both already exported from `src/utils/constants.ts:16-17`.
- **DO NOT** touch files listed in Step 3 (Already Migrated).
- **DO NOT** edit flagged non-border uses mechanically. They go into Step 10's output, not the diff.
- **DO NOT** modify anything outside of `StyleSheet` blocks or inline style objects. No logic, no JSX, no new imports.
- **DO NOT** create new tests, new files, or new docs. Only `docs/status/CURRENT.md` gets a one-line append at the very end, and only if the user asked for a commit.
- **DO NOT** remove `Colors.card` or `Colors.cardBorder` from `src/utils/constants.ts`. Legacy tokens stay in the export. Removal is a follow-up task once every call site is migrated.
- **DO NOT** use `git add -A` or `git add .`. If committing, stage files explicitly by path.

## Step 3: Already Migrated (do not touch)

- **MeScreen area:** `PetHubScreen`, `PetHubStyles`, `MedicalRecordsScreen`, `HealthRecordDetailSheet`, `MedicationsListScreen`, `MedicationFormScreen`
- **Pantry:** `PantryScreen`, `PantryCard`, `SafeSwitchBanner`, `AddToPantryStyles`, `SharePantrySheet`, `EditPantryItemScreen`
- **CompareScreen** main body (but line 1005 still needs migration — see Group B below)
- **ResultScreen scoring cards:** `PositionMap`, `BonusNutrientGrid`, `CollapsibleSection`, `SafeSwapSection`, `AafcoProgressBars`, `ResultScreenStyles.ts`
- **HomeScreen** category buttons section only. If you find other legacy tokens elsewhere in HomeScreen during the final sweep, classify as Surprise (Step 8 step 6).

## Step 4: Procedure

Process in this exact order. Do not skip ahead.

// turbo
1. **Baseline snapshot.** Run `cd /Users/stevendiaz/kiba-antigravity && git status --short && git log --oneline -5`. Bail if any file in the Step 5 inventory is dirty (user may have in-progress work).

// turbo
2. **Sanity-check target tokens.** Run `grep -n "cardSurface:\|hairlineBorder:" src/utils/constants.ts`. Expect two hits at lines 16 and 17. Bail if either is missing.

// turbo
3. **Scoring-engine guardrail.** Run `grep -rn "Colors\.card\|Colors\.cardBorder" src/services/scoring/ || echo "CLEAN"`. Bail if output is anything other than `CLEAN` — do not proceed until the user resolves it.

// turbo
4. **Baseline typecheck.** Run `npx tsc --noEmit 2>&1 | tail -5`. Record the error count. Pre-existing errors are fine — your job is to not introduce new ones.

5. **Process Groups A–H in order** (Step 5 inventory). For each group:
   - **a.** For every file in the group, run a fresh `Grep` with pattern `Colors\.card[^S]|Colors\.cardBorder` and `-n` to get current line numbers. The inventory below is a hint; fresh grep is ground truth.
   - **b.** Decide edit strategy per Step 6 (mechanical `replace_all` vs. targeted edits).
   - **c.** For every `Colors.cardBorder` hit, read 1–2 lines of context **before editing**. If the property name is not one of the 5 `border*Color` variants, **STOP** — add to Step 10 Surprises, do not edit. This is the self-correction rule and it overrides the inventory.
   - **d.** Apply edits.
   - **e.** Record the file path in your touched-files tally.

// turbo
6. **Mid-sweep checkpoint (after Group D).** Run `npx tsc --noEmit 2>&1 | tail -5`. New errors must equal baseline. If not, diagnose immediately before proceeding.

// turbo
7. **Final sweep grep (after Group H).** Run `grep -rn "Colors\.card\b\|Colors\.cardBorder" src/ | grep -v "cardSurface" | grep -v node_modules`. Classify every remaining hit as one of: Already-Migrated (Step 3, unexpected — report), Flagged (Step 7, expected — confirm line), or Surprise (not in inventory — add to Step 10). Do not edit Surprises; report them.

// turbo
8. **Final typecheck.** Run `npx tsc --noEmit 2>&1 | tail -5`. New errors must equal baseline.

9. **Emit Step 10 output.**

## Step 5: Mechanical Work Inventory

`[C]` = `Colors.card` swap to `Colors.cardSurface`. Safe.
`[B]` = `Colors.cardBorder` swap to `Colors.hairlineBorder`. Safe **only** if file has zero entries in Step 7 (see Step 6 Rule 2).

### Group A — Community & onboarding

- `src/screens/CommunityScreen.tsx` — :119 `[C]`, :123 `[B]`
- `src/screens/CommunityContributionScreen.tsx` — :97 `[C]`, :120 `[C]`
- `src/screens/OnboardingScreen.tsx` — :221 `[C]`, :223 `[B]`, :242 `[C]`, :248 `[B]`
- `src/screens/SpeciesSelectScreen.tsx` — :103 `[C]`, :108 `[B]`

### Group B — Compare flow

- `src/screens/CompareScreen.tsx` — :1005 `[B]` (single remaining borderBottomColor)
- `src/components/compare/CompareProductPickerSheet.tsx` — :396 `[C]`, :405 `[C]`, :439 `[B]`, :450 `[C]` — **mixed file, targeted edits only** (:377 is flagged)

### Group C — Pet management

- `src/screens/CreatePetScreen.tsx` — :598 `[C]`, :603 `[B]`, :622 `[B]`, :677 `[B]` — **mixed file, targeted edits only** (:527, :642, :716 flagged)
- `src/screens/EditPetScreen.tsx` — :757 `[C]`, :762 `[B]`, :781 `[B]`, :836 `[B]`, :913 `[C]`, :918 `[B]`, :975 `[C]`, :1003 `[B]`, :1018 `[B]` — **mixed file, targeted edits only** (:588, :801, :876 flagged)

### Group D — Appointments (densest)

- `src/screens/AppointmentDetailScreen.tsx` — :552 `[B]`, :572 `[C]`, :604 `[C]`, :606 `[B]`, :624 `[C]`, :626 `[B]`, :644 `[C]`, :648 `[B]`, :664 `[C]`, :667 `[B]`, :675 `[B]`, :695 `[C]`, :701 `[B]`, :728 `[C]`, :758 `[C]` — no flagged, `replace_all` safe
- `src/screens/AppointmentsListScreen.tsx` — :244 `[B]`, :259 `[C]`, :287 `[C]`, :292 `[B]` — no flagged, `replace_all` safe
- `src/screens/CreateAppointmentScreen.tsx` — :364 `[B]`, :400 `[C]`, :402 `[B]`, :420 `[C]`, :422 `[B]`, :440 `[C]`, :444 `[B]`, :460 `[C]`, :463 `[B]`, :471 `[B]`, :491 `[C]`, :497 `[B]`, :509 `[B]` — no flagged, `replace_all` safe

**⟶ Run mid-sweep typecheck checkpoint here (Step 4 step 6).**

### Group E — Scan / capture / result-adjacent

- `src/screens/IngredientCaptureScreen.tsx` — :721 `[C]`, :723 `[B]`, :769 `[C]`, :775 `[C]`, :783 `[B]`, :789 `[C]`, :794 `[B]`, :838 `[C]`, :840 `[B]`
- `src/screens/ScanScreen.tsx` — :541 `[C]`, :587 `[C]`, :589 `[B]`, :609 `[C]`, :615 `[B]`
- `src/screens/ProductConfirmScreen.tsx` — :179 `[C]`, :249 `[C]`, :251 `[B]`, :272 `[C]`, :278 `[B]`, :286 `[C]`

### Group F — Safe switch

- `src/screens/SafeSwitchDetailScreen.tsx` — :487 `[C]`, :492 `[B]`, :525 `[C]`, :566 `[C]`, :571 `[B]`, :659 `[C]`, :664 `[B]` — **mixed file, targeted edits only** (:377, :384, :496, :590 flagged)
- `src/screens/SafeSwitchSetupScreen.tsx` — :325 `[C]`, :330 `[B]`, :417 `[C]`, :421 `[B]`, :455 `[B]` — **mixed file, targeted edits only** (:336 flagged)

### Group G — Info cards & advisories

- `src/components/result/HealthConditionAdvisories.tsx` — :205 `[C]`, :208 `[B]`
- `src/components/result/AffiliateBuyButtons.tsx` — :122 `[C]`, :125 `[B]`
- `src/components/result/kiba-index/FeedbackCard.tsx` — :134 `[C]` — **mixed file, targeted edits only** (:172 flagged)
- `src/components/pet/BreedContraindicationCard.tsx` — :51 `[C]`
- `src/components/pet/NursingAdvisoryCard.tsx` — :33 `[C]`
- `src/components/ingredients/DcmAdvisoryCard.tsx` — :132 `[C]`
- `src/components/ingredients/FlavorDeceptionCard.tsx` — :100 `[C]`
- `src/components/ingredients/SplittingDetectionCard.tsx` — :115 `[C]`
- `src/components/scoring/WhatGoodLooksLike.tsx` — :92 `[C]`
- `src/components/pet/AllergenSelector.tsx` — :161 `[C]`, :168 `[B]`
- `src/components/pet/BreedSelector.tsx` — :176 `[C]`, :183 `[B]`, :212 `[B]`
- `src/components/pet/WheelPicker.tsx` — :115 `[B]`
- `src/components/scoring/ConcernTags.tsx` — :179 `[C]`, :184 `[B]`, :194 `[C]`, :199 `[B]`
- `src/components/scoring/ScoreRing.tsx` — :463 `[C]` — **mixed file, targeted edits only** (:54 `TRACK_COLOR` constant is flagged)
- `src/components/ui/FormulaChangeTimeline.tsx` — :121 `[C]` — **mixed file, targeted edits only** (:170 flagged)

### Group H — Settings, sheets, misc

- `src/screens/PaywallScreen.tsx` — :263 `[C]`, :267 `[B]`
- `src/screens/BCSReferenceScreen.tsx` — :314 `[C]`, :351 `[C]`, :356 `[B]`, :422 `[C]`, :443 `[C]`, :445 `[B]`, :466 `[B]`
- `src/screens/SettingsScreen.tsx` — :255 `[B]`, :273 `[B]`, :297 `[C]`, :329 `[B]`
- `src/screens/RecallDetailScreen.tsx` — :312 `[C]`, :362 `[C]`, :434 `[C]`, :440 `[B]`
- `src/screens/TermsScreen.tsx` — :133 `[C]`, :137 `[B]`
- `src/screens/NotificationPreferencesScreen.tsx` — :401 `[C]` — **mixed file, targeted edits only** (:360 flagged)
- `src/components/appointments/HealthRecordLogSheet.tsx` — :414 `[C]`, :451 `[B]`, :464 `[B]`, :486 `[B]`, :509 `[B]`
- `src/components/treats/TreatQuickPickerSheet.tsx` — :172 `[C]`, :227 `[B]`, :270 `[B]`
- `src/components/WeightEstimateSheet.tsx` — :213 `[C]`, :277 `[B]`, :297 `[B]` — **mixed file, targeted edits only** (:225 flagged)
- `src/components/ui/DevMenu.tsx` — :216 `[B]`, :228 `[C]`, :232 `[B]`

**⟶ Run final typecheck checkpoint here (Step 4 step 8).**

## Step 6: Edit Strategy Rules

**Rule 1 — `Colors.card` is always safe for file-scoped `replace_all`.** Run this three-pass per file:

1. `Edit` with `replace_all: true`, `old_string: "Colors.card,"`, `new_string: "Colors.cardSurface,"` — catches property-value position.
2. `Edit` with `replace_all: true`, `old_string: "Colors.card }"`, `new_string: "Colors.cardSurface }"` — catches inline style closings.
3. `Edit` with `replace_all: true`, `old_string: "Colors.card)"`, `new_string: "Colors.cardSurface)"` — catches function arguments.

The trailing punctuation (`,`, `}`, `)`) anchors the match to value position, which prevents collision with `Colors.cardSurface` and `Colors.cardBorder`.

**Rule 2 — `Colors.cardBorder` strategy depends on the file:**

- **Clean file** (zero entries in Step 7): `Edit` with `replace_all: true`, `old_string: "Colors.cardBorder"`, `new_string: "Colors.hairlineBorder"`. Safe.
- **Mixed file** (any entries in Step 7): **targeted edits only**. For each `[B]` line in Step 5, read 1–2 lines of context, build a unique `old_string` with surrounding text, and run `replace_all: false`. Never use `replace_all` on a mixed file or you will rewrite flagged lines.

**Rule 3 — Mixed files requiring targeted `cardBorder` edits** (re-listed for quick scan):

- `CompareProductPickerSheet.tsx`
- `CreatePetScreen.tsx`
- `EditPetScreen.tsx`
- `SafeSwitchDetailScreen.tsx`
- `SafeSwitchSetupScreen.tsx`
- `FeedbackCard.tsx`
- `WeightEstimateSheet.tsx`
- `FormulaChangeTimeline.tsx`
- `ScoreRing.tsx`
- `NotificationPreferencesScreen.tsx`

**Rule 4 — Files with ONLY flagged uses. Do not open, do not edit:**

- `src/screens/HealthConditionsScreen.tsx` (only :640, non-border)
- `src/components/result/kiba-index/VoteBarChart.tsx` (only :91, non-border)
- `src/components/result/KibaIndexSection.tsx` (only :221, non-border)
- `src/components/WeightGoalSlider.tsx` (only :346, non-border)
- `src/components/pet/ConditionChip.tsx` (only :81, non-border)

**Rule 5 — Imports.** Both target tokens are already in the `Colors` export at `src/utils/constants.ts:16-17`. No import changes needed anywhere. If you encounter a destructured pattern (`const { card, cardBorder } = Colors`), rewrite only the destructure line — this pattern is not in the inventory but exists defensively.

**Rule 6 — Self-correction (this rule overrides the inventory).** Before editing any `Colors.cardBorder` hit, read 1–2 lines of surrounding context. If the property name is not `borderColor`, `borderTopColor`, `borderBottomColor`, `borderLeftColor`, or `borderRightColor`, **STOP**. Do not edit. Add the line to Step 10 Surprises with the actual element type (e.g. `backgroundColor`, `trackColor`, `const TRACK_COLOR =`). The inventory is a hint, not ground truth.

## Step 7: Flagged Non-Border Uses

Do not edit these lines. Verify they still exist during Step 4 step 7. Copy this list verbatim into Step 10 output.

### Backgrounds / fills

- `src/components/compare/CompareProductPickerSheet.tsx:377` — chip background
- `src/screens/CreatePetScreen.tsx:642` — accent background
- `src/screens/CreatePetScreen.tsx:716` — accent background
- `src/screens/EditPetScreen.tsx:801` — accent background
- `src/screens/EditPetScreen.tsx:876` — accent background
- `src/screens/SafeSwitchDetailScreen.tsx:496` — image placeholder background
- `src/screens/SafeSwitchDetailScreen.tsx:590` — background fill
- `src/screens/SafeSwitchSetupScreen.tsx:336` — accent background
- `src/screens/HealthConditionsScreen.tsx:640` — condition selector background
- `src/components/result/KibaIndexSection.tsx:221` — stat chip background
- `src/components/result/kiba-index/FeedbackCard.tsx:172` — unknown element, verify during sweep
- `src/components/result/kiba-index/VoteBarChart.tsx:91` — chart element
- `src/components/pet/ConditionChip.tsx:81` — chip background

### Timeline nodes / lines

- `src/screens/SafeSwitchDetailScreen.tsx:377` — timeline node
- `src/screens/SafeSwitchDetailScreen.tsx:384` — timeline line
- `src/components/ui/FormulaChangeTimeline.tsx:170` — timeline visual

### Tracks / rails (Switch.trackColor and progress-ring constants)

- `src/screens/CreatePetScreen.tsx:527` — `Switch trackColor`
- `src/screens/EditPetScreen.tsx:588` — `Switch trackColor`
- `src/screens/NotificationPreferencesScreen.tsx:360` — `Switch trackColor`
- `src/components/WeightGoalSlider.tsx:346` — slider track
- `src/components/scoring/ScoreRing.tsx:54` — `const TRACK_COLOR = Colors.cardBorder` (progress ring track)

### Handles / chrome

- `src/components/WeightEstimateSheet.tsx:225` — drag handle

**Total:** 22 flagged locations across 15 files. These need a dedicated token decision in a follow-up session (options include `hairlineBorder`, a new `chipSurface` token, `rgba(255,255,255,0.06)`, or keeping `#333333` as a legacy value). Out of scope here.

## Step 8: Verification

- `npx tsc --noEmit` baseline, mid (after Group D), and final (after Group H). New error count must equal baseline at each checkpoint.
- Final grep sweep (Step 4 step 7) surfaces zero unexpected residuals.
- **No Jest run.** Token swaps cannot break types. Visual QA on iOS simulator is the real verification and is a human task — you produce the checklist in Step 10, the user walks it.

## Step 9: Commit (only if user asked)

If — and only if — the user asked you to commit:

1. Stage touched files explicitly: `git add <file1> <file2> ...`. Never `git add -A` or `git add .`.
2. Commit message (HEREDOC):
   ```
   M9: legacy token migration — remaining screens
   ```
3. Append one line to `docs/status/CURRENT.md` under the "What Works" section, using `Edit` (not `Write`):
   ```
   - **Legacy token migration complete (M9)** — cardSurface/hairlineBorder across remaining screens. 22 non-border uses flagged for follow-up.
   ```
4. Run `git status` to confirm the commit landed.

If the user did not ask for a commit, skip this step entirely.

## Step 10: Output Format

Emit this template filled in at the end of your run:

```
## M9 Legacy Token Migration — Summary

### Files touched: <N>
<bulleted list of absolute paths, grouped by Group A–H>

### Flagged non-border uses (no changes, needs human review)
<verbatim list from Step 7, with any line numbers updated if drift was found>

### Surprises
<files/lines not in the inventory that turned up during Step 4 step 7 final sweep, or
 non-border uses caught by Rule 6 self-correction during Group processing. Empty if none.>

### Typecheck delta
Baseline errors: <X>
Mid-sweep errors (after Group D): <Y>
Final errors (after Group H): <Z>
New errors introduced: <Z - X>

### Visual QA checklist (user walks on iOS sim)
- [ ] AppointmentDetailScreen — form field and button borders read as softer hairlines
- [ ] CreateAppointmentScreen — type chips and date/location rows render correctly
- [ ] AppointmentsListScreen — tab control and list row borders look right
- [ ] EditPetScreen — condition, medication, and weight rows all render (flagged Switch tracks unchanged at :588)
- [ ] CreatePetScreen — species picker and form cards (flagged Switch track unchanged at :527)
- [ ] SafeSwitchDetailScreen — comparison card AND timeline nodes/lines still show (timeline elements were flagged, should look unchanged)
- [ ] SafeSwitchSetupScreen — benefit cards and accent rows
- [ ] CommunityScreen / CommunityContributionScreen — post cards and avatar containers
- [ ] OnboardingScreen — step chrome and species pre-screen
- [ ] BCSReferenceScreen — all 5 card sections
- [ ] PaywallScreen — plan cards
- [ ] SettingsScreen — list row separators
- [ ] RecallDetailScreen — hero and body cards
- [ ] IngredientCaptureScreen / ScanScreen / ProductConfirmScreen — capture cards and confirm rows
- [ ] ResultScreen advisories (HealthConditionAdvisories, AffiliateBuyButtons, Concern Tags) — inline frames
- [ ] Spot-check one Already Migrated screen (e.g. MeScreen or PantryScreen) to confirm no accidental changes
```

Walk the checklist, then stop. Do not add tests, docs beyond the CURRENT.md one-liner, or scope creep.
