// Layer 2 — Species Rules
// Pure function. No Supabase, no side effects, no brand awareness.
// Dog rules and cat rules never share (D-011).
// DCM and carb overload are percentages of baseScore, not flat points.

import type { Product } from '../../types';
import type { ProductIngredient, AppliedRule, SpeciesRuleResult, DcmResult } from '../../types/scoring';

// ─── UGT1A6 concern ingredients ────────────────────────

const UGT1A6_INGREDIENTS = ['propylene glycol', 'onion powder', 'garlic powder'];

// ─── D-137 DCM Pulse Detection ───────────────────────────

export function evaluateDcmRisk(ingredients: ProductIngredient[]): DcmResult {
  const pulseIngredients = ingredients
    .filter(i => i.is_pulse)
    .map(i => ({
      name: i.canonical_name,
      position: i.position,
      isPulseProtein: i.is_pulse_protein,
    }));

  // Rule 1 — Heavyweight: 1+ pulse in positions 1–3
  const heavyweight = pulseIngredients.some(p => p.position <= 3);

  // Rule 2 — Density: 2+ pulses in positions 1–10
  const pulsesInTop10 = pulseIngredients.filter(p => p.position <= 10).length;
  const density = pulsesInTop10 >= 2;

  // Rule 3 — Substitution: 1+ pulse protein isolate in positions 1–10
  const substitution = pulseIngredients.some(
    p => p.position <= 10 && p.isPulseProtein,
  );

  const fires = heavyweight || density || substitution;

  const triggeredRules: DcmResult['triggeredRules'] = [];
  if (heavyweight) triggeredRules.push('heavyweight');
  if (density) triggeredRules.push('density');
  if (substitution) triggeredRules.push('substitution');

  // Mitigation: taurine + L-carnitine both present
  const hasTaurine = ingredients.some(i =>
    i.canonical_name.toLowerCase().includes('taurine'),
  );
  const hasLCarnitine = ingredients.some(i =>
    i.canonical_name.toLowerCase().includes('l-carnitine') ||
    i.canonical_name.toLowerCase().includes('l_carnitine'),
  );
  const hasMitigation = fires && hasTaurine && hasLCarnitine;

  return { fires, triggeredRules, hasMitigation, pulseIngredients };
}

// ─── Dog Rules ─────────────────────────────────────────

function applyDogRules(
  _product: Product,
  ingredients: ProductIngredient[],
  baseScore: number,
): AppliedRule[] {
  const rules: AppliedRule[] = [];

  // DCM Advisory (D-137 — replaces D-013)
  const dcm = evaluateDcmRisk(ingredients);
  const dcmAdjustment = dcm.fires ? -Math.round(baseScore * 0.08) : 0;

  rules.push({
    ruleId: 'DCM_ADVISORY',
    label: 'DCM pulse load advisory',
    adjustment: dcmAdjustment,
    fired: dcm.fires,
    citation: 'FDA CVM DCM Investigation, 2019 (updated 2024)',
  });

  // Taurine + L-Carnitine Mitigation (D-137)
  const mitigationAdjustment = dcm.hasMitigation ? Math.round(baseScore * 0.03) : 0;

  rules.push({
    ruleId: 'TAURINE_MITIGATION',
    label: 'Taurine + L-Carnitine supplementation',
    adjustment: mitigationAdjustment,
    fired: dcm.hasMitigation,
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
