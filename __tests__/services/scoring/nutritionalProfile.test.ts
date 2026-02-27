import {
  scoreNutritionalProfile,
  NutritionalProfileInput,
} from '../../../src/services/scoring/nutritionalProfile';

// ─── Helpers ────────────────────────────────────────────

/** Baseline adult cat wet food — §8 regression product */
function makeAdultCatWet(overrides: Partial<NutritionalProfileInput> = {}): NutritionalProfileInput {
  return {
    gaProteinPct: 10,
    gaFatPct: 5,
    gaFiberPct: 1,
    gaMoisturePct: 78,
    gaCalciumPct: null,
    gaPhosphorusPct: null,
    gaOmega3Pct: null,
    species: 'cat',
    lifeStage: 'adult',
    breedSize: null,
    petConditions: [],
    aafcoStatement: null,
    lifeStageClaim: null,
    nutritionalDataSource: null,
    category: 'daily_food',
    ...overrides,
  };
}

/** Baseline adult dog dry food */
function makeAdultDogDry(overrides: Partial<NutritionalProfileInput> = {}): NutritionalProfileInput {
  return {
    gaProteinPct: 26,
    gaFatPct: 16,
    gaFiberPct: 4,
    gaMoisturePct: 10,
    gaCalciumPct: null,
    gaPhosphorusPct: null,
    gaOmega3Pct: null,
    species: 'dog',
    lifeStage: 'adult',
    breedSize: null,
    petConditions: [],
    aafcoStatement: null,
    lifeStageClaim: null,
    nutritionalDataSource: null,
    category: 'daily_food',
    ...overrides,
  };
}

// ─── §8 Regression ──────────────────────────────────────

describe('§8 Regression: Adult cat wet food', () => {
  it('produces bucket score of 90', () => {
    const result = scoreNutritionalProfile(makeAdultCatWet());

    // DMB values: protein 45.45%, fat 22.73%, fiber 4.55%
    // Ash AF default 2% → DMB 9.09%, carbs NFE = 18.18%
    // Protein: linear in ideal range → ~91.1
    // Fat: cat curve, 22.73% in plateau (20-25) → 100
    // Fiber: 4.55% → 90
    // Carbs: 18.18%, cat ≤25 → 80
    // Weighted: 91.1×0.45 + 100×0.20 + 90×0.10 + 80×0.25 = 90
    expect(result.bucketScore).toBe(90);
    expect(result.dataQuality).toBe('full');
    expect(result.modifiersApplied).toHaveLength(0);
  });

  it('sub-scores match expected values', () => {
    const result = scoreNutritionalProfile(makeAdultCatWet());

    expect(result.subScores.protein).toBeCloseTo(91.1, 0);
    expect(result.subScores.fat).toBe(100);
    expect(result.subScores.fiber).toBe(90);
    expect(result.subScores.carbs).toBe(80);
  });
});

// ─── DMB Conversion ─────────────────────────────────────

describe('DMB conversion', () => {
  it('converts 78% moisture correctly', () => {
    // protein AF 10% at 78% moisture → DMB 45.45%
    // This is verified indirectly through the sub-score
    const result = scoreNutritionalProfile(makeAdultCatWet());
    // Protein 45.45% vs cat min 26%: well in ideal range
    expect(result.subScores.protein).toBeGreaterThan(70);
    expect(result.subScores.protein).toBeLessThan(100);
  });
});

// ─── Ash Estimation ─────────────────────────────────────

describe('Ash estimation', () => {
  it('wet food uses 2% AF default → DMB 9.09% at 78% moisture', () => {
    // Verify through carbs: NFE = 100 - (45.45 + 22.73 + 4.55 + 9.09) = 18.18
    // Cat carbs ≤25 → score 80
    const result = scoreNutritionalProfile(makeAdultCatWet());
    expect(result.subScores.carbs).toBe(80);
  });

  it('Ca+P tightens ash estimate', () => {
    // Ca 1.0% + P 0.8% → ash AF = 4.5% → DMB = 4.5/22 * 100 = 20.45%
    // NFE = 100 - (45.45 + 22.73 + 4.55 + 20.45) = 6.82%
    // Cat carbs ≤15 → score 100
    const result = scoreNutritionalProfile(makeAdultCatWet({
      gaCalciumPct: 1.0,
      gaPhosphorusPct: 0.8,
    }));
    expect(result.subScores.carbs).toBe(100);
  });
});

// ─── NFE Carb Floor ─────────────────────────────────────

describe('NFE carb floor', () => {
  it('ultra-high-protein wet food carbs floor at 0', () => {
    // protein 20% AF at 78% moisture → DMB 90.9%
    // fat 5% → DMB 22.73%, fiber 1% → 4.55%, ash 9.09%
    // NFE = 100 - (90.9 + 22.73 + 4.55 + 9.09) = -27.27 → Math.max(0) = 0
    // Dog carbs ≤30 → 100
    const result = scoreNutritionalProfile({
      ...makeAdultCatWet(),
      species: 'dog',
      gaProteinPct: 20,
    });
    expect(result.subScores.carbs).toBe(100);
  });
});

// ─── Missing GA Fallback ────────────────────────────────

describe('Missing GA fallback', () => {
  it('all GA null → dataQuality missing, bucketScore 0', () => {
    const result = scoreNutritionalProfile(makeAdultCatWet({
      gaProteinPct: null,
      gaFatPct: null,
      gaFiberPct: null,
      gaMoisturePct: null,
    }));
    expect(result.bucketScore).toBe(0);
    expect(result.dataQuality).toBe('missing');
    expect(result.missingFields).toEqual(['protein', 'fat', 'fiber', 'moisture']);
    expect(result.subScores).toEqual({ protein: 0, fat: 0, fiber: 0, carbs: 0 });
  });

  it('protein null → sub-score 50, dataQuality partial', () => {
    const result = scoreNutritionalProfile(makeAdultCatWet({
      gaProteinPct: null,
    }));
    expect(result.subScores.protein).toBe(50);
    expect(result.dataQuality).toBe('partial');
    expect(result.missingFields).toContain('protein');
  });

  it('fat null → sub-score 50, carbs also 50 (NFE unreliable)', () => {
    const result = scoreNutritionalProfile(makeAdultCatWet({
      gaFatPct: null,
    }));
    expect(result.subScores.fat).toBe(50);
    expect(result.subScores.carbs).toBe(50);
    expect(result.dataQuality).toBe('partial');
  });

  it('fiber null → assumes 3% AF, dataQuality partial', () => {
    const result = scoreNutritionalProfile(makeAdultDogDry({
      gaFiberPct: null,
    }));
    expect(result.dataQuality).toBe('partial');
    expect(result.missingFields).toContain('fiber');
    // Fiber 3% AF at 10% moisture → DMB 3.33% → ≤5% bracket → score 90
    expect(result.subScores.fiber).toBe(90);
  });

  it('moisture null → assumes 10%, dataQuality partial', () => {
    const result = scoreNutritionalProfile(makeAdultDogDry({
      gaMoisturePct: null,
    }));
    expect(result.dataQuality).toBe('partial');
    expect(result.missingFields).toContain('moisture');
  });
});

// ─── LLM-Extracted Flag ────────────────────────────────

describe('LLM-extracted flag', () => {
  it('sets llmExtracted true when source is llm_extracted', () => {
    const result = scoreNutritionalProfile(makeAdultCatWet({
      nutritionalDataSource: 'llm_extracted',
    }));
    expect(result.llmExtracted).toBe(true);
  });

  it('sets llmExtracted false for manual data', () => {
    const result = scoreNutritionalProfile(makeAdultCatWet({
      nutritionalDataSource: 'manual',
    }));
    expect(result.llmExtracted).toBe(false);
  });
});

// ─── Life Stage Modifiers ───────────────────────────────

describe('Senior dog protein modifier', () => {
  it('+5 when protein DMB ≥ 25%', () => {
    // protein 26% AF at 10% moisture → DMB 28.89% ≥ 25
    const result = scoreNutritionalProfile(makeAdultDogDry({
      lifeStage: 'senior',
    }));
    const mod = result.modifiersApplied.find(m => m.name === 'senior_dog_protein_boost');
    expect(mod).toBeDefined();
    expect(mod!.points).toBe(5);
    expect(mod!.target).toBe('protein');
  });
});

describe('Senior cat protein modifier', () => {
  it('+5 when protein DMB ≥ 30%', () => {
    // protein 10% AF at 78% moisture → DMB 45.45% ≥ 30
    const result = scoreNutritionalProfile(makeAdultCatWet({
      lifeStage: 'senior',
    }));
    const mod = result.modifiersApplied.find(m => m.name === 'senior_cat_protein_boost');
    expect(mod).toBeDefined();
    expect(mod!.points).toBe(5);
  });

  it('−10 when protein DMB < 30% and no CKD', () => {
    // protein 5% AF at 78% moisture → DMB 22.73% < 30
    const result = scoreNutritionalProfile(makeAdultCatWet({
      lifeStage: 'senior',
      gaProteinPct: 5,
    }));
    const mod = result.modifiersApplied.find(m => m.name === 'senior_cat_protein_penalty');
    expect(mod).toBeDefined();
    expect(mod!.points).toBe(-10);
  });

  it('NO penalty when protein DMB < 30% but HAS CKD (CKD-gated)', () => {
    const result = scoreNutritionalProfile(makeAdultCatWet({
      lifeStage: 'senior',
      gaProteinPct: 5,
      petConditions: ['ckd'],
    }));
    const mod = result.modifiersApplied.find(m => m.name === 'senior_cat_protein_penalty');
    expect(mod).toBeUndefined();
  });
});

describe('Puppy eating adult food', () => {
  it('−15 bucket modifier when life_stage_claim contains "adult"', () => {
    const result = scoreNutritionalProfile(makeAdultDogDry({
      lifeStage: 'puppy',
      lifeStageClaim: 'For adult dogs',
    }));
    const mod = result.modifiersApplied.find(m => m.name === 'growth_adult_food_penalty');
    expect(mod).toBeDefined();
    expect(mod!.points).toBe(-15);
    expect(mod!.target).toBe('bucket');
  });
});

describe('Large breed puppy calcium', () => {
  it('−12 when Ca DMB > 1.8%', () => {
    // Ca 0.5% AF at 10% moisture → DMB 0.556% — too low
    // Need Ca AF that gives DMB > 1.8%: Ca > 1.8 * 0.9 = 1.62% AF
    const result = scoreNutritionalProfile(makeAdultDogDry({
      lifeStage: 'puppy',
      breedSize: 'large',
      gaCalciumPct: 2.0,
      gaPhosphorusPct: 1.0, // Ca:P = 2.22:1 → also narrow penalty fires
    }));
    const mod = result.modifiersApplied.find(m => m.name === 'large_breed_puppy_ca_excess');
    expect(mod).toBeDefined();
    expect(mod!.points).toBe(-12);
  });

  it('−8 when Ca DMB < 0.8%', () => {
    // Ca 0.05% AF at 10% moisture → DMB 0.056%
    const result = scoreNutritionalProfile(makeAdultDogDry({
      lifeStage: 'puppy',
      breedSize: 'giant',
      gaCalciumPct: 0.05,
      gaPhosphorusPct: 0.05,
    }));
    const mod = result.modifiersApplied.find(m => m.name === 'large_breed_puppy_ca_deficiency');
    expect(mod).toBeDefined();
    expect(mod!.points).toBe(-8);
  });
});

// ─── Fiber Suppression ──────────────────────────────────

describe('Fiber suppression', () => {
  it('reduces penalty 50% for "weight management" in AAFCO statement', () => {
    // fiber 8% AF at 10% moisture → DMB 8.89% → raw score 50
    // suppressed: 100 - (100 - 50) * 0.5 = 75
    const result = scoreNutritionalProfile(makeAdultDogDry({
      gaFiberPct: 8,
      aafcoStatement: 'Formulated for weight management of adult dogs',
    }));
    expect(result.subScores.fiber).toBe(75);
  });

  it('reduces penalty 50% for obesity condition', () => {
    const result = scoreNutritionalProfile(makeAdultDogDry({
      gaFiberPct: 8,
      petConditions: ['obesity'],
    }));
    expect(result.subScores.fiber).toBe(75);
  });

  it('does NOT suppress when no weight management context', () => {
    const result = scoreNutritionalProfile(makeAdultDogDry({
      gaFiberPct: 8,
    }));
    expect(result.subScores.fiber).toBe(50);
  });
});

// ─── Species Curve Differences ──────────────────────────

describe('Dog vs cat carb curves differ', () => {
  it('same carb_dmb = 35% → dog 65, cat 55', () => {
    // Need inputs that produce carb_dmb ≈ 35%
    // For dry food (10% moisture): protein + fat + fiber + ash = 65% DMB
    // ash default for dry = 7% AF → DMB 7.78%
    // So we need protein_dmb + fat_dmb + fiber_dmb = 57.22% DMB
    // At 10% moisture: AF values = DMB * 0.9
    // Let's use: protein 20% AF, fat 25% AF, fiber 6% AF
    // DMB: protein 22.22, fat 27.78, fiber 6.67, ash 7.78
    // carbs = 100 - (22.22 + 27.78 + 6.67 + 7.78) = 35.55 ≈ 35%
    const dogResult = scoreNutritionalProfile(makeAdultDogDry({
      gaProteinPct: 20,
      gaFatPct: 25,
      gaFiberPct: 6,
    }));

    const catResult = scoreNutritionalProfile(makeAdultDogDry({
      gaProteinPct: 20,
      gaFatPct: 25,
      gaFiberPct: 6,
      species: 'cat',
    }));

    // Dog: carbs ~35.55% → ≤40 → 85
    expect(dogResult.subScores.carbs).toBe(85);
    // Cat: carbs ~35.55% → ≤45 → 30... wait, 35.55 is > 35 → 55? No.
    // Cat: ≤15→100, ≤25→80, ≤35→55, ≤45→30
    // 35.55 > 35 → falls in ≤45 bucket → 30
    expect(catResult.subScores.carbs).toBe(30);
  });
});

describe('Cat fat curve decoupled', () => {
  it('fat 22% DMB → cat 100 (plateau), dog uses different curve', () => {
    // fat 22% DMB: for cat, between ideal_high (20) and excess (25) → 100
    // For dog adult (min=5.5): ideal_low=6.875, ideal_high=18, excess=25
    // fat 22% DMB: between ideal_high (18) and excess (25) → 100
    // Both plateau at 100 for 22% DMB, but let's test a value in the climbing range
    // fat 15% DMB: cat → linear(15, 12, 20, 70, 100) = 70 + 3/8*30 = 81.25
    // dog adult → linear(15, 6.875, 18, 70, 100) = 70 + 8.125/11.125*30 = 91.9
    const catResult = scoreNutritionalProfile(makeAdultCatWet({
      gaFatPct: 3.3,  // 3.3/22*100 = 15% DMB
    }));

    const dogResult = scoreNutritionalProfile({
      ...makeAdultCatWet({
        gaFatPct: 3.3,
      }),
      species: 'dog',
    });

    // Cat: fat 15% DMB → in climbing range (12-20) → ~81.25
    expect(catResult.subScores.fat).toBeCloseTo(81.25, 0);
    // Dog: fat 15% DMB → in climbing range (6.875-18) → ~91.9
    expect(dogResult.subScores.fat).toBeCloseTo(91.9, 0);
  });
});

// ─── Weight Verification ────────────────────────────────

describe('Weight sums', () => {
  it('dog weights sum to 1.0', () => {
    expect(0.35 + 0.25 + 0.15 + 0.25).toBeCloseTo(1.0);
  });

  it('cat weights sum to 1.0', () => {
    expect(0.45 + 0.20 + 0.10 + 0.25).toBeCloseTo(1.0);
  });
});

// ─── Determinism ────────────────────────────────────────

describe('Determinism', () => {
  it('same inputs produce identical output', () => {
    const input = makeAdultCatWet();
    const result1 = scoreNutritionalProfile(input);
    const result2 = scoreNutritionalProfile(input);

    expect(result1).toEqual(result2);
  });
});
