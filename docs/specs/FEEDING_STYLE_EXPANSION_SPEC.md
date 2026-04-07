# Feeding Style Expansion Spec

> Status: **Deferred** — spec only, no implementation yet.
> Created: 2026-04-06

## Problem

The behavioral feeding model assumes a dry/wet binary. `feeding_style` has three active values (`dry_only`, `dry_and_wet`, `wet_only`) and one deferred (`custom`). The role inference in `AddToPantrySheet` only assigns `rotational` to `product_form === 'wet'` — freeze-dried, raw, dehydrated, air-dried, and fresh foods all fall through to `base` even when used rotationally.

Products like The Farmer's Dog (fresh), Stella & Chewy's (freeze-dried), and Primal (raw) don't fit the dry/wet binary. Users feeding kibble + freeze-dried toppers get both classified as base, breaking calorie math.

## Current State

```
product_form values in DB: dry, wet, raw, freeze_dried, dehydrated, air_dried
feeding_style values: dry_only, dry_and_wet, wet_only, custom (deferred)
```

Role inference (`AddToPantrySheet.tsx:184-188`):
- Treats → `null`
- `wet_only` → `rotational`
- `dry_and_wet` + `product_form === 'wet'` → `rotational`
- Everything else → `base`

## Proposed Fix

### Phase 1: Widen inference (minimal change)

Replace the `product_form === 'wet'` check with `product_form !== 'dry'`:

```typescript
if (pet.feeding_style === 'dry_and_wet' && product.product_form !== 'dry') return 'rotational';
```

This covers freeze-dried, raw, dehydrated, air-dried, and fresh — anything non-kibble becomes the rotational variable in mixed-feeding mode.

Rename `dry_and_wet` to "Kibble + other" or "Mixed feeding" in the UI only (keep DB enum unchanged for backwards compat).

**Files:** `AddToPantrySheet.tsx` (inference), `FeedingStyleSetupSheet.tsx` (labels), `PetHubScreen.tsx` (chip label), `EditPetScreen.tsx` (row label)

### Custom mode (separate scope)

For exotic combos where auto-inference is wrong (e.g., raw food IS the base diet, not a topper), the `custom` feeding style allows user-controlled calorie splits. This is a larger effort with its own plan: **`docs/plans/PHASE_3_CUSTOM_FEEDING_PLAN.md`**.

## Edge Cases

| Scenario | After Phase 1 | Needs custom mode? |
|----------|--------------|-------------------|
| Kibble + freeze-dried topper | Topper = rotational | No |
| Kibble + Farmer's Dog | Fresh = rotational | No |
| Raw + freeze-dried (no kibble) | Use `wet_only`, both rotational | Yes — user assigns roles |
| Two kibbles | Both = base, auto-split via `calorie_share_pct` | No |
| Kibble + raw base diet | Raw = rotational (may be wrong if it's 50/50) | Yes — user assigns roles |

## Dependencies

- Schema: `custom` already in the `FeedingStyle` type union and DB CHECK constraint
- `calorie_share_pct` column already exists on `pantry_pet_assignments`
- `computeBehavioralServing` already reads `calorie_share_pct` but currently defaults to 100
