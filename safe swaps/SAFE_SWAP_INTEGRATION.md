# M6 Safe Swap — Integration Instructions for Claude Code

## Files to Create

1. `src/services/safeSwapService.ts` ← from `safeSwapService.ts`
2. `src/components/result/SafeSwapSection.tsx` ← from `SafeSwapSection.tsx`

## ResultScreen Integration

In `src/screens/ResultScreen.tsx`, make these changes:

### 1. Add import (top of file, with other component imports)

```typescript
import { SafeSwapSection } from '../components/result/SafeSwapSection';
```

### 2. Replace the placeholder Safe Swap CTA (lines ~1134–1167)

Find this block (the blurred placeholder):
```tsx
{/* Safe Swap CTA (D-126: blur + lock for free users) */}
<TouchableOpacity
  style={styles.safeSwapCard}
  activeOpacity={0.7}
  ...
```

Replace it with:
```tsx
{/* Safe Swap Alternatives (M6) */}
{product && pet && scoredResult && !scoredResult.bypass && (
  <SafeSwapSection
    productId={product.id}
    petId={pet.id}
    species={species}
    category={scoredResult.category}
    productForm={product.product_form}
    isSupplemental={isSupplemental}
    scannedScore={score}
    petName={displayName}
  />
)}
```

### 3. Remove old Safe Swap styles

Delete these style definitions (no longer needed):
- `safeSwapCard`
- `safeSwapBlur`
- `safeSwapLockOverlay`
- `safeSwapLockText`
- `safeSwapRow`
- `safeSwapDot`
- `safeSwapPlaceholderBar`
- `safeSwapScoreBadge`

### 4. Wire Compare button to CompareScreen

The existing Compare button at lines ~1355–1372 has a `// TODO: Compare flow (M6+)`.
Update the onPress to navigate:
```tsx
onPress={() => {
  if (!canCompare()) {
    navigation.navigate('Paywall', { trigger: 'compare', petName: displayName });
    return;
  }
  // Open product picker for second product
  // (CompareScreen build is the next M6 prompt)
}}
```

## Permissions (already done)

`canCompare()` and `canUseSafeSwaps()` already exist in `permissions.ts`.
No changes needed there.

## Navigation Types

Add `Compare` route to your navigation types if not already present:
```typescript
// In src/types/navigation.ts
Compare: { productAId: string; productBId: string; petId: string };
```

## Assumptions

1. `pet_product_scores` is populated for the active pet before SafeSwapSection renders.
   If cache is empty, the section will show nothing (no crash, just hidden).
2. `product_ingredients` table has the join to `ingredients_dict` for allergen/severity filtering.
3. `scan_history` table is used for recent scan exclusion (last 30 days).
4. `pantry_items` has `is_active` boolean and `user_id` column.

## Test Cases to Verify

- [ ] Daily dry food → shows 3 curated picks (Top Pick / Fish-Based / Great Value)
- [ ] Daily wet food → shows generic top-5 scroll
- [ ] Treat → shows generic top-5 scroll
- [ ] Supplemental → shows generic top-5 scroll (supplemental↔supplemental)
- [ ] Bypassed product (vet diet, species mismatch, variety pack, recalled) → section hidden
- [ ] Supplement category → section hidden
- [ ] No alternatives found → section hidden entirely (no empty state)
- [ ] Single pet → chip row hidden
- [ ] 2+ same-species pets → chip row shows + "All Dogs"/"All Cats"
- [ ] Refresh button reshuffles without re-querying
- [ ] Tap card → navigates to ResultScreen for that product
- [ ] Compare link → premium gate → CompareScreen (once built)
- [ ] "See all alternatives" → premium gate
