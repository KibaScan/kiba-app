# PetHubScreen Cleanup — Part 2: Card Restructuring

## Context

Part 1 removed Settings, Delete, and Recent Scans from the Me tab. Now we're fixing card-level issues: floating orphan buttons and dead-end empty states.

Read before starting:
- `src/screens/PetHubScreen.tsx` (current state after Part 1 changes)

## Changes (Part 2 only)

### 4. Move floating actions inside their cards

Three buttons float disconnected from the data they act on. Move each inside its parent.

**Share Profile:**
- Currently floats below the profile card as "Share [Pet Name]'s Card"
- Move inside the profile card as the last element, below Score Accuracy
- Change copy to "Share Profile" (pet context established by carousel)
- Style as a small inline link: `share-outline` icon + text in `Colors.accent`, no background, centered

**Log a Treat:**
- Currently floats as a standalone button below the Treat Budget card
- Move inside the Treat Budget card as the last element, below the progress bar
- Style as an inline tappable row within the card — `restaurant-outline` icon + "Log a Treat" in `Colors.accent`
- Separator line above it to visually distinguish action from data

**Add Record:**
- Currently floats as a standalone "+ Add Record" button below Vaccines and Dewormings
- Remove this standalone button entirely — replaced by inline actions in step 5

### 5. Fix empty state dead-ends in health record cards

Empty cards should contain their own escape hatch, not force users to hunt for a disconnected button.

**Action:**
- Health Conditions card: unchanged (already has chevron → HealthConditionsScreen)
- Vaccines card: when empty, replace static "No vaccines logged yet." text with a tappable row: `add-circle-outline` icon + "Add a vaccine" in `Colors.accent`. Taps into the same add flow that "+ Add Record" used, with vaccine type pre-selected.
- Dewormings card: same pattern — `add-circle-outline` icon + "Add a deworming record" in `Colors.accent` when empty
- Remove the standalone floating "+ Add Record" button and its styles
- Keep the vet disclaimer text below the health cards

## What NOT to touch in Part 2

- Don't rename pet name references yet — that's Part 3
- Don't change stat chip styling — that's Part 3
- Don't change treat budget number display — that's Part 3
- Don't touch SettingsScreen, navigation config, or anything from Part 1

## After Implementation

Run `npx jest --passWithNoTests`. Visually verify: no buttons float between cards. Share link is inside profile card. Log a Treat is inside treat budget card. Empty vaccines/dewormings cards each have their own "+ Add" action. The standalone "+ Add Record" button is gone.
