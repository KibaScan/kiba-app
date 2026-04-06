## UI Improvements & Refinements Review

To ensure the Phase C UI is as frictionless and intuitive as possible—and to align it with the Matte Premium design system—here are 4 distinct UI improvements we should incorporate into the design before implementation:

### 1. Fix the "Dual CTA" Problem (Safe Switch Flow)
**Current Design:** When the user taps "Yes" (new to diet), an amber advisory card appears with a "Start Safe Switch →" link. But the main bottom button still says "Add to Pantry". This presents two competing primary actions.
**Improvement:** When "Yes" is selected (and a Safe Switch is valid), **morph the main bottom button** into "Start Safe Switch". 
- The advisory card loses the text link and just contains the medical warning.
- The bottom button becomes `Colors.accent` (cyan) and says "Continue to Safe Switch".
- This ensures users don't skip the serving size configuration and forces them down the correct golden path.

### 2. Guide Users on the Stepper Ceiling
**Current Design:** If a pet eats 2 meals, and they add a second food, the stepper defaults to `1` and caps at `1`. The `[+]` button is disabled. 
**Improvement:** If the user taps the disabled `[+]` button (trying to make the new food cover 2 meals), we should show a brief inline toast or hint: *"To replace the current food entirely, select 'Yes' above to start a Safe Switch."* 
This explains *why* the button is disabled and educates them on the Safe Switch feature.

### 3. Clearer "Math" Explanation for Mixed Bowls
**Current Design:** The math line says: `431 kcal remaining of 862 kcal budget ÷ 1 meal`.
**Improvement:** Some users mix both foods into every bowl rather than feeding them as separate meals. If we force "1 meal," we imply they only feed it once a day. 
We should clarify the text slightly: `431 kcal daily allocation (50%)`. This avoids the strict definition of "1 meal = 1 separate feeding event", which gives them the flexibility to mix it if they want.

### 4. Distinct "Manual Override" State
**Current Design:** Tapping the auto serving turns it into a manual input.
**Improvement:** When overriding, the UI needs to heavily signal that they've disconnected from the DER auto-pilot. 
- The blue `AUTO` badge should flip to an outlined grey `MANUAL` badge.
- A cyan text link `"Reset to Auto"` must appear beneath the input to allow them to easily undo their override.
- The math formula line should dim or be replaced by `"Custom serving size — calorie budget unmanaged."` to emphasize they are overriding the veterinarian logic.

These refinements will tighten the UX and prevent confusion around the primary action when a Safe Switch is needed.
