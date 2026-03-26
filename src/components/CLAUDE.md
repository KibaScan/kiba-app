# Components

## UI rules
- Zero emoji (D-084) — Ionicons only
- Dark theme (D-086) — use `Colors` from `utils/constants`
- Score framing (D-094): always "[X]% match for [Pet Name]"
- UPVM compliance (D-095): never "prescribe," "treat," "cure," "prevent," "diagnose"
- Clinical copy only — objective, citation-backed, never editorial

## Color systems (both in utils/constants.ts)
- Score colors: `getScoreColor(score, isSupplemental)` — green family (daily), teal/cyan (supplemental)
- Severity colors: `SEVERITY_COLORS` — fixed per severity level, for ingredient badges
- 360° ring = daily food + treats, 270° arc = supplemental

## Subdirectory layout
- `scoring/` — score visualization (rings, waterfalls, bars, concern tags)
- `ingredients/` — ingredient display, DCM advisory, splitting detection
- `pantry/` — AddToPantrySheet, PantryCard, SharePantrySheet
- `pet/` — breed/allergen selectors, share cards, photo picker
- `treats/` — TreatQuickPickerSheet (D-124)
- `appointments/` — HealthRecordLogSheet (D-163)
- `ui/` — generic reusable (collapsible, tooltips, loading, dev menu)
