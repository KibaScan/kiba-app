# PetHubScreen Cleanup — Part 3: Visual Polish

## Context

Parts 1 and 2 handled structural changes (settings extraction, section removal) and card restructuring (moving actions inside cards, inline empty states). Now we're doing the visual polish pass — fixing styling issues that create false affordances or visual noise.

Read before starting:
- `src/screens/PetHubScreen.tsx` (current state after Parts 1 and 2)
- `src/utils/constants.ts` (Colors)

## Changes (Part 3 only)

### 6. Reduce pet name repetition

The carousel establishes which pet is active. Repeating the name in every sub-card wastes cognitive energy.

**Action — on PetHubScreen only:**
- "848 kcal/day for Max" → "848 kcal/day"
- "Daily Treat Budget" should already say this after Part 2's "Log a Treat" move — if it still says "Max's Treat Budget", change it to "Daily Treat Budget"
- The profile card header keeps the pet name — that's the identity card
- **Do NOT touch any score displays on any other screen** — D-094 requires "[X]% match for [Pet Name]" wherever scores appear. This change is scoped to PetHubScreen only.

### 7. Fix stat chips — read-only badges, not buttons

"Moderate", "Neutered", "21.8 kg" have bordered chip styling that looks like tappable selection chips (same style as onboarding). Users tap expecting to edit, nothing happens.

**Action:**
- Remove `borderWidth` and `borderColor` from stat chip styles
- Set `backgroundColor` to a solid muted fill — use `Colors.card` or slightly darker than current. The chips should look like inert info badges, not interactive buttons.
- Keep the icon + text layout and the `flexDirection: 'row'` + gap pattern
- Keep the border radius (rounded is fine for badges)

### 8. Clean up Treat Budget display

The treat budget currently shows the same information three times: "0/99 kcal" (fraction), "0%" (inside bar), and "0% used" (green text below).

**Action:**
- Keep "0/99 kcal" — the fraction is the primary data
- Keep the visual progress bar — the fill communicates progress at a glance
- Remove the "0%" text rendered inside the progress bar
- Remove the "0% used" text below the progress bar
- Color logic: when consumed is 0, show the fraction text in `Colors.textTertiary` (gray). When treats have been logged (consumed > 0), switch to `Colors.severityGreen`. An empty budget is a neutral state, not a success.

## What NOT to touch in Part 3

- Don't modify card structure or layout (that was Part 2)
- Don't touch SettingsScreen or navigation (that was Part 1)
- Don't touch any screen other than PetHubScreen
- Don't touch the scoring engine or ResultScreen

## After Implementation

Run `npx jest --passWithNoTests`. Visual check: stat chips should look like passive badges (no borders, solid fill). Treat budget should show fraction + bar only (no redundant percentages). Pet name should not repeat in sub-card titles. Verify the overall scroll feels clean and focused.
