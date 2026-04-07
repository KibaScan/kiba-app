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

### Phase 2: `custom` mode (larger scope)

Activate the fourth `feeding_style = 'custom'` value. In custom mode:
- No automatic role inference — user picks base vs rotational per item during add
- Any product form can be base or rotational
- Calorie math uses `calorie_share_pct` on each assignment (already in schema)
- Supports exotic combos: raw + freeze-dried, multiple wet bases, etc.

**Files:** `AddToPantrySheet.tsx` (role picker UI), `computeBehavioralServing` (share-pct math), `FeedingStyleSetupSheet.tsx` (4th option)

## Edge Cases

| Scenario | Phase 1 behavior | Phase 2 behavior |
|----------|-----------------|-----------------|
| Kibble + freeze-dried topper | Topper = rotational | Same, or user picks |
| Kibble + Farmer's Dog | Fresh = rotational | Same, or user picks |
| Raw + freeze-dried (no kibble) | Use `wet_only`, both rotational | Use `custom`, user assigns roles |
| Two kibbles | Both = base, share via `calorie_share_pct` | Same |
| Kibble + raw base diet | Raw = rotational (may be wrong if it's 50/50) | Use `custom`, user assigns |

## Dependencies

- Schema: `custom` already in the `FeedingStyle` type union and DB CHECK constraint
- `calorie_share_pct` column already exists on `pantry_pet_assignments`
- `computeBehavioralServing` already reads `calorie_share_pct` but currently defaults to 100
