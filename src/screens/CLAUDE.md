# Screens

## Tab bar: Home | Community | (Scan) | Pantry | Me
- Search tab was replaced by Community tab
- `SearchScreen` deleted; premium text search lives on HomeScreen v2

## Navigation stacks (from src/types/navigation.ts)
- ScanStack: ScanMain → Result → RecallDetail → CommunityContribution → ProductConfirm → IngredientCapture
- HomeStack: HomeMain → Result → RecallDetail → AppointmentDetail
- CommunityStack: CommunityMain → Result → RecallDetail
- PantryStack: PantryMain → EditPantryItem → SafeSwitchSetup → SafeSwitchDetail → Result → RecallDetail
- HomeStack: HomeMain → Result → RecallDetail → AppointmentDetail → SafeSwitchDetail → Compare
- MeStack: MeMain → PetProfile → CreatePet → EditPet → HealthConditions → Appointments → CreateAppointment → AppointmentDetail → NotificationPreferences → Settings → Result → RecallDetail

## Patterns
- StyleSheet.create at bottom of file
- Screen-scoped state reloaded via useFocusEffect
- Exported pure helpers at top (before component) for testability

## Paywall
- ALL checks via `src/utils/permissions.ts` — never inline `if (isPremium)`
- PaywallTrigger types defined in `src/types/navigation.ts`
