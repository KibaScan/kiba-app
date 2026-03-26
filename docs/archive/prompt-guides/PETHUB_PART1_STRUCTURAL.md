# PetHubScreen Cleanup — Part 1: Structural Changes

## Context

The Me tab (PetHubScreen.tsx) mixes pet-specific data with app-level settings and has redundant sections. This is Part 1 of 3 — we're doing the structural removals and extractions first.

Read before starting:
- `src/screens/PetHubScreen.tsx` (current implementation)
- `src/screens/EditPetScreen.tsx` (confirm Delete exists here before removing from PetHub)
- `src/types/navigation.ts` (for new Settings screen route)

## Changes (Part 1 only)

### 1. Extract Settings to a dedicated SettingsScreen

The Settings section (Appointments, Notifications, Subscription, About Kiba) is app-level, not pet-level. It doesn't belong under a pet profile.

**Action:**
- Create `src/screens/SettingsScreen.tsx` — move the four settings rows (Appointments, Notifications, Subscription, About Kiba) and the version footer ("Kiba v1.0.0") into it
- Style it like a standard Kiba screen: dark background, SafeAreaView, header with back arrow + "Settings" title, card-style rows with Ionicons + chevron-forward, consistent with existing screens
- Add SettingsScreen to the Me stack in navigation config
- On PetHubScreen, replace the entire SETTINGS section with a single compact row at the very bottom of the scroll: `settings-outline` icon + "Settings" + `chevron-forward`. Tappable → navigates to SettingsScreen.
- Remove the "SETTINGS" section title and all four settings rows from PetHub

### 2. Remove "Delete [Pet Name]" from PetHub

**First:** confirm that EditPetScreen has the delete button and confirmation modal. Don't orphan the action.

**Then:** remove the delete button, the delete confirmation modal, all delete-related state (`deleteModalVisible`, `deleteInput`, `deleting`), and the `handleDelete` function from PetHubScreen. Remove associated styles.

### 3. Remove Recent Scans section

Scan history now lives on HomeScreen. Having it on both Home and Me is redundant.

**Action:** Remove the "RECENT SCANS" card, any data fetching for scan history (if it exists in useFocusEffect or similar), and all related styles. Remove the `ScanHistoryCard` import if it becomes unused after this removal.

## What NOT to touch in Part 1

- Don't modify any card content (treat budget, health records, profile card, stat chips)
- Don't move floating actions yet (Share, Log a Treat, Add Record) — that's Part 2
- Don't rename anything with pet names — that's Part 2
- Don't touch the scoring engine, permissions.ts, or ResultScreen

## After Implementation

Run `npx jest --passWithNoTests`. Visually verify: the Me tab should be noticeably shorter, ending with a single "Settings" row. Tap it → SettingsScreen opens with all four settings rows. Back arrow returns to PetHub. Delete should only be accessible via Edit Profile.
