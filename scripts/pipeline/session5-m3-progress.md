# M3 Session 5 Complete — Paywall + Legal Clickwrap

## What Was Built

### permissions.ts (full rewrite)
- configureRevenueCat() — init with EXPO_PUBLIC_REVENUECAT_API_KEY
- isPremium() — sync, reads cached RevenueCat entitlement
- canScan() — async, rolling 7-day window from scans table (NOT calendar week)
- canAddPet() — sync, free tier limited to 1 pet
- 7 feature gates: canSearch, canCompare, canUseSafeSwaps, canUseGoalWeight, canUseTreatBattery, canExportVetReport, canStartEliminationDiet
- canSetRecallAlerts() → always true (D-125)
- getScanWindowInfo() — count/remaining/oldest for DevMenu
- purchaseSubscription() — centralized RevenueCat purchase flow (D-051)
- Dev override: setDevPremiumOverride() / getDevPremiumOverride()

### PaywallScreen.tsx
- D-126 psychology: identity framing, annual-first anchoring, $2.08/mo math
- Annual card dominant ($24.99/yr, "Best Value"), monthly recessive ($5.99/mo)
- 7-item feature list with Ionicons (D-084)
- Trigger-specific headlines for all 7 triggers
- RevenueCat purchasePackage flow via permissions.ts purchaseSubscription()
- "Maybe later" dismiss

### Triggers Wired (D-052)
- 5 active: scan limit (ScanScreen), pet limit (SpeciesSelectScreen), safe swap (ResultScreen blur card), search (SearchScreen), compare (ResultScreen)
- 2 pre-wired: vet report, elimination diet (permissions.ts gates exist, no UI yet)

### TermsScreen.tsx (Clickwrap TOS)
- Active checkbox requirement (legal)
- D-094 attorney-approved disclaimer
- Blocks all app usage until accepted
- Version-aware: changing CURRENT_TOS_VERSION re-prompts all users
- Stored in AsyncStorage via Zustand persist (works for anonymous users)

### Other Changes
- App.tsx: configureRevenueCat() in init sequence
- DevMenu.tsx: __DEV__ only, premium toggle, scan window inject/reset
- PetHubScreen: version footer with 5-tap dev menu trigger
- constants.ts: freePetsMax reverted to 1 (was 10 with TODO)
- SearchScreen: premium gate with upgrade button
- ResultScreen: Safe Swap blur card + Compare button
- SpeciesSelectScreen: pet limit check before species selection
- Navigation: three-way gate (TOS → Onboarding → Main), Paywall as root modal
- .env: added EXPO_PUBLIC_REVENUECAT_API_KEY
- Test mocks: react-native-purchases mock added to PetHubScreen + PortionCard tests

## Verification
- D-051: All paywall checks route through permissions.ts (grep verified)
- D-051: All RevenueCat API calls isolated to permissions.ts (grep verified)
- D-127: Zero API keys in src/ (grep verified)
- D-125: canSetRecallAlerts() → true (free for all)
- D-084: Ionicons only, zero emoji
- Rolling window uses scans.scanned_at from Supabase, not Zustand counter

## Requires Before Testing
- App Store Connect: create $24.99/yr and $5.99/mo subscription products
- RevenueCat Dashboard: create app, configure entitlements, link products
- EAS Build: eas build --profile development (RevenueCat native module needs it)

## Existing tests: 447/447 still passing
