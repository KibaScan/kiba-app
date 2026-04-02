# MeScreen Premium Polish & Health Record UX Overhaul — v2

Comprehensive overhaul of the PetHubScreen (Me tab) to fix critical interaction bugs, create a unified chronological Medical Records timeline, ensure all records are always tappable/editable/deletable, and apply a **Matte Premium** visual polish.

## Design Mockups (v1 — visual direction only)

> [!NOTE]
> These v1 mockups illustrated the *wrong* visual direction (glows, glassmorphism). The implementation will follow **Matte Premium** principles instead — deep blacks, pristine typography, perfect padding, machined-aluminum card surfaces. The information architecture shown (combined card, tappable rows, action links) is directionally correct.

````carousel
![MeScreen Top Section — Pet summary card with avatar carousel and quick stats](/Users/stevendiaz/.gemini/antigravity/brain/0a2ba1ef-75d6-4cee-be4f-8cd865406ea2/me_screen_top_1775108691803.png)
<!-- slide -->
![MeScreen Bottom Section — Combined health records card with tappable rows and action links](/Users/stevendiaz/.gemini/antigravity/brain/0a2ba1ef-75d6-4cee-be4f-8cd865406ea2/me_screen_bottom_1775108704142.png)
````

---

## Design Philosophy: Matte Premium

No glows. No glassmorphism. No neon borders. The premium feel comes from:

| Principle | Implementation |
|---|---|
| **Deep blacks** | Card background `#1C1C1E`, app background `#1A1A1A` |
| **Hairline inner borders** | `borderColor: rgba(255,255,255,0.08)`, 1px, crisp and opaque |
| **Pristine typography** | Consistent weight hierarchy, generous line height |
| **Perfect padding** | Uniform `Spacing.lg` rhythm, breathing room between cards |
| **Color only for data** | Cyan gradients reserved for progress bars and data visualization |
| **Machined aluminum feel** | Solid matte surfaces, no translucency or blur on cards |

Reference: Apple Health, Oura, Linear

---

## Confirmed Decisions (from review)

1. ✅ **No swipe-to-delete** — Health records are archival. Deletion requires tapping into the detail sheet → red button → confirmation alert. Safety over speed.
2. ✅ **Single chronological "Medical Records" list** — No tabs. Vaccines and dewormings displayed together chronologically with micro-icons (💉 syringe for vaccines, 💊 pill for dewormings) for instant visual parsing.
3. ✅ **Truncation Rule: Top 3 + "See All ›"** — Dashboard card strictly shows the 3 most recent/upcoming records. Below that, a persistent "See All ›" link navigates to a dedicated full-screen timeline.
4. ✅ **Single CTA: bottom-anchored** — One "+ Add Medical Record" text button at the bottom of the card. No redundant header [+] button.
5. ✅ **Matte Premium over Cyberpunk** — No card glows, no glassmorphism, no shadow halos. Solid surfaces, hairline borders, color only for data viz.
6. ✅ **Chevrons: muted and small** — `Colors.textTertiary` (#666), 16px. Rows get `underlayColor: rgba(255,255,255,0.05)` press feedback.

---

## Audit Findings

### Identified Bugs
1. **Vaccines card not tappable after registering** — [PetHubScreen.tsx L758-773](file:///Users/stevendiaz/kiba-antigravity/src/screens/PetHubScreen.tsx#L758-L773): populated vaccine rows use `<View>` not `<TouchableOpacity>`. No `onPress` → dead zone.
2. **Dewormings card same bug** — [PetHubScreen.tsx L788-803](file:///Users/stevendiaz/kiba-antigravity/src/screens/PetHubScreen.tsx#L788-L803): identical issue.
3. **No + button when records exist** — The "Add" link only shows in the empty state. Once one record exists, there's no way to add another.
4. **No edit/delete for health records** — Missing `updateHealthRecord()` and `deleteHealthRecord()` in service layer.

---

## Proposed Changes

### Component 1: Service Layer — CRUD for Health Records

#### [MODIFY] [appointmentService.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/appointmentService.ts)

Add two new functions after `addManualHealthRecord`:

```typescript
export async function updateHealthRecord(
  id: string,
  updates: {
    treatment_name?: string;
    administered_at?: string;
    next_due_at?: string | null;
    vet_name?: string | null;
    notes?: string | null;
  },
): Promise<PetHealthRecord>

export async function deleteHealthRecord(id: string): Promise<void>
```

Both follow existing patterns: `requireOnline()` → Supabase mutation → error handling.

---

### Component 2: Unified "Medical Records" Card

#### [MODIFY] [PetHubScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/PetHubScreen.tsx)

**Remove** the two separate Vaccines (L746-804) and Dewormings (L776-804) cards entirely.

**Replace** with a single **"Medical Records"** card:

```
┌─────────────────────────────────────┐
│ Medical Records                     │
│                                     │
│ 💉 Rabies                      ›   │  ← tappable → detail sheet
│    Apr 2, 2026 — Next: Apr 2, 2027 │
│ ─────────────────────────────────── │
│ 💊 Milbemax                    ›   │
│    Mar 15, 2026                     │
│ ─────────────────────────────────── │
│ 💉 DHPP                        ›   │
│    Jan 10, 2026 — Next: Jan 2029   │
│ ─────────────────────────────────── │
│                                     │
│         See All ›                   │  ← navigates to full timeline
│                                     │
│ ⊕ Add Medical Record               │  ← single CTA, bottom-anchored
└─────────────────────────────────────┘
```

Key behaviors:
- **Chronological sort** — all health records (vaccines + dewormings) merged, sorted by `administered_at` descending
- **Micro-icons** — `shield-checkmark-outline` (Ionicons) for vaccines, `fitness-outline` for dewormings. Styled in `Colors.textTertiary`, 16px, left-aligned
- **Truncation** — strictly show **top 3** records. If >3 exist, show "See All ›" link
- **"See All ›"** — navigates to new `MedicalRecords` full-screen list
- **"+ Add Medical Record"** — full-width text button at bottom, always visible (empty or populated), opens `HealthRecordLogSheet` in manual mode
- **Every row is a `TouchableOpacity`** with chevron-forward icon in `Colors.textTertiary`, `underlayColor: rgba(255,255,255,0.05)`
- **Row onPress** → opens `HealthRecordDetailSheet` with the selected record

---

### Component 3: Health Record Detail/Edit Sheet

#### [NEW] [HealthRecordDetailSheet.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/appointments/HealthRecordDetailSheet.tsx)

Bottom sheet for viewing/editing/deleting a single health record. Follows existing `Modal` + `BlurView` + `ScrollView` pattern from `HealthRecordLogSheet`.

**Fields:**
- Record type indicator (read-only display: "Vaccine" or "Deworming" with icon)
- Treatment name (editable `TextInput`)
- Date administered (date picker)
- Next due (follow-up chip options + custom date)
- Vet / clinic (editable `TextInput`)

**Actions:**
- **Save Changes** (cyan button, full-width, only visible when dirty)
- **Delete Record** (red text link at bottom → `Alert.alert` confirmation → `deleteHealthRecord()`)

---

### Component 4: Full-Screen Medical Records Timeline

#### [NEW] [MedicalRecordsScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/MedicalRecordsScreen.tsx)

Full-screen `FlatList` showing all health records for the active pet, sorted chronologically. Follows the established pattern from `AppointmentsListScreen.tsx`:

- Header with back arrow + title "Medical Records" + [+] add button
- Each row: micro-icon + treatment name + date + next due + vet → tappable → `HealthRecordDetailSheet`
- Empty state: icon + "No records yet" + "Add your pet's first record" CTA
- Bottom sheet instance of `HealthRecordDetailSheet` for inline editing

#### [MODIFY] [navigation.ts](file:///Users/stevendiaz/kiba-antigravity/src/types/navigation.ts)

Add route to `MeStackParamList`:
```typescript
MedicalRecords: undefined;
```

---

### Component 5: Appointments Card — Always Accessible

#### [MODIFY] [PetHubScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/PetHubScreen.tsx)

The Appointments card (L806-846) already uses `TouchableOpacity` with navigation — but improve:

- **Always show** "+ Schedule an appointment" add link below the appointment rows (not just in empty state)
- **Always show** "See All ›" link at bottom when any appointments exist (navigates to `Appointments` list)
- **Truncation**: show max 3 upcoming appointments in the card (already doing `.slice(0, 3)`)
- Add chevron-forward on each row (already present on the header, add to each row)

---

### Component 6: Matte Premium Visual Polish

#### [MODIFY] [PetHubStyles.ts](file:///Users/stevendiaz/kiba-antigravity/src/screens/pethub/PetHubStyles.ts)

| Element | Current | Polished |
|---|---|---|
| **Card background** | `Colors.card (#242424)` | `#1C1C1E` — plush, deep, Apple-dark |
| **Card border** | `Colors.cardBorder (#333)` | `rgba(255,255,255,0.08)` — crisp hairline |
| **Card border radius** | `16` | Keep `16` — don't inflate to 20 |
| **Carousel active avatar** | 2px cyan border flush to photo | 2px solid cyan ring with **3px transparent gap** between photo and ring (Story Ring cutout effect) |
| **Carousel avatar** | No shadow | Keep no shadow — matte |
| **Score accuracy bar** | Flat `Colors.accent` fill | `expo-linear-gradient` fill: `#00B4D8` → `#0077B6` — color reserved for data |
| **Stat chips** | Flat `Colors.card` background | Same matte surface with hairline border `rgba(255,255,255,0.08)` |
| **Record rows** | `<View>`, no feedback | `<TouchableOpacity>` with `underlayColor: rgba(255,255,255,0.05)` |
| **Chevrons** | Missing on most rows | `Colors.textTertiary (#666)`, size 16, right-aligned |
| **Section spacing** | Tight in places | Consistent `Spacing.md` (16px) between all cards |
| **Summary card border** | `Colors.cardBorder` | Hairline `rgba(255,255,255,0.08)` — no accent glow |

#### [MODIFY] [constants.ts](file:///Users/stevendiaz/kiba-antigravity/src/utils/constants.ts)

Add new tokens (don't break existing references):
```typescript
cardSurface: '#1C1C1E',        // Matte premium card surface
hairlineBorder: 'rgba(255,255,255,0.08)',  // Crisp inner border
pressOverlay: 'rgba(255,255,255,0.05)',    // Touch feedback
```

---

### Component 7: Medications Card Consistency

#### [MODIFY] [PetHubScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/PetHubScreen.tsx)

- Add muted chevron-forward icon (16px, `Colors.textTertiary`) to each medication row
- Ensure consistent card styling with new matte premium tokens
- No other structural changes — the Medications card pattern is already correct (tappable rows → `MedicationForm`)

---

## Summary of All Changes

| File | Change | Purpose |
|---|---|---|
| `appointmentService.ts` | MODIFY | Add `updateHealthRecord`, `deleteHealthRecord` |
| `PetHubScreen.tsx` | MODIFY | Remove separate Vaccine/Deworming cards → unified Medical Records card, improve Appointments card, add chevrons |
| `HealthRecordDetailSheet.tsx` | NEW | Bottom sheet for editing/deleting individual health records |
| `MedicalRecordsScreen.tsx` | NEW | Full-screen timeline for "See All ›" |
| `navigation.ts` | MODIFY | Add `MedicalRecords` route |
| `PetHubStyles.ts` | MODIFY | Matte Premium polish pass |
| `constants.ts` | MODIFY | Add 3 new color tokens |
| Navigator (App.tsx or similar) | MODIFY | Register `MedicalRecordsScreen` in MeStack |

---

## Verification Plan

### Automated Tests
- Run iOS Simulator (`/ios` workflow)
- Verify all record rows respond to tap → sheet opens
- Test full CRUD: Add → Edit → Save → Delete for health records
- Confirm truncation: add 5+ records, verify only 3 show on dashboard

### Manual Verification
1. Register a vaccine → confirm the row appears in Medical Records, is tappable → edit sheet → modify name → save → verify update
2. Register a deworming → confirm it appears interleaved chronologically with vaccines, correct micro-icon
3. Delete a health record → confirm alert → confirm disappears from both dashboard and full timeline
4. Tap "See All ›" → full-screen timeline → verify all records visible and tappable
5. Appointments card: tap row → detail → modify → save → delete. Verify "+ Schedule" and "See All ›" always visible
6. Visual audit: no glows, no gradients on cards, hairline borders, matte surfaces, gradient only on accuracy bar
7. Press feedback: tap a row → confirm subtle flash (`rgba(255,255,255,0.05)`)
