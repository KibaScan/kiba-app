import { applyPersonalization } from '../../../src/services/scoring/personalization';
import type { Product } from '../../../src/types';
import type { ProductIngredient, PersonalizationDetail } from '../../../src/types/scoring';
import { Category, Species, LifeStage } from '../../../src/types';
import type { PetProfile } from '../../../src/types';

// ─── UPVM Prohibited Terms (D-095) ────────────────────────

const UPVM_PROHIBITED = ['prescribe', 'treat', 'cure', 'prevent', 'diagnose'];

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
    preservative_type: null,
    ga_protein_pct: null,
    ga_fat_pct: null,
    ga_fiber_pct: null,
    ga_moisture_pct: null,
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
    image_url: null,
    is_recalled: false,
    is_grain_free: false,
    product_form: null,
    is_supplemental: false,
    is_vet_diet: false,
    base_score: null,
    base_score_computed_at: null,
    score_confidence: 'high',
    needs_review: false,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    price: null,
    price_currency: null,
    product_size_kg: null,
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
    date_of_birth: null,
    dob_is_approximate: false,
    weight_current_lbs: null,
    weight_goal_lbs: null,
    weight_updated_at: null,
    activity_level: 'moderate',
    is_neutered: true,
    sex: null,
    breed_size: null,
    life_stage: LifeStage.Adult,
    photo_url: null,
    health_reviewed_at: null,
    weight_goal_level: null,
    caloric_accumulator: null,
    accumulator_last_reset_at: null,
    accumulator_notification_sent: null,
    bcs_score: null,
    bcs_assessed_at: null,
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
    is_pulse: false,
    is_pulse_protein: false,
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

describe('applyPersonalization — Layer 3', () => {
  // ─── Null pet profile ─────────────────────────────────

  test('petProfile = null → score unchanged, empty personalizations', () => {
    const product = makeProduct();
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const result = applyPersonalization(80, product, ingredients, null);
    expect(result.finalScore).toBe(80);
    expect(result.personalizations).toHaveLength(0);
  });

  // ─── Allergen Cross-Reference ─────────────────────────

  test('direct allergen match: chicken allergen + chicken meal → flag + cap at 50 (D-167)', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'brown rice' }),
    ];
    const pet = makePet({ name: 'Mochi' });
    const result = applyPersonalization(80, product, ingredients, pet, ['chicken']);

    const allergenFlags = result.personalizations.filter(p => p.type === 'allergen' && p.adjustment === 0);
    expect(allergenFlags).toHaveLength(1);
    expect(allergenFlags[0].severity).toBe('direct_match');
    expect(allergenFlags[0].label).toContain('Chicken meal');
    expect(allergenFlags[0].label).toContain('Mochi');

    // D-167: score capped at 50, cap entry present
    const capEntry = result.personalizations.find(p => p.type === 'allergen' && p.adjustment !== 0);
    expect(capEntry).toBeDefined();
    expect(capEntry!.adjustment).toBe(-30);
    expect(result.finalScore).toBe(50);
  });

  test('possible allergen match: chicken allergen + poultry fat → flag + cap at 50 (D-167)', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'poultry fat',
        allergen_group: null,
        allergen_group_possible: ['chicken', 'turkey'],
        is_protein_fat_source: true,
      }),
    ];
    const pet = makePet({ name: 'Mochi' });
    const result = applyPersonalization(80, product, ingredients, pet, ['chicken']);

    const allergenFlags = result.personalizations.filter(p => p.type === 'allergen' && p.adjustment === 0);
    expect(allergenFlags).toHaveLength(1);
    expect(allergenFlags[0].severity).toBe('possible_match');
    expect(allergenFlags[0].label).toContain('Poultry fat');
    expect(allergenFlags[0].label).toContain('chicken');
    expect(allergenFlags[0].label).toContain('Verify with manufacturer');

    // D-167: possible matches also trigger cap
    expect(result.finalScore).toBe(50);
  });

  test('no allergen match: pet allergic to beef, product has chicken → no flags', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', allergen_group: 'chicken', is_protein_fat_source: true }),
    ];
    const pet = makePet();
    const result = applyPersonalization(80, product, ingredients, pet, ['beef']);

    const allergenFlags = result.personalizations.filter(p => p.type === 'allergen');
    expect(allergenFlags).toHaveLength(0);
  });

  test('no allergens provided → no allergen flags', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken' }),
    ];
    const pet = makePet();
    const result = applyPersonalization(80, product, ingredients, pet);

    const allergenFlags = result.personalizations.filter(p => p.type === 'allergen');
    expect(allergenFlags).toHaveLength(0);
  });

  test('multiple allergen matches on different ingredients → cap at 50 (D-167)', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'beef liver', allergen_group: 'beef', is_protein_fat_source: true }),
      makeIngredient({ position: 3, canonical_name: 'brown rice' }),
    ];
    const pet = makePet();
    const result = applyPersonalization(80, product, ingredients, pet, ['chicken', 'beef']);

    const allergenFlags = result.personalizations.filter(p => p.type === 'allergen' && p.adjustment === 0);
    expect(allergenFlags).toHaveLength(2);
    expect(allergenFlags.every(f => f.severity === 'direct_match')).toBe(true);
    expect(result.finalScore).toBe(50);
  });

  // ─── Allergen Score Cap (D-167) ─────────────────────────

  test('allergen cap: score already below 50 → no cap applied', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
    ];
    const pet = makePet();
    const result = applyPersonalization(40, product, ingredients, pet, ['chicken']);

    const capEntry = result.personalizations.find(p => p.type === 'allergen' && p.adjustment !== 0);
    expect(capEntry).toBeUndefined();
    expect(result.finalScore).toBe(40);
  });

  test('allergen cap: score exactly 50 → no cap applied', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
    ];
    const pet = makePet();
    const result = applyPersonalization(50, product, ingredients, pet, ['chicken']);

    const capEntry = result.personalizations.find(p => p.type === 'allergen' && p.adjustment !== 0);
    expect(capEntry).toBeUndefined();
    expect(result.finalScore).toBe(50);
  });

  test('allergen cap: score 51 → capped to 50 with adjustment -1', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
    ];
    const pet = makePet();
    const result = applyPersonalization(51, product, ingredients, pet, ['chicken']);

    const capEntry = result.personalizations.find(p => p.type === 'allergen' && p.adjustment !== 0);
    expect(capEntry).toBeDefined();
    expect(capEntry!.adjustment).toBe(-1);
    expect(result.finalScore).toBe(50);
  });

  test('allergen cap: life stage penalty + allergen → cap still applies if above 50', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
    ];
    // Puppy eating adult food = -15 → 90 - 15 = 75, still > 50 → cap to 50
    const pet = makePet({ life_stage: 'puppy' as any });
    const result = applyPersonalization(90, product, ingredients, pet, ['chicken']);

    expect(result.finalScore).toBe(50);
  });

  test('allergen cap: condition penalty pushes below 50 → no cap needed', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
    ];
    const pet = makePet();
    // Score 55, condition penalty would push to 45 → below cap, so cap is no-op
    const result = applyPersonalization(45, product, ingredients, pet, ['chicken']);

    const capEntry = result.personalizations.find(p => p.type === 'allergen' && p.adjustment !== 0);
    expect(capEntry).toBeUndefined();
    expect(result.finalScore).toBe(45);
  });

  // ─── Life Stage Matching ───────────────────��──────────

  test('puppy + adult daily food → −15 points', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Puppy });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeDefined();
    expect(lifeStage!.adjustment).toBe(-15);
    expect(result.finalScore).toBe(65);
  });

  test('puppy + "All Life Stages" → no penalty', () => {
    const product = makeProduct({ life_stage_claim: 'All Life Stages' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Puppy });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeUndefined();
    expect(result.finalScore).toBe(80);
  });

  test('null life_stage_claim → no penalty', () => {
    const product = makeProduct({ life_stage_claim: null });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Puppy });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeUndefined();
  });

  test('adult pet + puppy food → −5 penalty (growth formula excess Ca/P)', () => {
    const product = makeProduct({ life_stage_claim: 'Puppy Growth' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Adult });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeDefined();
    expect(lifeStage!.adjustment).toBe(-5);
    expect(result.finalScore).toBe(75);
  });

  test('senior pet + adult food → no penalty', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Senior });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeUndefined();
  });

  test('kitten + adult daily food → −15 points', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Kitten });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeDefined();
    expect(lifeStage!.adjustment).toBe(-15);
    expect(result.finalScore).toBe(65);
  });

  test('kitten + adult treat → −5 points', () => {
    const product = makeProduct({ life_stage_claim: 'Adult', category: Category.Treat });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Kitten });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeDefined();
    expect(lifeStage!.adjustment).toBe(-5);
  });

  test('kitten + adult supplemental → −10 points', () => {
    const product = makeProduct({ life_stage_claim: 'Adult', is_supplemental: true });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Kitten });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeDefined();
    expect(lifeStage!.adjustment).toBe(-10);
  });

  // ─── Breed Modifiers ──────────────────────────────────

  test('breed with no modifier data → adjustment 0, no error', () => {
    const product = makeProduct();
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ breed: 'Golden Retriever' });
    const result = applyPersonalization(80, product, ingredients, pet);

    const breed = result.personalizations.find(p => p.type === 'breed');
    expect(breed).toBeDefined();
    expect(breed!.adjustment).toBe(0);
  });

  // ─── Health Conditions ────────────────────────────────

  test('conditions with matching rules → condition adjustments appear', () => {
    // Obesity condition + high-fat product → fires obesity_high_fat_penalty
    const product = makeProduct({ ga_fat_pct: 20, ga_moisture_pct: 10, product_form: 'dry' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet();
    const result = applyPersonalization(80, product, ingredients, pet, [], ['obesity']);

    const conditions = result.personalizations.filter(p => p.type === 'condition');
    expect(conditions.length).toBeGreaterThan(0);
    expect(conditions[0].adjustment).not.toBe(0);
  });

  test('conditions with no matching rules → no condition personalizations', () => {
    // joint has no rules yet (P2), adult dog → no CKD rules fire
    const product = makeProduct();
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet();
    const result = applyPersonalization(80, product, ingredients, pet, [], ['joint']);

    const condition = result.personalizations.find(p => p.type === 'condition');
    expect(condition).toBeUndefined();
  });

  test('no conditions → no condition personalization', () => {
    const product = makeProduct();
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet();
    const result = applyPersonalization(80, product, ingredients, pet, [], []);

    const condition = result.personalizations.find(p => p.type === 'condition');
    expect(condition).toBeUndefined();
  });

  // ─── D-094 Compliance ─────────────────────────────────

  test('every personalization has petName set', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
    ];
    const pet = makePet({ name: 'Luna', life_stage: LifeStage.Puppy });
    const result = applyPersonalization(80, product, ingredients, pet, ['chicken'], ['joint']);

    expect(result.personalizations.length).toBeGreaterThan(0);
    for (const p of result.personalizations) {
      expect(p.petName).toBe('Luna');
    }
  });

  // ─── D-095 UPVM Compliance ────────────────────────────

  test('no label contains UPVM prohibited terms', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'poultry fat', allergen_group_possible: ['chicken', 'turkey'], is_protein_fat_source: true }),
    ];
    const pet = makePet({ life_stage: LifeStage.Puppy });
    const result = applyPersonalization(80, product, ingredients, pet, ['chicken'], ['ckd']);

    for (const p of result.personalizations) {
      const lower = p.label.toLowerCase();
      for (const term of UPVM_PROHIBITED) {
        expect(lower).not.toContain(term);
      }
    }
  });

  // ─── Edge Cases ───────────────────────────────────────

  test('finalScore floors at 0', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Puppy });
    const result = applyPersonalization(5, product, ingredients, pet);
    expect(result.finalScore).toBe(0);
  });

  test('deterministic: same inputs → identical output', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
    ];
    const pet = makePet({ life_stage: LifeStage.Puppy });
    const a = applyPersonalization(80, product, ingredients, pet, ['chicken']);
    const b = applyPersonalization(80, product, ingredients, pet, ['chicken']);
    expect(a).toEqual(b);
  });
});
