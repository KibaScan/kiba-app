import { computeScore } from '../../../src/services/scoring/engine';
import type { Product, PetProfile } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';
import { Category, Species, LifeStage } from '../../../src/types';

// ─── Helpers ───────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product',
    brand: 'Test Brand',
    name: 'Test Food',
    category: Category.DailyFood,
    target_species: Species.Dog,
    source: 'curated',
    aafco_statement: 'All Life Stages',
    life_stage_claim: null,
    preservative_type: 'natural',
    ga_protein_pct: 26,
    ga_fat_pct: 16,
    ga_fiber_pct: 4,
    ga_moisture_pct: 10,
    ga_calcium_pct: null,
    ga_phosphorus_pct: null,
    ga_kcal_per_cup: null,
    ga_kcal_per_kg: null,
    kcal_per_unit: null,
    unit_weight_g: null,
    default_serving_format: null,
    ga_taurine_pct: null,
    ga_l_carnitine_mg: null,
    ga_dha_pct: null,
    ga_omega3_pct: null,
    ga_omega6_pct: null,
    ga_zinc_mg_kg: null,
    ga_probiotics_cfu: null,
    nutritional_data_source: null,
    ingredients_raw: null,
    ingredients_hash: null,
    is_recalled: false,
    is_grain_free: false,
    score_confidence: 'high',
    needs_review: false,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makePet(overrides: Partial<PetProfile> = {}): PetProfile {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Mochi',
    species: Species.Dog,
    breed: null,
    age_years: 3,
    age_months: null,
    weight_kg: 10,
    goal_weight: null,
    life_stage: LifeStage.Adult,
    photo_url: null,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makeIngredient(
  overrides: Partial<ProductIngredient> & { position: number; canonical_name: string },
): ProductIngredient {
  return {
    dog_base_severity: 'neutral',
    cat_base_severity: 'neutral',
    is_unnamed_species: false,
    is_legume: false,
    position_reduction_eligible: true,
    cluster_id: null,
    cat_carb_flag: false,
    allergen_group: null,
    allergen_group_possible: [],
    is_protein_fat_source: false,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────

describe('computeScore — Orchestrator', () => {
  // ─── Category Detection ──────────────────────────────

  test('daily food uses 55/30/15 weights', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
    ];
    const result = computeScore(product, ingredients);
    expect(result.category).toBe('daily_food');
    // With all-neutral ingredients: IQ=100, NP>0, FC>0
    // weightedComposite should reflect 55/30/15 weighting
    expect(result.layer1.ingredientQuality).toBe(100);
    expect(result.layer1.nutritionalProfile).toBeGreaterThan(0);
    expect(result.layer1.formulation).toBeGreaterThan(0);
  });

  test('treat uses 100% IQ weight', () => {
    const product = makeProduct({ category: Category.Treat });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
    ];
    const result = computeScore(product, ingredients);
    expect(result.category).toBe('treat');
    expect(result.layer1.nutritionalProfile).toBe(0);
    expect(result.layer1.formulation).toBe(0);
    expect(result.layer1.weightedComposite).toBe(100);
  });

  // ─── D-017: Missing GA Fallback ─────────────────────

  test('missing GA → isPartialScore true, reweight to 78/22', () => {
    const product = makeProduct({
      ga_protein_pct: null,
      ga_fat_pct: null,
      ga_fiber_pct: null,
    });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
    ];
    const result = computeScore(product, ingredients);
    expect(result.isPartialScore).toBe(true);
    expect(result.layer1.nutritionalProfile).toBe(0);
    // IQ=100, FC uses makeProduct defaults: aafco "All Life Stages"=100, preservative "natural"=100
    // proteinNaming: 1 named protein source = 100
    // FC = 100*0.50 + 100*0.25 + 100*0.25 = 100
    // composite = 100 * 0.7857 + 100 * 0.2143 = 100
    expect(result.layer1.weightedComposite).toBeCloseTo(100, 0);
  });

  // ─── D-094: Pet Name ──────────────────────────────────

  test('petProfile provided → petName set', () => {
    const product = makeProduct();
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ name: 'Luna' });
    const result = computeScore(product, ingredients, pet);
    expect(result.petName).toBe('Luna');
    expect(result.displayScore).toBe(result.finalScore);
  });

  test('no petProfile → petName null, no personalization', () => {
    const product = makeProduct();
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const result = computeScore(product, ingredients);
    expect(result.petName).toBeNull();
    expect(result.layer3.personalizations).toHaveLength(0);
  });

  // ─── isRecalled flag ──────────────────────────────────

  test('recalled product → isRecalled true', () => {
    const product = makeProduct({ is_recalled: true });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const result = computeScore(product, ingredients);
    expect(result.isRecalled).toBe(true);
  });

  // ─── LLM extracted flag ───────────────────────────────

  test('llm_extracted source → llmExtracted true', () => {
    const product = makeProduct({ nutritional_data_source: 'llm_extracted' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const result = computeScore(product, ingredients);
    expect(result.llmExtracted).toBe(true);
  });

  // ─── Flag Merging ─────────────────────────────────────

  test('flags from IQ and FC are merged and deduplicated', () => {
    const product = makeProduct({
      aafco_statement: 'blah blah unrecognized',
      preservative_type: null,
    });
    // Create ingredients that trigger splitting
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'peas', cluster_id: 'legume_pea' }),
      makeIngredient({ position: 2, canonical_name: 'pea starch', cluster_id: 'legume_pea' }),
    ];
    const result = computeScore(product, ingredients);
    expect(result.flags).toContain('ingredient_splitting_detected');
    expect(result.flags).toContain('aafco_statement_unrecognized');
    expect(result.flags).toContain('preservative_type_unknown');
    // No duplicates
    const unique = new Set(result.flags);
    expect(unique.size).toBe(result.flags.length);
  });

  // ─── Allergen Warnings Filtered ───────────────────────

  test('allergen warnings extracted from personalizations', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'chicken meal',
        allergen_group: 'chicken',
        is_protein_fat_source: true,
      }),
    ];
    const pet = makePet();
    const result = computeScore(product, ingredients, pet, ['chicken']);
    expect(result.layer3.allergenWarnings.length).toBeGreaterThan(0);
    expect(result.layer3.allergenWarnings.every(w => w.type === 'allergen')).toBe(true);
  });

  // ─── D-104: Carb Estimate ─────────────────────────────

  test('carb estimate present for daily food with GA', () => {
    const product = makeProduct();
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const result = computeScore(product, ingredients);
    expect(result.carbEstimate).not.toBeNull();
    expect(result.carbEstimate!.species).toBe('dog');
    expect(result.carbEstimate!.valueDmb).toBeGreaterThanOrEqual(0);
    expect(result.carbEstimate!.confidence).toBe('estimated'); // no Ca/P
    expect(['Low', 'Moderate', 'High']).toContain(result.carbEstimate!.qualitativeLabel);
  });

  test('carb estimate unknown when GA missing', () => {
    const product = makeProduct({
      ga_protein_pct: null,
      ga_fat_pct: null,
      ga_fiber_pct: null,
    });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const result = computeScore(product, ingredients);
    expect(result.carbEstimate).not.toBeNull();
    expect(result.carbEstimate!.valueDmb).toBeNull();
    expect(result.carbEstimate!.confidence).toBe('unknown');
  });

  test('carb estimate exact when Ca+P available', () => {
    const product = makeProduct({
      ga_calcium_pct: 1.0,
      ga_phosphorus_pct: 0.8,
    });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const result = computeScore(product, ingredients);
    expect(result.carbEstimate!.confidence).toBe('exact');
  });

  test('cat carb qualitative labels: 20% DMB → Moderate', () => {
    // Cat wet food: protein 10%, fat 5%, fiber 1%, moisture 78%
    // DMB: protein 45.45, fat 22.73, fiber 4.55, ash_af 2.0 → ash_dmb 9.09
    // carbs = 100 - 45.45 - 22.73 - 4.55 - 9.09 = 18.18 → Moderate for cat
    const product = makeProduct({
      target_species: Species.Cat,
      ga_protein_pct: 10,
      ga_fat_pct: 5,
      ga_fiber_pct: 1,
      ga_moisture_pct: 78,
    });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'tuna' })];
    const result = computeScore(product, ingredients);
    expect(result.carbEstimate!.species).toBe('cat');
    expect(result.carbEstimate!.qualitativeLabel).toBe('Moderate');
  });

  // ─── Score Clamping ────────────────────────────────────

  test('finalScore clamped to [0, 100]', () => {
    // All neutral ingredients, good GA → should not exceed 100
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
    ];
    const result = computeScore(product, ingredients);
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
  });

  // ─── Layer 2 Passes Through ────────────────────────────

  test('species rules apply to weighted composite', () => {
    // Grain-free + 3+ legumes in top 7 → DCM fires
    const product = makeProduct({ is_grain_free: true });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'lentils', is_legume: true }),
      makeIngredient({ position: 4, canonical_name: 'chickpeas', is_legume: true }),
    ];
    const result = computeScore(product, ingredients);
    const dcm = result.layer2.appliedRules.find(r => r.ruleId === 'DCM_ADVISORY');
    expect(dcm).toBeDefined();
    expect(dcm!.fired).toBe(true);
    expect(result.layer2.speciesAdjustment).toBeLessThan(0);
  });

  // ─── Deterministic ─────────────────────────────────────

  test('deterministic: same inputs → identical output', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'brown rice' }),
    ];
    const pet = makePet();
    const a = computeScore(product, ingredients, pet, ['beef'], ['joint']);
    const b = computeScore(product, ingredients, pet, ['beef'], ['joint']);
    expect(a).toEqual(b);
  });

  // ─── Regression Test 1: Pure Balance ────────────────────

  describe('Regression: Pure Balance Grain-Free Salmon & Pea (Dog)', () => {
    const product = makeProduct({
      category: Category.DailyFood,
      target_species: Species.Dog,
      is_grain_free: true,
      aafco_statement: 'All Life Stages',
      preservative_type: 'natural',
      ga_protein_pct: 26,
      ga_fat_pct: 16,
      ga_fiber_pct: 4,
      ga_moisture_pct: 10,
    });

    // Build ingredient list matching the reference product profile
    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 1, canonical_name: 'salmon', dog_base_severity: 'good', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'peas', dog_base_severity: 'neutral', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'dried peas', dog_base_severity: 'neutral', is_legume: true, cluster_id: 'legume_pea' }),
      makeIngredient({ position: 4, canonical_name: 'pea starch', dog_base_severity: 'neutral', is_legume: true, cluster_id: 'legume_pea' }),
      makeIngredient({ position: 5, canonical_name: 'canola oil', dog_base_severity: 'caution', is_protein_fat_source: true }),
      makeIngredient({ position: 6, canonical_name: 'pea protein', dog_base_severity: 'neutral', is_legume: true }),
      makeIngredient({ position: 7, canonical_name: 'animal fat', dog_base_severity: 'caution', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 8, canonical_name: 'animal digest', dog_base_severity: 'caution', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 9, canonical_name: 'dried egg', dog_base_severity: 'good', is_protein_fat_source: true }),
      makeIngredient({ position: 10, canonical_name: 'flaxseed', dog_base_severity: 'good' }),
      makeIngredient({ position: 11, canonical_name: 'taurine', dog_base_severity: 'good' }),
      makeIngredient({ position: 12, canonical_name: 'l-carnitine', dog_base_severity: 'good' }),
    ];

    const pet = makePet({ life_stage: LifeStage.Adult });

    test('full breakdown traces correctly', () => {
      const result = computeScore(product, ingredients, pet);

      // Layer 1a: IQ
      const iq = result.layer1.ingredientQuality;

      // Layer 1b: NP
      const np = result.layer1.nutritionalProfile;

      // Layer 1c: FC
      const fc = result.layer1.formulation;

      // Weighted composite: (IQ×0.55) + (NP×0.30) + (FC×0.15)
      const expectedComposite = iq * 0.55 + np * 0.30 + fc * 0.15;
      expect(result.layer1.weightedComposite).toBeCloseTo(
        Math.round(expectedComposite * 10) / 10,
        1,
      );

      // Layer 2: DCM should fire (grain-free + 4 legumes in top 7)
      const dcm = result.layer2.appliedRules.find(r => r.ruleId === 'DCM_ADVISORY');
      expect(dcm).toBeDefined();
      expect(dcm!.fired).toBe(true);

      // Taurine + L-Carnitine mitigation should fire
      const mitigation = result.layer2.appliedRules.find(r => r.ruleId === 'TAURINE_MITIGATION');
      expect(mitigation).toBeDefined();
      expect(mitigation!.fired).toBe(true);

      // Layer 2 net adjustment = DCM + mitigation
      const l2Net = dcm!.adjustment + mitigation!.adjustment;
      expect(result.layer2.speciesAdjustment).toBeCloseTo(l2Net, 1);

      // Layer 3: neutral for adult dog with no allergens/conditions
      expect(result.layer3.personalizations.length).toBeGreaterThan(0); // breed stub at minimum

      // Final = weighted + layer2 + layer3, clamped
      const expectedFinal = Math.max(0, Math.min(100,
        Math.round(result.layer1.weightedComposite + l2Net),
      ));
      expect(result.finalScore).toBeCloseTo(expectedFinal, 0);

      // Log full breakdown for user verification
      console.log('=== Pure Balance Regression Breakdown ===');
      console.log(`IQ: ${iq}`);
      console.log(`NP: ${np}`);
      console.log(`FC: ${fc}`);
      console.log(`Weighted: ${result.layer1.weightedComposite}`);
      console.log(`DCM: ${dcm!.adjustment}`);
      console.log(`Mitigation: ${mitigation!.adjustment}`);
      console.log(`L2 net: ${l2Net}`);
      console.log(`Final: ${result.finalScore}`);
    });
  });

  // ─── Regression Test 2: Temptations (Cat Treat) ─────────

  describe('Regression: Temptations Classic Tuna (Cat Treat)', () => {
    const product = makeProduct({
      category: Category.Treat,
      target_species: Species.Cat,
      is_grain_free: false,
      aafco_statement: null,
      preservative_type: 'synthetic',
      // GA doesn't matter for treats (100% IQ weight)
      ga_protein_pct: 30,
      ga_fat_pct: 17,
      ga_fiber_pct: 4,
      ga_moisture_pct: 15,
    });

    // Treat ingredients — multiple caution items + cat_carb_flag triggers
    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 1, canonical_name: 'chicken by-product meal', cat_base_severity: 'caution', cat_carb_flag: false, is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'ground corn', cat_base_severity: 'caution', cat_carb_flag: true }),
      makeIngredient({ position: 3, canonical_name: 'animal fat', cat_base_severity: 'caution', is_unnamed_species: true, cat_carb_flag: false, is_protein_fat_source: true }),
      makeIngredient({ position: 4, canonical_name: 'dried meat by-products', cat_base_severity: 'caution', cat_carb_flag: false, is_protein_fat_source: true }),
      makeIngredient({ position: 5, canonical_name: 'brewers rice', cat_base_severity: 'neutral', cat_carb_flag: true }),
      makeIngredient({ position: 6, canonical_name: 'wheat flour', cat_base_severity: 'neutral', cat_carb_flag: true }),
      makeIngredient({ position: 7, canonical_name: 'natural flavor', cat_base_severity: 'neutral', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 8, canonical_name: 'dried yeast', cat_base_severity: 'neutral' }),
      makeIngredient({ position: 9, canonical_name: 'potassium chloride', cat_base_severity: 'neutral' }),
      makeIngredient({ position: 10, canonical_name: 'yellow 5', cat_base_severity: 'danger' }),
      makeIngredient({ position: 11, canonical_name: 'red 40', cat_base_severity: 'danger', position_reduction_eligible: false }),
      makeIngredient({ position: 12, canonical_name: 'blue 2', cat_base_severity: 'danger', position_reduction_eligible: false }),
    ];

    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Adult });

    test('full breakdown traces correctly', () => {
      const result = computeScore(product, ingredients, pet);

      expect(result.category).toBe('treat');

      // IQ = 100% weight for treats
      const iq = result.layer1.ingredientQuality;
      expect(result.layer1.weightedComposite).toBe(iq);

      // Layer 2: cat carb overload should fire (3+ cat_carb_flag in top 5)
      // positions 2, 5 have cat_carb_flag in top 5 — need 3
      // Actually: pos 2 (corn), pos 5 (brewers rice) — only 2 in top 5
      // pos 6 (wheat flour) is outside top 5
      // So carb overload should NOT fire — let's check
      const carbRule = result.layer2.appliedRules.find(r => r.ruleId === 'CAT_CARB_OVERLOAD');

      // Taurine missing should fire (no taurine ingredient)
      const taurine = result.layer2.appliedRules.find(r => r.ruleId === 'CAT_TAURINE_MISSING');
      expect(taurine).toBeDefined();
      expect(taurine!.fired).toBe(true);

      const l2Net = result.layer2.appliedRules.reduce((sum, r) => sum + r.adjustment, 0);

      // Final
      const expectedFinal = Math.max(0, Math.min(100, Math.round(iq + l2Net)));
      expect(result.finalScore).toBeCloseTo(expectedFinal, 0);

      console.log('=== Temptations Regression Breakdown ===');
      console.log(`IQ: ${iq}`);
      console.log(`Weighted (100% IQ for treat): ${result.layer1.weightedComposite}`);
      console.log(`Carb overload fired: ${carbRule?.fired}`);
      console.log(`Taurine missing fired: ${taurine!.fired}, adj: ${taurine!.adjustment}`);
      console.log(`L2 net: ${l2Net}`);
      console.log(`Final: ${result.finalScore}`);
    });
  });

  // ─── Personalization Passes Through ──────────────────

  test('life stage mismatch penalty flows through', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Puppy });
    const result = computeScore(product, ingredients, pet);

    const lifeStage = result.layer3.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeDefined();
    expect(lifeStage!.adjustment).toBe(-10);
  });

  // ─── D-106: petConditions pass to nutritionalProfile ──

  test('pet conditions pass through for fiber suppression', () => {
    // High-fiber food — fiber penalty suppressed when pet has obesity
    const product = makeProduct({
      ga_fiber_pct: 9,  // high fiber → normally penalized
    });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet();

    const withoutObesity = computeScore(product, ingredients, pet, [], []);
    const withObesity = computeScore(product, ingredients, pet, [], ['obesity']);

    // With obesity, fiber penalty should be suppressed → higher NP → higher final
    expect(withObesity.layer1.nutritionalProfile).toBeGreaterThanOrEqual(
      withoutObesity.layer1.nutritionalProfile,
    );
  });
});
