# D-124 Revision: Treat Logging — Quick Picker, Not Scanner

> Append to DECISIONS.md after approval. Revises D-124 treat logging entry points.

---

### D-124 (Revised): Treat Logging — Quick Picker Default, Scanner Fallback
**Status:** LOCKED
**Date:** March 21, 2026
**Supersedes:** D-124 original (scanner-first treat logging)
**Depends on:** D-163 (health records pattern — completion-moment capture), Treat Battery (Phase 2)
**Milestone:** M5 polish

**Problem:** "Log a Treat" on PetHubScreen opens the barcode scanner. 90% of the time, the user is giving a treat they already have in their pantry — opening a camera to scan something already tracked is unnecessary friction. The scanner makes sense for new treats, not repeat treats.

**Decision:** "Log a Treat" opens a **quick picker sheet** listing the pet's existing pantry treats. One tap to log. Scanner is a fallback option at the bottom.

**Quick picker flow:**

1. User taps "Log a Treat" on PetHubScreen (below TreatBatteryGauge)
2. Bottom sheet slides up: "Log a Treat for [Pet Name]"
3. List of active pantry treats for this pet:
   - Product image (40×40) + name (1-line clamp) + servings remaining
   - Tap → immediately calls `logTreat(pantryItemId)`:
     - Deducts 1 from `quantity_remaining`
     - Deducts `kcal_per_unit` from Treat Battery daily budget (if kcal available)
     - Toast: "Logged 1 [Product Name]"
     - Sheet closes
   - One tap. No confirmation dialog. Undo via toast action if needed.
4. At bottom of list: **"Scan a new treat"** link → navigates to ScanScreen with `{ treatMode: true }`
5. Empty state (no treats in pantry): "No treats in [Pet Name]'s pantry yet. Scan one to start tracking." + "Scan a Treat" button → ScanScreen

**ScanScreen treat mode (when navigated from quick picker):**
- After scan, if `product.category === 'treat'` → open AddToPantrySheet with treat defaults
- After adding → return to PetHubScreen (not stay on ResultScreen)
- If `product.category !== 'treat'` → normal ResultScreen flow (user scanned food, not a treat)
- Always starts fresh scanner — never reopens last scan result

**PantryCard "Gave a treat" button (unchanged):**
- Already exists on treat pantry cards from Phase 2 Session 10
- Tapping it calls the same `logTreat()` — deduct 1, deduct kcal, toast
- This is the alternate path for logging from the pantry screen instead of PetHubScreen

**Multi-pet:** Quick picker shows treats assigned to the **active pet** only. Switching active pet changes the list.

**Design:**
- Bottom sheet, dark theme, D-084 Ionicons only
- Treat rows: compact, tappable, immediate action
- Servings count in muted text: "12 servings left" / "3 servings left" (amber) / "Empty" (grayed)
- Empty treats are visible but not tappable (can't log from an empty bag)
- No score shown in picker — this is a logging action, not an evaluation moment

**Component:** `src/components/treats/TreatQuickPickerSheet.tsx`

**Props:**
```typescript
{
  visible: boolean;
  petId: string;
  petName: string;
  onClose: () => void;
  onScanNew: () => void;  // navigates to ScanScreen
}
```

**What this does NOT change:**
- Treat Battery math — unchanged
- Pantry depletion — unchanged, `logTreat()` is the same function
- Scoring — unchanged
- AddToPantrySheet — unchanged
- PantryCard "Gave a treat" button — unchanged (alternate entry point)

**Rejected:**
- ❌ Always open scanner (original D-124) — 90% of treat logs are for products already in pantry. Camera is friction for repeat actions.
- ❌ Confirmation dialog before logging — "Are you sure?" on a treat log is hostile. One tap to log, undo via toast if needed.
- ❌ Quantity picker (log 2, log 3) — overcomplicates the common case. User taps once per treat given. Multiple treats = multiple taps. Simple.
- ❌ Quick picker on PantryScreen — PetHubScreen is where TreatBatteryGauge lives, so that's where logging lives. PantryCard button covers the pantry screen path.
