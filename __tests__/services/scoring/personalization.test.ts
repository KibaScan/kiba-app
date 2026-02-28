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

  test('direct allergen match: chicken allergen + chicken meal → flag, score unchanged', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'brown rice' }),
    ];
    const pet = makePet({ name: 'Mochi' });
    const result = applyPersonalization(80, product, ingredients, pet, ['chicken']);

    const allergenFlags = result.personalizations.filter(p => p.type === 'allergen');
    expect(allergenFlags).toHaveLength(1);
    expect(allergenFlags[0].severity).toBe('direct_match');
    expect(allergenFlags[0].adjustment).toBe(0);
    expect(allergenFlags[0].label).toContain('chicken meal');
    expect(allergenFlags[0].label).toContain('Mochi');
    expect(result.finalScore).toBe(80);
  });

  test('possible allergen match: chicken allergen + poultry fat → flag, score unchanged', () => {
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

    const allergenFlags = result.personalizations.filter(p => p.type === 'allergen');
    expect(allergenFlags).toHaveLength(1);
    expect(allergenFlags[0].severity).toBe('possible_match');
    expect(allergenFlags[0].adjustment).toBe(0);
    expect(allergenFlags[0].label).toContain('poultry fat');
    expect(allergenFlags[0].label).toContain('chicken');
    expect(allergenFlags[0].label).toContain('Verify with manufacturer');
    expect(result.finalScore).toBe(80);
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

  test('multiple allergen matches on different ingredients', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken meal', allergen_group: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'beef liver', allergen_group: 'beef', is_protein_fat_source: true }),
      makeIngredient({ position: 3, canonical_name: 'brown rice' }),
    ];
    const pet = makePet();
    const result = applyPersonalization(80, product, ingredients, pet, ['chicken', 'beef']);

    const allergenFlags = result.personalizations.filter(p => p.type === 'allergen');
    expect(allergenFlags).toHaveLength(2);
    expect(allergenFlags.every(f => f.severity === 'direct_match')).toBe(true);
    expect(result.finalScore).toBe(80);
  });

  // ─── Life Stage Matching ──────────────────────────────

  test('puppy + adult food → −10 points', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Puppy });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeDefined();
    expect(lifeStage!.adjustment).toBe(-10);
    expect(result.finalScore).toBe(70);
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

  test('adult pet + puppy food → no penalty (growth covers adults)', () => {
    const product = makeProduct({ life_stage_claim: 'Puppy Growth' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Adult });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeUndefined();
  });

  test('senior pet + adult food → no penalty', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet({ life_stage: LifeStage.Senior });
    const result = applyPersonalization(80, product, ingredients, pet);

    const lifeStage = result.personalizations.find(p => p.type === 'life_stage');
    expect(lifeStage).toBeUndefined();
  });

  test('kitten + adult food → −10 points', () => {
    const product = makeProduct({ life_stage_claim: 'Adult Maintenance' });
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

  test('conditions present → flagged with adjustment 0 (M1 stub)', () => {
    const product = makeProduct();
    const ingredients = [makeIngredient({ position: 1, canonical_name: 'chicken' })];
    const pet = makePet();
    const result = applyPersonalization(80, product, ingredients, pet, [], ['ckd', 'joint']);

    const condition = result.personalizations.find(p => p.type === 'condition');
    expect(condition).toBeDefined();
    expect(condition!.adjustment).toBe(0);
    expect(condition!.label).toContain('Mochi');
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
