# Kiba — Matte Premium Design System

> **Purpose**: This document defines the visual language for every screen in Kiba. Reference this when creating new screens or polishing existing ones. Every decision here was made to avoid common "premium UI" mistakes — no glows, no glassmorphism, no neon. The feel is Apple Health × Oura × Linear.

---

## Core Philosophy

| Principle | Rule |
|---|---|
| **Matte Premium** | Deep blacks, pristine typography, perfect padding. The premium feel comes from restraint, not effects. |
| **Color is for data** | Cyan gradients are reserved for progress bars, data viz, and CTAs. Never on card backgrounds or borders. |
| **No glows** | No `shadowColor: accent`, no glassmorphism on cards, no neon border glow. These kill contrast, accessibility, and RN frame rates. |
| **Machined aluminum** | Cards should feel like milled dark metal — solid, precise, with crisp hairline edges. |
| **Safe destructive actions** | Swipe-to-delete is allowed via `SwipeableRow`, but **confirmation alert is always required**. Swipe reveals action → tap → `Alert.alert` confirmation → `deleteConfirm()` haptic → delete. Never delete without confirmation. |

---

## Color Tokens

All colors live in `src/utils/constants.ts` under `Colors`.

### Surfaces
| Token | Value | Usage |
|---|---|---|
| `background` | `#1A1A1A` | App/screen background |
| `cardSurface` | `#242424` | Card backgrounds — elevated, matches legacy card token |
| `card` | `#242424` | Legacy — avoid for new code, use `cardSurface` |

### Borders
| Token | Value | Usage |
|---|---|---|
| `hairlineBorder` | `rgba(255,255,255,0.12)` | All card borders, dividers, separators — crisp 1px |
| `cardBorder` | `#333333` | Legacy — avoid for new code, use `hairlineBorder` |

### Feedback
| Token | Value | Usage |
|---|---|---|
| `pressOverlay` | `rgba(255,255,255,0.05)` | Touch feedback underlay on tappable rows |

### Text
| Token | Value | Usage |
|---|---|---|
| `textPrimary` | `#FFFFFF` | Headings, names, primary labels |
| `textSecondary` | `#A0A0A0` | Dates, metadata, descriptions |
| `textTertiary` | `#666666` | Chevrons, type labels, disabled text |

### Accent
| Token | Value | Usage |
|---|---|---|
| `accent` | `#00B4D8` | CTAs, links, active states, progress bar start |
| `accentDark` | `#0090AD` | Pressed states |
| Gradient | `#00B4D8 → #0077B6` | Data visualization bars ONLY (horizontal, left-to-right) |

### Severity
| Token | Value | Usage |
|---|---|---|
| `severityRed` | `#EF4444` | Delete buttons, critical alerts |
| `severityAmber` | `#F59E0B` | Warnings, stale data indicators |
| `severityGreen` | `#4ADE80` | Active/current status dots |
| `severityNone` | `#6B7280` | Neutral/inactive |

---

## Typography

All sizes live in `FontSizes` in `constants.ts`.

| Token | Size | Usage |
|---|---|---|
| `xs` | 11 | Vet names, type badges, tertiary labels |
| `sm` | 13 | Dates, chip labels, section descriptions, "See All" links |
| `md` | 15 | Row names, input text, button labels |
| `lg` | 17 | Card titles, screen headers, save buttons |
| `xl` | 22 | Section headers (rarely used) |
| `xxl` | 28 | Screen titles ("Me", "Home", "Pantry") |
| `title` | 34 | Hero titles (onboarding, paywall) |

### Weight Rules
- Screen titles: `fontWeight: '800'`
- Card titles: `fontWeight: '700'`
- Row names, buttons: `fontWeight: '600'`
- Body text, dates: default weight (400)
- Section labels (UPPERCASE): `fontWeight: '600'`, `letterSpacing: 0.5`, `textTransform: 'uppercase'`

---

## Spacing

All values live in `Spacing` in `constants.ts`.

| Token | Value | Usage |
|---|---|---|
| `xs` | 4 | Micro gaps (between icon and text in a chip) |
| `sm` | 8 | Row internal padding, chip gaps |
| `md` | 16 | Card internal padding, section gaps |
| `lg` | 24 | Card outer margins, screen horizontal padding, card `padding` |
| `xl` | 32 | Major section breaks |
| `xxl` | 48 | Screen bottom spacing (above tab bar) |

### Screen Layout
```
paddingHorizontal: Spacing.lg (24)
paddingBottom: 88 (tab bar clearance)
```

---

## Card Anatomy

Every card follows this exact spec:

```typescript
{
  backgroundColor: Colors.cardSurface,     // #242424
  borderRadius: 16,                        // never inflate to 20
  padding: Spacing.lg,                     // 24 — or Spacing.md (16) for compact cards
  borderWidth: 1,
  borderColor: Colors.hairlineBorder,      // rgba(255,255,255,0.12)
  marginBottom: Spacing.md,               // 16
}
```

### Card Header Pattern
```
Title (left)                    [action icon] (right)
```
- Title: `FontSizes.md`, `fontWeight: '700'`, `Colors.textPrimary`, `marginBottom: Spacing.sm`
- Action icon: 20px, `Colors.accent`
- Layout: `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`

### Card Row Pattern (tappable)
Every data row inside a card:
```typescript
{
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: Spacing.sm,             // 8
  borderTopWidth: 1,
  borderTopColor: Colors.hairlineBorder,   // first row gets the divider too
}
```
- Row info: `flex: 1`
- Name: `FontSizes.md`, `fontWeight: '600'`, `Colors.textPrimary`
- Date: `FontSizes.sm`, `Colors.textSecondary`
- Tertiary: `FontSizes.xs`, `Colors.textTertiary`
- **Chevron**: Always present on tappable rows — `chevron-forward`, size 16, `Colors.textTertiary`
- **Touch feedback**: `activeOpacity={0.7}`

### "See All" Link — Header Placement (Preferred)
In card headers, place "See All ›" in the **top-right**, directly across from the card title:
```typescript
// Header row
{
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
}

// See All link (headerSeeAll style)
{
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
}
```
- Text: `FontSizes.sm`, `fontWeight: '600'`, `Colors.accent`
- Chevron: size 14, `Colors.accent`
- **Only show when list has items** (hide when empty — show add CTA instead)
- This replaces the old centered-bottom "See All" pattern on dashboard cards

### Featured Action Card (Vet Report pattern)

For a single prominent action (not a data list), wrap in a standard card with icon + title + description:
```typescript
// vetReportCard style — standard card anatomy
{
  backgroundColor: Colors.cardSurface,
  borderRadius: 16,
  padding: Spacing.lg,
  borderWidth: 1,
  borderColor: Colors.hairlineBorder,
  marginBottom: Spacing.md,
}
// Interior: row layout with icon (24px, Colors.accent) + text block
// Title: FontSizes.md, fontWeight '700', Colors.accent
// Description: FontSizes.sm, Colors.textSecondary
```
Use for standalone actions like "Export Vet Report", "Share Profile", etc. — never use a naked text link.

### "Add" CTA Link
Bottom-anchored, always visible:
```typescript
{
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginTop: Spacing.sm,
}
```
- Icon: `add-circle-outline`, size 16, `Colors.accent`
- Text: `FontSizes.sm`, `fontWeight: '600'`, `Colors.accent`
- **Single CTA per card** — never put a duplicate add button in the header AND the footer

---

## Truncation Rule

Dashboard cards that grow vertically (records, appointments, etc.) must follow:

1. **Show max 3 items** on the dashboard card
2. If >3 exist, show **"See All ›"** link → navigates to full-screen list
3. Full-screen list uses `FlatList` with proper empty state
4. **Never nest a scrollable list inside a ScrollView** — it creates scroll-in-scroll nightmares

---

## Avatars — Story Ring Effect

Active pet avatar in carousels:
```typescript
{
  width: 50,
  height: 50,
  borderRadius: 25,
  borderWidth: 2,
  borderColor: Colors.accent,
  padding: 3,    // 3px transparent gap between ring and photo
  backgroundColor: Colors.background,  // gap color matches app bg
}
```
Photo inside the ring:
```typescript
{
  width: 40,
  height: 40,
  borderRadius: 20,
}
```
- **No shadows** on avatars — matte only
- Inactive avatars: `opacity: 0.5`, smaller (36×36)

---

## Stat Chips

Quick-glance **read-only** pills showing pet attributes. **No borders** — these must look like static physical badges, never clickable buttons.
```typescript
{
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#2A2A2E',       // slightly elevated from cardSurface — NOT tappable
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 8,
  gap: 6,
  // borderWidth: 0 — intentionally borderless to avoid "fake button" signaling
}
```
- Icon: 14-16px, `Colors.textSecondary`
- Value: `FontSizes.sm`, `Colors.textPrimary`
- **Never** add a border to stat chips — borders signify interactivity

---

## Condition/Tag Chips

Inside health cards:
```typescript
{
  backgroundColor: Colors.background,     // not cardBorder
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderWidth: 1,
  borderColor: Colors.hairlineBorder,
}
```
- Text: `FontSizes.xs`, `Colors.textPrimary`

---

## Progress / Accuracy Bars

The **only place** where gradients are allowed on cards:
```typescript
// Track
{ height: 6, backgroundColor: Colors.hairlineBorder, borderRadius: 3, overflow: 'hidden' }

// Fill — uses LinearGradient
<LinearGradient
  colors={['#00B4D8', '#0077B6']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 0 }}
  style={{ height: 6, borderRadius: 3, width: `${percent}%` }}
/>
```

### Treat Budget Bar Track
Track background uses `rgba(255,255,255,0.12)` — reads as a physical container slot. The track must be visible even when the fill is at 0%.

### Zero-State Text
When a progress bar shows 0 consumed (e.g., "0/281 kcal"), the label uses `Colors.textSecondary` — **never** `Colors.textTertiary`, which becomes invisible on dark backgrounds. The label transitions to the bar's fill color (e.g., green) once the user logs activity.

---

## Bottom Sheets

Follow the existing `Modal` + `BlurView` pattern:
```typescript
// Overlay
<Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
</Pressable>

// Sheet
{
  backgroundColor: Colors.cardSurface,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  paddingHorizontal: Spacing.lg,
  paddingTop: Spacing.md,
  maxHeight: '85%',
}

// Handle
{
  width: 40, height: 4, borderRadius: 2,
  backgroundColor: Colors.textTertiary,
  alignSelf: 'center',
  marginBottom: Spacing.md,
}
```

### Sheet Labels
```typescript
{
  fontSize: FontSizes.sm,
  fontWeight: '600',
  color: Colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginTop: Spacing.md,
  marginBottom: Spacing.sm,
}
```

### Sheet Inputs
```typescript
{
  backgroundColor: Colors.background,
  borderRadius: 12,
  padding: Spacing.md,
  fontSize: FontSizes.md,
  color: Colors.textPrimary,
  borderWidth: 1,
  borderColor: Colors.hairlineBorder,
}
```

### Sheet Buttons
- **Primary (Save)**: `backgroundColor: Colors.accent`, `borderRadius: 14`, `paddingVertical: Spacing.md`, text: `FontSizes.lg`, `fontWeight: '700'`
- **Destructive (Delete)**: Text-only, `Colors.severityRed`, `fontWeight: '600'`, centered, with `Alert.alert` confirmation
- **Cancel**: Text-only, `Colors.textSecondary`, `fontWeight: '600'`

---

## Screen Headers

### Dashboard Screen Header (PetHubScreen pattern)

Screen title with optional settings gear:
```typescript
// header style
{
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: Spacing.md,
  paddingBottom: Spacing.sm,
}
```
- Title (left): `FontSizes.xxl`, `fontWeight: '800'`, `Colors.textPrimary`
- Settings gear (right): `settings-outline`, size 22, `Colors.textSecondary`
- **No standalone "Settings" row at bottom of scroll** — gear icon replaces it

### Disclaimer Text

Informational disclaimers (e.g., "Health records are for your reference…") go at the **very bottom of scroll**, after all cards and actions. Never between cards.
```typescript
{
  fontSize: FontSizes.xs,
  color: Colors.textTertiary,
  textAlign: 'center',
  marginBottom: Spacing.lg,
  paddingHorizontal: Spacing.md,
}
```

---

## Navigation Rows (Settings-style)

Full-width tappable rows at the bottom of dashboard screens:
```typescript
{
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 14,
  gap: Spacing.md,
  marginTop: Spacing.md,
}
```
- Icon: 20px, `Colors.textSecondary` (or `Colors.accent` for featured items)
- Label: `flex: 1`, `FontSizes.md`, `Colors.textPrimary`
- Chevron: `chevron-forward`, size 18, `Colors.textTertiary`

---

## Full-Screen List Screens

For "See All" destinations (Medical Records, Appointments):

### Header
```typescript
{
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: Spacing.lg,
  paddingVertical: Spacing.md,
  borderBottomColor: Colors.hairlineBorder,
  borderBottomWidth: 1,
}
```
- Back: `arrow-back`, size 24, `Colors.textPrimary`
- Title: `flex: 1`, centered, `FontSizes.lg`, `fontWeight: '700'`
- Add: `add`, size 26, `Colors.accent`

### List Rows
Individual cards per row (not divider-separated):
```typescript
{
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: Colors.cardSurface,
  borderRadius: 12,
  padding: Spacing.md,
  marginBottom: Spacing.sm,
  borderWidth: 1,
  borderColor: Colors.hairlineBorder,
}
```

### Empty State
Centered vertically:
- Icon: 48px, `Colors.textTertiary`
- Title: `FontSizes.lg`, `fontWeight: '700'`, `Colors.textPrimary`, `marginTop: Spacing.md`
- Body: `FontSizes.sm`, `Colors.textSecondary`, `textAlign: 'center'`
- CTA: `backgroundColor: Colors.accent`, `borderRadius: 12`, text `fontWeight: '700'`

---

## Anti-Patterns (DO NOT)

| ❌ Don't | ✅ Do Instead |
|---|---|
| Glow effects (`shadowColor: accent`) | Matte surfaces with hairline borders |
| `expo-blur` / glassmorphism on cards | Solid `Colors.cardSurface` |
| Gradient card backgrounds | Gradient ONLY on data viz bars |
| Bright white/cyan chevrons | `Colors.textTertiary` (#666), size 16 |
| Two CTAs for the same action | Single bottom-anchored CTA |
| Inline scrollable lists in dashboard cards | Truncate to 3, add "See All ›" |
| Swipe-to-delete without confirmation | Always pass `deleteConfirmMessage` to `SwipeableRow` |
| `Colors.card` / `Colors.cardBorder` for new code | `Colors.cardSurface` / `Colors.hairlineBorder` |
| `borderRadius: 20+` on cards | Always `borderRadius: 16` |
| Heavy tab controls inside cards | Merge data into one chronological list with micro-icons |
| Tight card padding clipping bottom links | Add `paddingBottom: Spacing.sm` to sections above tappable links |
| Naked text links for standalone actions | Wrap in a Featured Action Card (Vet Report pattern) |

---

## Micro-Icons for Record Types

When displaying mixed record types in a single list, use small differentiating icons:

| Type | Icon (Ionicons) | Color |
|---|---|---|
| Vaccine | `shield-checkmark-outline` | `Colors.accent` |
| Deworming | `fitness-outline` | `Colors.accent` |
| Medication (current) | Status dot: 8px circle | `Colors.severityGreen` |
| Medication (as-needed) | Status dot: 8px circle | `Colors.severityAmber` |
| Medication (past) | Status dot: 8px circle | `Colors.textTertiary` |

### Icon Platters (Appointment Type Icons)

Appointment rows use a circular platter to visually anchor each type:

```typescript
// apptIconCircle style
{
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: Colors.background,  // recessed into card
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: Spacing.sm,
}
// Icon inside: size 18, Colors.accent
```

| Type | Icon (Ionicons) |
|---|---|
| `vet_visit` | `medical-outline` |
| `grooming` | `cut-outline` |
| `medication` | `medkit-outline` |
| `vaccination` | `shield-checkmark-outline` |
| `deworming` | `fitness-outline` |
| `other` | `calendar-outline` |

Map defined as `APPT_ICONS` in `PetHubScreen.tsx` and `AppointmentsListScreen.tsx`.

---

## Swipe Gestures — SwipeableRow

Reusable swipe-to-reveal component for all list rows. Reduces input fatigue — users don't have to open a detail sheet just to delete.

**Component:** `src/components/ui/SwipeableRow.tsx`
**Dependencies:** `react-native-gesture-handler` (Swipeable), `react-native-reanimated` — both already installed.

### Props
| Prop | Type | Required | Description |
|---|---|---|---|
| `children` | `ReactNode` | Yes | The row content (typically a `TouchableOpacity`) |
| `onDelete` | `() => void` | No | Called after user confirms deletion. Parent does the actual delete + state refresh. |
| `onEdit` | `() => void` | No | Called when user taps Edit action. |
| `deleteConfirmMessage` | `string` | No | If provided, shows `Alert.alert` before deleting. **Always provide this.** |
| `deleteLabel` | `string` | No | Default: "Delete" |
| `editLabel` | `string` | No | Default: "Edit" |

### Behavior
- **Swipe left** → red "Delete" action (80px wide, `Colors.severityRed`, white text)
- **Swipe right** → cyan "Edit" action (80px wide, `Colors.accent`, white text) — only if `onEdit` provided
- Delete always fires `deleteConfirm()` haptic from `src/utils/haptics.ts`
- If neither `onDelete` nor `onEdit` is provided, renders children directly (no wrapper)

### Usage Pattern
```typescript
<SwipeableRow
  onDelete={async () => {
    await deleteHealthRecord(record.id);
    reloadData();
  }}
  onEdit={() => openDetailSheet(record)}
  deleteConfirmMessage={`Delete "${record.name}"? This cannot be undone.`}
>
  <TouchableOpacity style={styles.row} onPress={() => openDetailSheet(record)}>
    {/* row content */}
  </TouchableOpacity>
</SwipeableRow>
```

### Already Applied To
| Screen | Row type | Swipe left | Swipe right |
|---|---|---|---|
| `PetHubScreen` | Medical record rows | Delete (`deleteHealthRecord`) | Edit (detail sheet) |
| `PetHubScreen` | Current medication rows | Delete (`deleteMedication`) | Edit (MedicationForm) |
| `PetHubScreen` | Appointment rows | Delete (`deleteAppointment`) | — |
| `MedicalRecordsScreen` | All record rows | Delete (`deleteHealthRecord`) | Edit (detail sheet) |
| `MedicationsListScreen` | All medication rows | Delete (`deleteMedication`) | Edit (MedicationForm) |
| `AppointmentsListScreen` | All appointment rows | Delete (`deleteAppointment`) | Edit (AppointmentDetail) |

### Still Needs SwipeableRow
| Screen | Row type | Delete service function |
|---|---|---|
| `PantryScreen` | PantryCard items | `removePantryItem` from `pantryService.ts` |

### Delete Service Functions Reference
| Data type | Function | File |
|---|---|---|
| Health records | `deleteHealthRecord(id)` | `src/services/appointmentService.ts` |
| Medications | `deleteMedication(id)` | `src/services/petService.ts` |
| Appointments | `deleteAppointment(id)` | `src/services/appointmentService.ts` |
| Pantry items | `removePantryItem(id)` | `src/services/pantryService.ts` |

---

## Legacy Token Migration

When polishing a screen, migrate these legacy tokens:

| Legacy | Replace with | Notes |
|---|---|---|
| `Colors.card` (`#242424`) | `Colors.cardSurface` (`#242424`) | All card backgrounds |
| `Colors.cardBorder` (`#333333`) | `Colors.hairlineBorder` (`rgba(255,255,255,0.12)`) | All borders and dividers |

**Already migrated:** PetHubScreen, PetHubStyles, MedicalRecordsScreen, HealthRecordDetailSheet, MedicationsListScreen, MedicationFormScreen
**Still needs migration:** PantryScreen, PantryCard, HomeScreen, ResultScreen, CompareScreen, EditPantryItemScreen, AppointmentsListScreen, and others — grep for `Colors.card` and `Colors.cardBorder` usage.

---

## Checklist: Polishing Any Screen

When applying this design system to a new screen, verify:

- [ ] Card backgrounds use `Colors.cardSurface` (not `Colors.card`)
- [ ] Card borders use `Colors.hairlineBorder` (not `Colors.cardBorder`)
- [ ] All tappable rows have `chevron-forward` (16px, `Colors.textTertiary`)
- [ ] All tappable rows use `activeOpacity={0.7}`
- [ ] Deletable rows wrapped in `SwipeableRow` with `deleteConfirmMessage`
- [ ] Lists truncated to 3 items max on dashboard cards
- [ ] "See All ›" link present when list is truncated
- [ ] Single "Add" CTA at the bottom of each card (no duplicate header buttons)
- [ ] No glow/shadow effects on cards or avatars
- [ ] Gradients used only on progress/data bars
- [ ] Stat chips are **borderless** (no `borderWidth`) — borders signal interactivity
- [ ] Delete actions require confirmation alerts (via `SwipeableRow` or detail sheet)
- [ ] Bottom sheets use `Colors.cardSurface` background
- [ ] Screen titles use `FontSizes.xxl`, `fontWeight: '800'`
- [ ] No inline styles — all styles in screen's StyleSheet or shared styles file
- [ ] Haptics: `deleteConfirm()` after destructive actions, success haptic after saves
