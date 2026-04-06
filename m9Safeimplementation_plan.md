# Safe Switch — Premium UI/UX Overhaul

The Safe Switch Detail Screen (`SafeSwitchDetailScreen.tsx`) is the daily command center for a 7-10 day food transition. It's opened every day during the switch — the single highest-frequency screen in the app during that window. The current UI has typographic collisions, wireframe-era button styles, missing positive reinforcement, and no handling for missed days. This plan transforms it into a premium medical protocol experience.

## Design Mock

![Safe Switch Redesign](/Users/stevendiaz/.gemini/antigravity/brain/4c799b72-c2a5-473b-870b-327e5cc6747a/safe_switch_redesign_1775412634761.png)

## User Review Required

> [!IMPORTANT]
> **Tab bar hiding**: The plan hides the global tab bar on SafeSwitchDetailScreen to create a focused protocol experience. This matches the CompareScreen precedent (`navigation.getParent().setOptions({ tabBarStyle: { display: 'none' } })`). Confirm this is desired — it locks the user into the flow.

> [!IMPORTANT]
> **Retroactive logging bottom sheet**: Days 2-5 in the screenshots show as "missed" with no way to backfill. The plan adds a tap handler on missed timeline rows that slides up a bottom sheet: *"Forgot to log? How was Luna's digestion on Day 4?"* with the same 3 tummy pills. This is a retention hack — if users see 4 missed days they feel like they failed and abandon the feature. Confirm you want retroactive logging.

> [!IMPORTANT]
> **"Complete Day" vs "Complete Switch"**: Currently, the only positive CTA is "Complete Switch" which only appears on the final day AND only after logging. The plan adds a daily "Complete Day N" CTA that appears after the tummy check is logged, providing positive reinforcement every day. On the final day, it becomes "Complete Switch". Confirm you want this daily completion concept.

## Proposed Changes

### Phase 1 — Typography & Recipe Layout (Today's Mix card)

#### [MODIFY] [SafeSwitchDetailScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/SafeSwitchDetailScreen.tsx)

**Fix 1: Typographic collision** — The `proportionLabels` row currently crams cups + truncated product name + percentage ratio into a single horizontal line. This creates the `0.6 cups Basics Skin & ...25% / 75%1.8 cups Amazing Grains...` mess visible in the screenshots.

Replace the horizontal `proportionLabels` layout with a vertical "Recipe" layout:

```diff
-<View style={styles.proportionLabels}>
-  {todayMix.oldPct > 0 && (
-    <Text style={styles.proportionLabel}>{oldCups} cups {truncate(oldName, 15)}</Text>
-  )}
-  <Text style={styles.proportionRatio}>
-    {todayMix.newPct === 100 ? '100%' : `${todayMix.oldPct}% / ${todayMix.newPct}%`}
-  </Text>
-  <Text style={styles.proportionLabel}>{newCups} cups {truncate(newName, 15)}</Text>
-</View>
+{/* Recipe layout — vertical, color-coded to match proportion bar */}
+<View style={styles.recipeLayout}>
+  {todayMix.oldPct > 0 && (
+    <View style={styles.recipeLine}>
+      <View style={[styles.recipeDot, { backgroundColor: Colors.severityAmber }]} />
+      <Text style={styles.recipeAmount}>{oldCups} cups ({todayMix.oldPct}%)</Text>
+      <Text style={styles.recipeSep}>·</Text>
+      <Text style={styles.recipeBrand}>{oldProduct.brand}</Text>
+    </View>
+  )}
+  <View style={styles.recipeLine}>
+    <View style={[styles.recipeDot, { backgroundColor: Colors.severityGreen }]} />
+    <Text style={styles.recipeAmount}>{newCups} cups ({todayMix.newPct}%)</Text>
+    <Text style={styles.recipeSep}>·</Text>
+    <Text style={styles.recipeBrand}>{newProduct.brand}</Text>
+  </View>
+</View>
```

New styles:
```typescript
recipeLayout: { gap: 8, marginTop: 4 },
recipeLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
recipeDot: { width: 8, height: 8, borderRadius: 4 },
recipeAmount: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary },
recipeSep: { fontSize: FontSizes.sm, color: Colors.textTertiary },
recipeBrand: { fontSize: FontSizes.sm, color: Colors.textSecondary },
```

---

### Phase 2 — Tummy Check Buttons + Product Staging

**Fix 2: Wireframe tummy pills → Premium hardware buttons**

Current: Hollow gray outlines with `borderColor: transparent` and `backgroundColor: Colors.cardBorder`. Active state: thin colored border + faint tint. Looks like a developer wireframe.

New pattern per `.agent/design.md` Stat Chip philosophy (solid fills, no hollow outlines):

```typescript
// Inactive state — solid plush dark fill, no border
tummyPill: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  paddingVertical: 12,
  borderRadius: 12,
  backgroundColor: '#1C1C1E',  // slightly recessed, physical feel
  borderWidth: 1.5,
  borderColor: 'transparent',
},

// Active "Perfect" — soft green tint + solid border + bright text
// Applied inline: { backgroundColor: rgba(74, 222, 128, 0.15), borderColor: Colors.severityGreen }

// Active "Soft Stool" — soft amber tint + solid border
// Active "Upset" — soft red tint + solid border
```

**Fix 3: Product image staging** — Raw JPEGs floating on dark background → white staging boxes.

```diff
-<Image source={{ uri: oldProduct.image_url }} style={styles.comparisonImage} />
+<View style={styles.imageStage}>
+  <Image source={{ uri: oldProduct.image_url }} style={styles.comparisonImage} />
+</View>
```

```typescript
imageStage: {
  width: 56, height: 56,
  borderRadius: 10,
  backgroundColor: '#FFFFFF',
  padding: 4,
  justifyContent: 'center',
  alignItems: 'center',
},
comparisonImage: {
  width: 48, height: 48,
  borderRadius: 8,
  resizeMode: 'contain',
},
```

**Fix 4: Score badge positioning** — Move the new product's score badge to centered between the two products (under the arrow), framing the narrative: "Old Food → 91% Match → New Food". Only show the new product score (the one they're switching TO — that's the one that matters).

**Fix 5: Delete "Switching for Luna" floating text** — Replace with header change: `"Safe Switch"` → `"{petName}'s Safe Switch"`. The floating text in `Colors.textTertiary` between cards is invisible and purposeless.

---

### Phase 3 — Timeline Overhaul + Retroactive Logging

**Fix 6: 4-state timeline architecture**

| State | Visual | Text Style |
|-------|--------|------------|
| **Completed** (logged) | Solid green circle with white `✓` checkmark | `Colors.textSecondary` (normal) |
| **Active** (today) | Cyan dot, 12px, subtle glow | `Colors.accent`, `fontWeight: '700'`, highlighted row |
| **Missed** (past, no log) | Hollow gray ring (stroke only, no fill) | `Colors.textTertiary` (dimmed) + "(Missed)" suffix |
| **Future** | Solid dark gray dot | `Colors.textTertiary` (dimmed) |

Current code at line 373-378 only distinguishes 3 states (completed, active, future — missed days look identical to completed-but-unlogged). The fix adds explicit detection:

```typescript
const isMissed = isPast && !log?.tummy_check;

// Missed dot: hollow ring
isMissed && { 
  backgroundColor: 'transparent', 
  borderWidth: 1.5, 
  borderColor: Colors.textTertiary,
}
```

**Fix 7: Missed day text dimming + "(Missed)" tag**

```typescript
// In timeline row text
<Text style={[
  styles.timelineDay,
  isMissed && { color: Colors.textTertiary },
]}>
  Day {entry.day}: {entry.phase}{isMissed ? ' (Missed)' : ''}
</Text>
```

**Fix 8: Retroactive logging (retention hack)**

Make missed timeline rows tappable. On tap, show a bottom sheet with the 3 tummy pills:

```
─────────────────────────────
  Forgot to log?

  How was Luna's digestion
  on Day 4?

  [  Perfect  ] [Soft Stool] [  Upset  ]
─────────────────────────────
```

Implementation:
- New state: `retroDay: number | null` (which past day the bottom sheet is open for)
- Missed rows wrapped in `TouchableOpacity` → `setRetroDay(entry.day)`
- Sheet calls existing `logTummyCheck(switchId, retroDay, check)` then refreshes
- After logging, the hollow ring becomes a solid green check → dopamine hit, streak restored

**Fix 9: Consecutive missed days amber warning**

New helper function in `safeSwitchHelpers.ts`:

```typescript
export function getConsecutiveMissedDays(
  logs: { day_number: number; tummy_check: string | null }[],
  currentDay: number,
): number {
  let consecutive = 0;
  for (let d = currentDay - 1; d >= 1; d--) {
    const log = logs.find(l => l.day_number === d);
    if (!log || !log.tummy_check) consecutive++;
    else break;
  }
  return consecutive;
}
```

If `consecutiveMissed >= 2`, render an amber warning banner above Today's Mix:

```
⚠️ You missed several logs. If you haven't been mixing
the food, consider restarting the schedule to prevent
stomach upset. [Restart] [I was mixing]
```

- "Restart" → cancels current switch, navigates to SafeSwitchSetupScreen with same products
- "I was mixing" → dismisses (stored in local state, not persisted — it reappears next day if still missed)

> [!WARNING]
> D-095 compliance: The warning text must be factual and informational. It cannot say "your dog will get sick." The copy above uses "consider restarting" which is a suggestion, not a directive. "Prevent stomach upset" is borderline — we could soften to "reduce the risk of digestive discomfort."

---

### Phase 4 — CTA Hierarchy + Tab Bar + Matte Premium Polish

**Fix 10: "Complete Day" victory CTA**

Replace the bottom `actionsRow` with a sticky bottom bar pattern:

```
┌─────────────────────────────────┐
│   ✓  Complete Day 6             │  ← Full-width cyan CTA
├─────────────────────────────────┤
│      Pause  ·  Cancel           │  ← Muted text links
└─────────────────────────────────┘
```

- CTA appears after tummy check is logged for today → state: `todayLogged`
- Before logging: CTA is disabled/dimmed with text "Log today's Tummy Check first"
- On final day: CTA text becomes "Complete Switch" and calls `handleComplete()`
- On non-final days: CTA calls a new `handleDayComplete()` that provides haptic feedback + brief success animation (the timeline dot turns green) but does NOT advance the day — the day advances based on the calendar
- Pause and Cancel become text-only links below: `Colors.textTertiary`, `fontWeight: '600'`
- Cancel text uses `Colors.severityRed`

**Fix 11: Hide tab bar**

```typescript
useEffect(() => {
  const parent = navigation.getParent();
  parent?.setOptions({ tabBarStyle: { display: 'none' } });
  return () => {
    parent?.setOptions({ tabBarStyle: undefined });
  };
}, [navigation]);
```

Matches `CompareScreen` precedent.

**Fix 12: Matte Premium card anatomy**

Migrate all cards to canonical anatomy:

| Card | Current | Fix |
|------|---------|-----|
| `comparisonCard` | `Colors.card` + `Colors.cardBorder` | `Colors.cardSurface` + `Colors.hairlineBorder` |
| `todayCard` | `Colors.card` + accent border | `Colors.cardSurface` + `Colors.hairlineBorder` + subtle `accent` left border accent (3px) |
| `tummyCard` | `Colors.card` + `Colors.cardBorder` | `Colors.cardSurface` + `Colors.hairlineBorder` |
| `actionButton` | `Colors.card` + `Colors.cardBorder` | Removed — replaced by text links |
| Timeline `timelineContentActive` | `${Colors.accent}10` | Keep — subtle highlight is correct |
| Timeline future line | `Colors.cardBorder` | `Colors.hairlineBorder` |

All cards: `borderRadius: 16`, `padding: Spacing.md`.

---

## Additional Improvements (beyond Gemini feedback)

### A. Progress ring on header
Add a subtle day progress indicator to the header subtitle area — small horizontal bar showing `currentDay / totalDays` progress. Lightweight, doesn't compete with the DayRing on PantryScreen's banner.

### B. Tummy check history on timeline
For completed days (green check), show a tiny icon next to the day text indicating the result: green dot for "perfect", amber for "soft stool", red for "upset". Quick visual scan of the pet's digestion trend.

### C. Celebration animation on day complete
When user taps "Complete Day N", brief haptic (`successNotification`) + the timeline dot for today animates from cyan → green with a subtle scale pop. Uses `LayoutAnimation.configureNext` (already used elsewhere in the screen).

### D. Today's Mix card left border accent
Add a 3px left border in `Colors.accent` to the Today's Mix card (same pattern as the Setup screen's `productCard` which uses `borderLeftColor`). This makes Today's Mix the visual anchor — the card that matters most.

---

## Open Questions

> [!IMPORTANT]
> **"Complete Day" behavior on non-final days**: What should this actually do? Options:
> 1. **Feedback only** — haptic + dot animation, no state change. The day just ends when the calendar moves forward. Simple, no new DB writes.
> 2. **Mark day as explicitly complete** — new `is_day_complete` column on `safe_switch_logs`. Enables the "missed" state to distinguish "didn't open app" from "opened but didn't complete". More complex.
>
> I recommend Option 1 for now — the tummy check log IS the completion signal.

> [!IMPORTANT]  
> **Restart behavior from amber warning**: Should "Restart" create a brand new `safe_switches` row (cancels old, creates new with same product pair), or should it reset `started_at` on the existing row? New row is cleaner (preserves history) but requires the unique constraint to allow it (cancel old first).

## Verification Plan

### Automated Tests
- Run `npx jest --watchAll=false` to verify no regressions (1335 tests)
- Verify regression anchors unaffected (scoring engine untouched)

### Manual Verification
- **Visual QA on iOS simulator**: Walk through a full Safe Switch flow
  - Day 1: Fresh start → verify recipe layout readable
  - Day 6 scenario: Verify missed days show hollow rings + "(Missed)" tags
  - Tap missed day → verify bottom sheet opens → log → verify ring turns green
  - Log tummy check → verify "Complete Day" CTA appears
  - Verify tab bar hidden on screen, returns on back-navigate
  - Verify amber warning when 2+ consecutive missed days
  - Walk vet diet / recalled product bypass paths aren't affected
- **Screen recording**: Capture the full flow for review

### Files Modified
| File | Changes |
|------|---------|
| `src/screens/SafeSwitchDetailScreen.tsx` | Complete UI overhaul — all 12 fixes |
| `src/utils/safeSwitchHelpers.ts` | New `getConsecutiveMissedDays()` function |
| `src/screens/SafeSwitchSetupScreen.tsx` | Legacy token migration (`Colors.card` → `cardSurface`, `Colors.cardBorder` → `hairlineBorder`) |
| `src/components/pantry/SafeSwitchBanner.tsx` | No changes needed (already migrated session 20) |
| `__tests__/utils/safeSwitchHelpers.test.ts` | New test for `getConsecutiveMissedDays()` |
