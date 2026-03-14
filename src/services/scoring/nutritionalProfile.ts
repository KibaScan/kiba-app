// Layer 1b — Nutritional Profile Scoring
// Pure function. No Supabase, no side effects, no brand awareness.
// Scores 4 sub-nutrients against AAFCO thresholds using species-specific curves.
// Products scored on DMB basis. Bucket output is 0-100.

import type { BreedSize, Modifier, NutritionScoreResult } from '../../types/scoring';

// ─── Input Contract ─────────────────────────────────────

export interface NutritionalProfileInput {
  gaProteinPct: number | null;
  gaFatPct: number | null;
  gaFiberPct: number | null;
  gaMoisturePct: number | null;
  gaCalciumPct: number | null;
  gaPhosphorusPct: number | null;
  gaOmega3Pct: number | null;
  species: 'dog' | 'cat';
  lifeStage: 'puppy' | 'kitten' | 'adult' | 'senior';
  breedSize: BreedSize | null;
  petConditions: string[];
  aafcoStatement: string | null;
  lifeStageClaim: string | null;
  nutritionalDataSource: string | null;
  category: 'daily_food' | 'treat' | 'supplement';
  isSupplemental?: boolean;
}

// ─── AAFCO Thresholds (DMB) ────────────────────────────

interface AafcoThresholds {
  proteinMin: number;
  fatMin: number;
}

function getAafcoThresholds(
  species: 'dog' | 'cat',
  lifeStage: string,
): AafcoThresholds {
  if (species === 'dog') {
    if (lifeStage === 'puppy') return { proteinMin: 22.5, fatMin: 8.5 };
    return { proteinMin: 18.0, fatMin: 5.5 };
  }
  // Cat
  if (lifeStage === 'kitten') return { proteinMin: 30.0, fatMin: 9.0 };
  return { proteinMin: 26.0, fatMin: 9.0 };
}

// ─── Helpers ────────────────────────────────────────────

function toDMB(asFed: number, moisture: number): number {
  return (asFed / (100 - moisture)) * 100;
}

function linear(
  value: number,
  fromLow: number,
  fromHigh: number,
  toLow: number,
  toHigh: number,
): number {
  return toLow + ((value - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow);
}

function estimateAshDmb(
  moisture: number,
  category: string,
  calciumPct: number | null,
  phosphorusPct: number | null,
): number {
  let ashAf: number;

  if (calciumPct != null && phosphorusPct != null) {
    ashAf = (calciumPct + phosphorusPct) * 2.5;
  } else if (category === 'treat') {
    ashAf = 5.0;
  } else if (moisture > 12) {
    ashAf = 2.0;
  } else {
    ashAf = 7.0;
  }

  return toDMB(ashAf, moisture);
}

// ─── Scoring Curves ─────────────────────────────────────

function scoreProtein(proteinDmb: number, min: number): number {
  const idealLow = min * 1.15;
  const idealHigh = min * 2.0;
  const excess = min * 2.5;

  if (proteinDmb < min * 0.8) return 0;
  if (proteinDmb < min) return linear(proteinDmb, min * 0.8, min, 0, 40);
  if (proteinDmb < idealLow) return linear(proteinDmb, min, idealLow, 40, 70);
  if (proteinDmb < idealHigh) return linear(proteinDmb, idealLow, idealHigh, 70, 100);
  if (proteinDmb < excess) return 100;
  return 90;
}

function scoreFatDog(fatDmb: number, min: number): number {
  const idealLow = min * 1.25;
  const idealHigh = 18.0;
  const excess = 25.0;

  if (fatDmb < min * 0.8) return 0;
  if (fatDmb < min) return linear(fatDmb, min * 0.8, min, 0, 40);
  if (fatDmb < idealLow) return linear(fatDmb, min, idealLow, 40, 70);
  if (fatDmb < idealHigh) return linear(fatDmb, idealLow, idealHigh, 70, 100);
  if (fatDmb < excess) return 100;
  return 60;
}

function scoreFatCat(fatDmb: number, min: number): number {
  const idealLow = 12.0;
  const idealHigh = 20.0;
  const excess = 25.0;

  if (fatDmb < min * 0.8) return 0;
  if (fatDmb < min) return linear(fatDmb, min * 0.8, min, 0, 40);
  if (fatDmb < idealLow) return linear(fatDmb, min, idealLow, 40, 70);
  if (fatDmb < idealHigh) return linear(fatDmb, idealLow, idealHigh, 70, 100);
  if (fatDmb < excess) return 100;
  return 60;
}

function scoreFiber(fiberDmb: number, suppress: boolean): number {
  let raw: number;

  if (fiberDmb <= 1.0) raw = 80;
  else if (fiberDmb <= 3.0) raw = 100;
  else if (fiberDmb <= 5.0) raw = 90;
  else if (fiberDmb <= 7.0) raw = 70;
  else if (fiberDmb <= 10.0) raw = 50;
  else raw = 25;

  if (suppress) {
    return 100 - (100 - raw) * 0.5;
  }
  return raw;
}

function scoreCarbsDog(carbDmb: number): number {
  if (carbDmb <= 30) return 100;
  if (carbDmb <= 40) return 85;
  if (carbDmb <= 50) return 65;
  if (carbDmb <= 60) return 40;
  return 20;
}

function scoreCarbsCat(carbDmb: number): number {
  if (carbDmb <= 15) return 100;
  if (carbDmb <= 25) return 80;
  if (carbDmb <= 35) return 55;
  if (carbDmb <= 45) return 30;
  return 10;
}

// ─── Weights ────────────────────────────────────────────

const DOG_WEIGHTS = { protein: 0.35, fat: 0.25, fiber: 0.15, carbs: 0.25 };
const CAT_WEIGHTS = { protein: 0.45, fat: 0.20, fiber: 0.10, carbs: 0.25 };

// ─── Main Scoring Function ──────────────────────────────

export function scoreNutritionalProfile(
  input: NutritionalProfileInput,
): NutritionScoreResult {
  const modifiers: Modifier[] = [];
  const missingFields: string[] = [];

  // ─── §7a: All macros null → dataQuality 'missing' ────
  if (
    input.gaProteinPct === null &&
    input.gaFatPct === null &&
    input.gaFiberPct === null &&
    input.gaMoisturePct === null
  ) {
    return {
      bucketScore: 0,
      subScores: { protein: 0, fat: 0, fiber: 0, carbs: 0 },
      modifiersApplied: [],
      dataQuality: 'missing',
      missingFields: ['protein', 'fat', 'fiber', 'moisture'],
      llmExtracted: input.nutritionalDataSource === 'llm_extracted',
    };
  }

  // ─── §7b: Handle partial missing ─────────────────────
  const proteinNull = input.gaProteinPct === null;
  const fatNull = input.gaFatPct === null;
  const fiberNull = input.gaFiberPct === null;
  const moistureNull = input.gaMoisturePct === null;

  if (proteinNull) missingFields.push('protein');
  if (fatNull) missingFields.push('fat');
  if (fiberNull) missingFields.push('fiber');
  if (moistureNull) missingFields.push('moisture');

  const dataQuality = missingFields.length > 0 ? 'partial' as const : 'full' as const;

  // Defaults for missing values
  const moisture = moistureNull ? 10.0 : input.gaMoisturePct!;
  const fiberAf = fiberNull ? 3.0 : input.gaFiberPct!;

  // ─── §1: DMB conversion ──────────────────────────────
  const proteinDmb = proteinNull ? null : toDMB(input.gaProteinPct!, moisture);
  const fatDmb = fatNull ? null : toDMB(input.gaFatPct!, moisture);
  const fiberDmb = toDMB(fiberAf, moisture);

  // ─── §2c: Ash estimation + carbs (NFE) ───────────────
  const ashDmb = estimateAshDmb(
    moisture,
    input.category,
    input.gaCalciumPct,
    input.gaPhosphorusPct,
  );

  // NFE requires all components; if protein or fat null, carbs unreliable
  let carbDmb: number | null = null;
  if (proteinDmb !== null && fatDmb !== null) {
    carbDmb = Math.max(0, 100 - (proteinDmb + fatDmb + fiberDmb + ashDmb));
  }

  // ─── §4b + §2: AAFCO thresholds + sub-nutrient scores
  const thresholds = getAafcoThresholds(input.species, input.lifeStage);

  let proteinScore = proteinNull ? 50 : scoreProtein(proteinDmb!, thresholds.proteinMin);

  let fatScore = fatNull
    ? 50
    : input.species === 'dog'
      ? scoreFatDog(fatDmb!, thresholds.fatMin)
      : scoreFatCat(fatDmb!, thresholds.fatMin);

  // Fiber suppression: AAFCO statement "weight management"/"light" OR pet has 'obesity'
  const aafco = input.aafcoStatement?.toLowerCase() ?? '';
  const suppressFiber =
    aafco.includes('weight management') ||
    aafco.includes('light') ||
    input.petConditions.includes('obesity');

  let fiberScore = scoreFiber(fiberDmb, suppressFiber);

  let carbScore = carbDmb === null
    ? 50
    : input.species === 'dog'
      ? scoreCarbsDog(carbDmb)
      : scoreCarbsCat(carbDmb);

  // ─── §5: Sub-score modifiers (BEFORE weighted sum) ───
  const isGrowth = input.lifeStage === 'puppy' || input.lifeStage === 'kitten';
  const isSenior = input.lifeStage === 'senior';

  // Puppy/kitten protein boost
  if (isGrowth && !proteinNull && proteinDmb! >= thresholds.proteinMin * 1.3) {
    modifiers.push({
      name: 'growth_protein_boost',
      points: 5,
      target: 'protein',
      reason: 'High protein supports tissue development during growth',
      citationSource: 'NRC-2006; AAFCO-2023',
    });
    proteinScore += 5;
  }

  // Puppy/kitten fat boost
  if (isGrowth && !fatNull && fatDmb! >= thresholds.fatMin * 1.5) {
    modifiers.push({
      name: 'growth_fat_boost',
      points: 3,
      target: 'fat',
      reason: 'Energy-dense diet supports rapid growth',
      citationSource: 'NRC-2006',
    });
    fatScore += 3;
  }

  // Senior dog protein boost
  if (isSenior && input.species === 'dog' && !proteinNull && proteinDmb! >= 25) {
    modifiers.push({
      name: 'senior_dog_protein_boost',
      points: 5,
      target: 'protein',
      reason: 'Higher protein counteracts sarcopenia in senior dogs',
      citationSource: 'Laflamme-2005',
    });
    proteinScore += 5;
  }

  // Senior cat protein boost/penalty
  if (isSenior && input.species === 'cat' && !proteinNull) {
    if (proteinDmb! >= 30) {
      modifiers.push({
        name: 'senior_cat_protein_boost',
        points: 5,
        target: 'protein',
        reason: 'Higher protein supports muscle maintenance in senior cats',
        citationSource: 'NRC-2006; Laflamme-2005',
      });
      proteinScore += 5;
    } else if (!input.petConditions.includes('ckd')) {
      modifiers.push({
        name: 'senior_cat_protein_penalty',
        points: -10,
        target: 'protein',
        reason: 'Inadequate protein for senior obligate carnivore',
        citationSource: 'NRC-2006; Laflamme-2005',
      });
      proteinScore -= 10;
    }
  }

  // ─── §8 step 9: Clamp sub-scores [0, 100] ───────────
  proteinScore = Math.max(0, Math.min(100, proteinScore));
  fatScore = Math.max(0, Math.min(100, fatScore));
  fiberScore = Math.max(0, Math.min(100, fiberScore));
  carbScore = Math.max(0, Math.min(100, carbScore));

  // ─── §8 step 10: Weighted sum ────────────────────────
  const weights = input.species === 'dog' ? DOG_WEIGHTS : CAT_WEIGHTS;
  let bucketScore =
    proteinScore * weights.protein +
    fatScore * weights.fat +
    fiberScore * weights.fiber +
    carbScore * weights.carbs;

  // ─── §5: Bucket-level modifiers (AFTER weighted sum) ─
  // D-136: Supplemental products skip all micronutrient + life stage modifiers
  const claim = input.lifeStageClaim?.toLowerCase() ?? '';

  if (!input.isSupplemental) {
  // Puppy/kitten eating adult food
  if (isGrowth && (claim.includes('adult') || claim.includes('maintenance'))) {
    modifiers.push({
      name: 'growth_adult_food_penalty',
      points: -15,
      target: 'bucket',
      reason: "Adult food doesn't meet growth nutritional demands",
      citationSource: 'AAFCO-2023; NRC-2006',
    });
    bucketScore -= 15;
  }

  // Puppy/kitten Ca:P ratio outside 1.1:1–2:1
  if (isGrowth && input.gaCalciumPct !== null && input.gaPhosphorusPct !== null) {
    const caDmb = toDMB(input.gaCalciumPct, moisture);
    const pDmb = toDMB(input.gaPhosphorusPct, moisture);
    const caP = caDmb / pDmb;
    if (caP < 1.1 || caP > 2.0) {
      modifiers.push({
        name: 'growth_cap_ratio_penalty',
        points: -10,
        target: 'bucket',
        reason: 'Ca:P ratio outside safe range for skeletal development',
        citationSource: 'AAFCO-2023; NRC-2006',
      });
      bucketScore -= 10;
    }
  }

  // Senior dog phosphorus penalty
  if (isSenior && input.species === 'dog' && input.gaPhosphorusPct !== null) {
    const pDmb = toDMB(input.gaPhosphorusPct, moisture);
    if (pDmb > 1.4) {
      modifiers.push({
        name: 'senior_dog_phosphorus_penalty',
        points: -8,
        target: 'bucket',
        reason: 'Elevated phosphorus accelerates CKD progression',
        citationSource: 'IRIS',
      });
      bucketScore -= 8;
    }
  }

  // Senior dog joint bonus (omega-3)
  if (isSenior && input.species === 'dog' && input.gaOmega3Pct !== null && input.gaOmega3Pct > 0) {
    modifiers.push({
      name: 'senior_dog_joint_bonus',
      points: 3,
      target: 'bucket',
      reason: 'Omega-3 supports joint health in senior dogs',
      citationSource: 'Laflamme-2005',
    });
    bucketScore += 3;
  }

  // Senior cat phosphorus penalty
  if (isSenior && input.species === 'cat' && input.gaPhosphorusPct !== null) {
    const pDmb = toDMB(input.gaPhosphorusPct, moisture);
    if (pDmb > 1.2) {
      modifiers.push({
        name: 'senior_cat_phosphorus_penalty',
        points: -8,
        target: 'bucket',
        reason: 'Elevated phosphorus — kidney disease risk in senior cats',
        citationSource: 'IRIS',
      });
      bucketScore -= 8;
    }
  }

  // Senior cat eating kitten food
  if (isSenior && input.species === 'cat' && claim.includes('kitten')) {
    modifiers.push({
      name: 'senior_cat_kitten_food_penalty',
      points: -5,
      target: 'bucket',
      reason: 'Kitten food has excessive calories/minerals for senior cats',
      citationSource: 'NRC-2006',
    });
    bucketScore -= 5;
  }

  // Large breed puppy modifiers (dogs only)
  if (
    input.lifeStage === 'puppy' &&
    input.species === 'dog' &&
    (input.breedSize === 'large' || input.breedSize === 'giant')
  ) {
    // Calcium excess/deficiency
    if (input.gaCalciumPct !== null) {
      const caDmb = toDMB(input.gaCalciumPct, moisture);

      if (caDmb > 1.8) {
        modifiers.push({
          name: 'large_breed_puppy_ca_excess',
          points: -12,
          target: 'bucket',
          reason: 'Excess calcium causes developmental orthopedic disease in large breed puppies',
          citationSource: 'Hazewinkel; VCA-LBP',
        });
        bucketScore -= 12;
      } else if (caDmb < 0.8) {
        modifiers.push({
          name: 'large_breed_puppy_ca_deficiency',
          points: -8,
          target: 'bucket',
          reason: 'Insufficient calcium for large breed skeletal growth',
          citationSource: 'Hazewinkel; VCA-LBP',
        });
        bucketScore -= 8;
      }
    }

    // Ca:P narrow range for large breeds (1.1:1–1.4:1)
    if (input.gaCalciumPct !== null && input.gaPhosphorusPct !== null) {
      const caDmb = toDMB(input.gaCalciumPct, moisture);
      const pDmb = toDMB(input.gaPhosphorusPct, moisture);
      const caP = caDmb / pDmb;

      if (caP < 1.1 || caP > 1.4) {
        modifiers.push({
          name: 'large_breed_puppy_cap_narrow',
          points: -10,
          target: 'bucket',
          reason: 'Ca:P ratio outside narrow safe range for large breed puppies',
          citationSource: 'VCA-LBP; NRC-2006',
        });
        bucketScore -= 10;
      }
    }
  }
  } // end !isSupplemental guard

  // ─── §8 step 12: Clamp bucket score [0, 100] ────────
  bucketScore = Math.max(0, Math.min(100, Math.round(bucketScore)));

  return {
    bucketScore,
    subScores: {
      protein: proteinScore,
      fat: fatScore,
      fiber: fiberScore,
      carbs: carbScore,
    },
    modifiersApplied: modifiers,
    dataQuality,
    missingFields,
    llmExtracted: input.nutritionalDataSource === 'llm_extracted',
  };
}
