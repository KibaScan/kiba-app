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

/**
 * Minimum number of distinct canonical names appearing more than once
 * to trigger the duplicate detection rule. Legitimate single-recipe products
 * can have 1-2 duplicates (e.g. mixed_tocopherols listed as both ingredient
 * and preservative). Concatenated variety packs will have many more.
 */
const DUPLICATE_NAME_THRESHOLD = 4;

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

  // Rule 3: Many duplicate canonical names at different positions
  const counts = new Map<string, number>();
  for (const ing of ingredients) {
    counts.set(ing.canonical_name, (counts.get(ing.canonical_name) ?? 0) + 1);
  }
  let duplicateNames = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicateNames++;
  }
  if (duplicateNames >= DUPLICATE_NAME_THRESHOLD) {
    return true;
  }

  return false;
}
