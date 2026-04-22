// Kiba — Bonus Nutrient Derivation
// Derives boolean nutrient presence from hydrated ingredient list.

import type { ProductIngredient } from '../types/scoring';

interface BonusNutrientFlags {
  lcarnitine: boolean;
  zinc: boolean;
  probiotics: boolean;
  glucosamine: boolean;
}

const PROBIOTIC_PREFIXES = [
  'lactobacillus',
  'bifidobacterium',
  'enterococcus',
  'bacillus',
  'probiotic',
];

const GLUCOSAMINE_NAMES = [
  'glucosamine hydrochloride',
  'glucosamine sulfate',
  'glucosamine',
];

const LCARNITINE_NAMES = ['l-carnitine', 'carnitine'];

export function deriveBonusNutrientFlags(
  ingredients: ProductIngredient[],
): BonusNutrientFlags {
  let lcarnitine = false;
  let zinc = false;
  let probiotics = false;
  let glucosamine = false;

  for (const ing of ingredients) {
    const name = ing.canonical_name.toLowerCase();

    if (!lcarnitine && LCARNITINE_NAMES.some((n) => name === n)) {
      lcarnitine = true;
    }
    if (!zinc && name.startsWith('zinc')) {
      zinc = true;
    }
    if (!probiotics && PROBIOTIC_PREFIXES.some((p) => name.includes(p))) {
      probiotics = true;
    }
    if (!glucosamine && GLUCOSAMINE_NAMES.some((n) => name === n)) {
      glucosamine = true;
    }
  }

  return { lcarnitine, zinc, probiotics, glucosamine };
}
