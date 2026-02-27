// Layer 2 — Species Rules
// Pure function. No Supabase, no side effects, no brand awareness.
// Dog rules and cat rules never share (D-011).
// DCM and carb overload are percentages of baseScore, not flat points.

import type { Product } from '../../types';
import type { ProductIngredient, AppliedRule, SpeciesRuleResult } from '../../types/scoring';

// ─── UGT1A6 concern ingredients ────────────────────────

const UGT1A6_INGREDIENTS = ['propylene glycol', 'onion powder', 'garlic powder'];

// ─── Dog Rules ─────────────────────────────────────────

function applyDogRules(
  product: Product,
  ingredients: ProductIngredient[],
  baseScore: number,
): AppliedRule[] {
  const rules: AppliedRule[] = [];

  // DCM Advisory (D-013)
  const legumesInTop7 = ingredients.filter(
    i => i.position <= 7 && i.is_legume,
  ).length;
  const dcmFired = product.is_grain_free && legumesInTop7 >= 3;
  const dcmAdjustment = dcmFired ? -Math.round(baseScore * 0.08) : 0;

  rules.push({
    ruleId: 'DCM_ADVISORY',
    label: 'DCM risk advisory (grain-free + legumes)',
    adjustment: dcmAdjustment,
    fired: dcmFired,
    citation: 'FDA CVM DCM Investigation, 2019 (updated 2024)',
  });

  // Taurine + L-Carnitine Mitigation (D-013)
  const hasTaurine = ingredients.some(i =>
    i.canonical_name.toLowerCase().includes('taurine'),
  );
  const hasLCarnitine = ingredients.some(i =>
    i.canonical_name.toLowerCase().includes('l-carnitine') ||
    i.canonical_name.toLowerCase().includes('l_carnitine'),
  );
  const mitigationFired = dcmFired && hasTaurine && hasLCarnitine;
  const mitigationAdjustment = mitigationFired ? Math.round(baseScore * 0.03) : 0;

  rules.push({
    ruleId: 'TAURINE_MITIGATION',
    label: 'Taurine + L-Carnitine supplementation',
    adjustment: mitigationAdjustment,
    fired: mitigationFired,
    citation: 'FDA CVM DCM Investigation, 2019 (updated 2024)',
  });

  return rules;
}

// ─── Cat Rules ─────────────────────────────────────────

function applyCatRules(
  ingredients: ProductIngredient[],
  baseScore: number,
): AppliedRule[] {
  const rules: AppliedRule[] = [];

  // Carb Overload (D-014)
  const carbFlagsInTop5 = ingredients.filter(
    i => i.position <= 5 && i.cat_carb_flag,
  ).length;
  const carbFired = carbFlagsInTop5 >= 3;
  const carbAdjustment = carbFired ? -Math.round(baseScore * 0.15) : 0;

  rules.push({
    ruleId: 'CAT_CARB_OVERLOAD',
    label: 'High-glycemic carb overload',
    adjustment: carbAdjustment,
    fired: carbFired,
    citation: 'Journal of Animal Physiology, 2012',
  });

  // Taurine Missing
  const hasTaurine = ingredients.some(i =>
    i.canonical_name.toLowerCase().includes('taurine'),
  );
  const taurineMissingFired = !hasTaurine;

  rules.push({
    ruleId: 'CAT_TAURINE_MISSING',
    label: 'No taurine supplementation detected',
    adjustment: taurineMissingFired ? -10 : 0,
    fired: taurineMissingFired,
    citation: 'NRC Nutrient Requirements of Dogs and Cats, 2006',
  });

  // UGT1A6 Warning (flag only, no score change — D-095)
  const ugt1a6Hit = ingredients.some(i =>
    UGT1A6_INGREDIENTS.includes(i.canonical_name.toLowerCase()),
  );

  rules.push({
    ruleId: 'UGT1A6_WARNING',
    label: 'UGT1A6 enzyme concern detected',
    adjustment: 0,
    fired: ugt1a6Hit,
    citation: 'Court & Greenblatt, 2000; ASPCA toxicology',
  });

  return rules;
}

// ─── Main Function ─────────────────────────────────────

export function applySpeciesRules(
  product: Product,
  species: 'dog' | 'cat',
  ingredients: ProductIngredient[],
  baseScore: number,
): SpeciesRuleResult {
  const rules = species === 'dog'
    ? applyDogRules(product, ingredients, baseScore)
    : applyCatRules(ingredients, baseScore);

  const totalAdjustment = rules.reduce((sum, r) => sum + r.adjustment, 0);
  const adjustedScore = Math.max(0, Math.min(100, baseScore + totalAdjustment));

  return { adjustedScore, rules };
}
