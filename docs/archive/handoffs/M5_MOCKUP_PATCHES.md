# M5 Spec Patches — From Antigravity Mockup Review

> Apply these to PANTRY_SPEC.md, M5_PROMPT_GUIDE_PART1.md, and rules.md
> before starting M5 Session 1.

---

## Patch 1: Per-Pet Score in Share Picker

**What:** SharePantrySheet shows each pet's score for the shared product next to their name. Different pets may have different scores due to D-129 allergen overrides, breed modifiers, and life stage.

**Why:** Answers "should I share this with Luna?" at a glance. A 63% match (amber) next to Luna vs 82% (green) next to Buster is immediate decision context.

**Files to update:**

### PANTRY_SPEC.md — §7 Multi-Pet Behavior
Add after "Display: Shared by Buster & Milo · ~13 days remaining":
```
- Share picker shows each pet's per-pet score next to their name
  (colored badge via getScoreColor()). Score resolved from
  pet_product_scores cache or most recent scan. If no score
  available for that pet, show "Not scored" in muted text.
```

### M5_PROMPT_GUIDE_PART1.md — Session 3 Prompt 3 (SharePantrySheet)
Add to the pet row description:
```
   - Each pet row also shows their per-pet score for this product:
     colored badge "[X]% match" via getScoreColor(). Resolved from
     pet_product_scores or scans table. Helps user decide whether
     sharing makes sense for that pet. If no score exists for that
     pet + product combination, show "Not scored" in muted text.
```

### rules.md — Share Pantry Sheet section, Pet List
Add to the pet row table:
```
| Per-pet score | "[X]% match" colored badge | Score from cache or scan. Helps decide if sharing makes sense. |
```

---

## Patch 2: Recalled Edit Screen Behavior

**What:** When editing a recalled pantry item, Feeding and Schedule sections are disabled (grayed out). Restock button is hidden. Only Quantity (for return/refund tracking), "View Recall Details" link, and "Remove from Pantry" are active.

**Why:** Showing editable feeding times for a recalled product contradicts the recall warning. Nobody restocks a recalled product.

**Files to update:**

### PANTRY_SPEC.md — §3b Edit
Add after "NOT editable: product itself":
```
**Recalled item edit behavior (D-158):**
- Quantity section: editable (user may need to track amount for return/refund)
- Feeding section: disabled, muted at 40% opacity
- Schedule section: disabled, muted at 40% opacity
- Depletion breakdown: not shown
- "View Recall Details" link shown above actions → navigates to RecallDetailScreen
- Actions: Remove from Pantry only. Restock and Share hidden.
```

### M5_PROMPT_GUIDE_PART1.md — Session 3 Prompt 3 (EditPantryItemScreen)
Add to the editable fields section:
```
   Recalled item state:
   - Quantity card: editable (return/refund tracking)
   - Feeding card: disabled, 40% opacity overlay, not interactive
   - Schedule card: disabled, 40% opacity overlay, not interactive
   - Depletion summary: hidden
   - "View Recall Details" link above actions → RecallDetailScreen
   - Actions: only "Remove from Pantry" shown. Restock and Share hidden.
```

### rules.md — Edit Pantry Item Screen section, Design Notes
Add:
```
- **Recalled state:** Feeding and Schedule cards disabled (40% opacity). Restock and Share hidden. Only Quantity (for return tracking) + "View Recall Details" + Remove shown.
```

---

## Patch 3: Empty Edit Screen Behavior

**What:** When editing an empty pantry item (quantity = 0), Feeding and Schedule sections are muted at reduced opacity (still technically editable for when user restocks, but visually de-emphasized). Restock is the highlighted primary action.

**Why:** You can't configure feeding for an empty bag — the primary intent is to restock or remove.

**Files to update:**

### PANTRY_SPEC.md — §3b Edit
Add after the recalled item edit behavior:
```
**Empty item edit behavior (D-155):**
- Quantity section: editable (user can manually enter remaining if bag isn't truly empty)
- Feeding section: muted at 60% opacity (editable but de-emphasized — settings preserved for restock)
- Schedule section: muted at 60% opacity (same — preserved for restock)
- Depletion breakdown: shows "Empty" instead of days remaining
- Actions: Restock is primary (accent fill, not outlined). Share and Remove shown normally.
```

### M5_PROMPT_GUIDE_PART1.md — Session 3 Prompt 3 (EditPantryItemScreen)
Add to the editable fields section:
```
   Empty item state:
   - Quantity card: editable (manual correction)
   - Feeding card: 60% opacity, still editable (settings preserved for restock)
   - Schedule card: 60% opacity, still editable
   - Depletion summary: "1.5 cups × 2 feedings = 3 cups/day · Empty"
   - Actions: Restock is primary (accent filled button, not outlined).
     Share and Remove shown normally.
```

### rules.md — Edit Pantry Item Screen section, Design Notes
Add:
```
- **Empty state:** Feeding and Schedule cards at 60% opacity (still editable — settings preserved for when user restocks). Restock button is primary (accent fill). Depletion shows "Empty."
```

---

## Patch 4: Remove Premium Badge from Share

**What:** Remove all "Premium" badges, premium checks, and `canSharePantryItem()` references from the share flow. Sharing is naturally gated by the pet limit (D-052) — free users have 1 pet, so sharing is impossible. No explicit premium gate needed.

**Why:** The best paywall is invisible. The user hits a natural limit, not a payment prompt.

**Files to update:**

### PANTRY_SPEC.md
- §7 Multi-Pet Behavior: remove "Share check via `permissions.ts` — `canSharePantryItem()`". Replace with: "Sharing is naturally gated — requires 2+ pets of the same species. Free users have 1 pet (D-052), so sharing is unreachable without premium. No explicit premium check in code."
- §12 Test Requirements: remove "Sharing gated by `permissions.ts` premium check". Replace with: "Share sheet shows 'requires 2+ same-species pets' message when no eligible pets exist"

### M5_PROMPT_GUIDE_PART1.md — Session 3 Prompt 3
- Remove: "Gated by canSharePantryItem() — add this to permissions.ts"
- Remove: "Share option hidden for free users (or shows paywall on tap)"
- Replace with: "Share button always visible, always tappable. If no same-species pets exist, sheet opens and shows: 'No other [dogs/cats] to share with. Sharing requires 2 or more pets of the same species — dog and cat nutritional needs are fundamentally different.' No premium badge. No canSharePantryItem() check. Natural gating via D-052 pet limit."
- Remove from verification: "Share blocked for free users"
- Replace with: "Share sheet shows species message when no eligible pets"

### rules.md
- Share Pantry Sheet Header: remove "Premium badge — sharing is premium-only"
- Replace with: "No premium badge. Sharing is naturally gated by pet limit (D-052) — free users have 1 pet."
- Edit Pantry Item Screen Actions table: remove "+ premium badge" from Share row

### M5_PROMPT_GUIDE_PART2.md — Session 11 Compliance Audit
- Remove the `canSharePantryItem()` check from any audit grep

### M5_DECISIONS_D152_D158.md — D-154
- Remove rule 6: "Sharing gated by `canSharePantryItem()` in `permissions.ts` (premium check)"
- Replace with: "Sharing naturally gated — requires 2+ same-species pets. Free users limited to 1 pet (D-052), making sharing unreachable without premium. No explicit permission check needed."

### CLAUDE_MD_M5_PATCH.md
- Remove `canSharePantryItem()` from any permissions.ts references

### KIBA_DEV_SKILL_M5_PATCH.md
- Update sharing rule to natural gating, remove `canSharePantryItem()` reference
