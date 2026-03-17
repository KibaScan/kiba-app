/**
 * Variety Pack Detection — identifies products with concatenated multi-recipe
 * ingredient lists that would produce unreliable scores.
 *
 * Triggers on ANY of:
 * 1. Product name contains variety/multi-pack/assorted/sampler keywords
 * 2. Ingredient count exceeds 80 (no single recipe has 80+)
 * 3. Duplicate canonical ingredient names at different positions
 */

import type { ProductIngredient } from '../types/scoring';

const VARIETY_PACK_PATTERNS: RegExp[] = [
  /variety\s*pack/i,
  /variety/i,
  /multi[- ]?pack/i,
  /assorted/i,
  /sampler/i,
];

const INGREDIENT_COUNT_THRESHOLD = 80;

export function detectVarietyPack(
  productName: string,
  ingredients: ProductIngredient[],
): boolean {
  // Rule 1: Name keywords
  if (VARIETY_PACK_PATTERNS.some((p) => p.test(productName))) {
    return true;
  }

  // Rule 2: Excessive ingredient count
  if (ingredients.length > INGREDIENT_COUNT_THRESHOLD) {
    return true;
  }

  // Rule 3: Duplicate canonical names at different positions
  const seen = new Set<string>();
  for (const ing of ingredients) {
    if (seen.has(ing.canonical_name)) {
      return true;
    }
    seen.add(ing.canonical_name);
  }

  return false;
}
