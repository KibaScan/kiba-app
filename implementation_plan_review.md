## Implementation Plan Review

I reviewed the implementation plan against the codebase, specifically focusing on the `Safe Switch` handoff integration between the recently shipped Phase B (Pantry Coupling) and this proposed Phase C (Add to Pantry Redesign).

There is a **massive architectural conflict** between the Phase C spec and the existing Phase B implementation that needs to be addressed before writing any code.

### The Conflict: Safe Switch Execution & Pantry Duplication

The Phase C spec states:
> When user taps "Yes, this is new" + "Start Safe Switch":
> 1. Add to pantry — the product is added with the auto-computed serving... Returns the new `pantry_items` row.
> 2. Navigate — close the sheet, cross-navigate to SafeSwitchSetupScreen with `pantryItemId` (old product) and `newProductId`.

However, the **Phase B implementation** (`031_safe_switch_pantry_coupling.sql` and `safeSwitchService.ts`) handles pantry integration differently:
1. It expects the new food to **NOT** be in the pantry during the 7-day transition.
2. When the switch completes, the atomic RPC `complete_safe_switch_with_pantry_swap` overwrites the **old** `pantry_items.product_id` with the `new_product_id` (in-place replacement).

**If we follow the Phase C plan exactly as stated:**
1. **Double Counting:** The new food is added to the pantry as `is_active = true` on Day 1. It will immediately show up in their pantry alongside the old food, messing up DER calculations and pantry UI while the transition is happening.
2. **Duplication:** On Day 7, when the Safe Switch completes, Phase B's RPC will mutate the *old* pantry item into the new product. The user will end up with **two identical pantry items** for the new food.

### The Missing Calorie Bug

Phase B's in-place RPC swap (`complete_safe_switch_with_pantry_swap`) only updates the `product_id` and sets `quantity_remaining = 0`. It **does not update** the `serving_size` in `pantry_pet_assignments`! 
Because Phase C auto-computes the perfect serving size based on the new product's kilocalorie density, this new serving size is completely lost if we just pass `newProductId` to Phase B. The pet will end up consuming the *old food's serving size* of the *new food*, which could lead to severe over/underfeeding.

---

## Proposed Paths Forward

To fix this gap, we must choose how we want Safe Switch to handle the new food's computed serving.

### Option 1: Enhance Phase B (Schema Update)
**Do not** add the food to the pantry on Day 1. Instead, carry the Phase C auto-computed values into the Safe Switch.
- Pass the newly calculated `targetServingSize` and `targetFeedingsPerDay` from the AddToPantrySheet directly to `SafeSwitchSetupScreen` as navigation params.
- Create Migration 032 to add `new_serving_size` and `new_feedings_per_day` to the `safe_switches` table.
- Modify the atomic RPC `complete_safe_switch_with_pantry_swap` to read these new columns and apply them to `pantry_pet_assignments` at completion.

### Option 2: Pending Pantry Item (Flow Update)
Let Phase C add the item to the pantry gracefully.
- Add the new product to the pantry in Phase C, but as `is_active = false` (or a `pending_transition` flag). This stores the auto-computed serving safely without polluting the active pantry calculation.
- Pass `newPantryItemId` (instead of just product ID) to `SafeSwitchSetupScreen`.
- Modify the Phase B RPC: instead of mutating the old item's product ID, it *deletes* the old pantry item and marks the *new* pantry item as `is_active = true`.

I recommend **Option 1**, as it keeps the pantry table perfectly clean (current foods only) and treats the `safe_switches` row as the single source of truth for the transition state.

Let me know how you want to resolve this architectural collision!
