// Kiba — Scoring Pipeline Tests
// Covers: happy path hydration + scoring, empty ingredients, partial hydration, query errors

import { scoreProduct } from '../../../src/services/scoring/pipeline';
import type { Product, PetProfile } from '../../../src/types';
import { Category, Species, LifeStage } from '../../../src/types';
import type { ScoredResult, ProductIngredient } from '../../../src/types/scoring';

// ─── Mock Setup ──────────────────────────────────────────

let queryResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
};

const mockOrder = jest.fn(() => Promise.resolve(queryResult));
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));

jest.mock('../../../src/services/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock computeScore — pipeline test verifies wiring, not scoring math
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockComputeScore = jest.fn<ScoredResult, any[]>();

jest.mock('../../../src/services/scoring/engine', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeScore: (...args: any[]) => mockComputeScore(...args),
}));

// ─── Fixtures ────────────────────────────────────────────

const MOCK_PRODUCT: Product = {
  id: 'prod-001',
  brand: 'TestBrand',
  name: 'TestFood',
  category: Category.DailyFood,
  target_species: Species.Dog,
  source: 'curated' as const,
  aafco_statement: 'Complete and balanced for all life stages',
  aafco_inference: null,
  life_stage_claim: 'All Life Stages',
  preservative_type: null,
  ga_protein_pct: 28,
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
  source_url: null,
  chewy_sku: null,
  asin: null,
  walmart_id: null,
  price: null,
  price_currency: null,
  product_size_kg: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_PET: PetProfile = {
  id: 'pet-001',
  user_id: 'user-001',
  name: 'Buddy',
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
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeDbRow(position: number, overrides?: Record<string, unknown>) {
  return {
    position,
    ingredient_id: `ing-${position}`,
    ingredients_dict: {
      id: `ing-${position}`,
      canonical_name: `ingredient_${position}`,
      cluster_id: null,
      allergen_group: null,
      allergen_group_possible: [],
      dog_base_severity: 'neutral' as const,
      cat_base_severity: 'neutral' as const,
      is_unnamed_species: false,
      is_legume: false,
      is_pulse: false,
      is_pulse_protein: false,
      position_reduction_eligible: false,
      cat_carb_flag: false,
      display_name: null,
      definition: null,
      tldr: null,
      detail_body: null,
      citations_display: null,
      position_context: null,
      created_at: '2026-01-01T00:00:00Z',
      ...overrides,
    },
  };
}

const MOCK_SCORED_RESULT: ScoredResult = {
  finalScore: 75,
  displayScore: 75,
  petName: 'Buddy',
  layer1: {
    ingredientQuality: 80,
    nutritionalProfile: 70,
    formulation: 65,
    weightedComposite: 75,
  },
  layer2: { speciesAdjustment: 0, appliedRules: [] },
  layer3: { personalizations: [], allergenWarnings: [] },
  ingredientPenalties: [],
  ingredientResults: [],
  flags: [],
  allergenDelta: 0,
  isPartialScore: false,
  isRecalled: false,
  llmExtracted: false,
  carbEstimate: null,
  category: 'daily_food',
};

// ─── Helpers ─────────────────────────────────────────────

function resetMocks() {
  queryResult = { data: null, error: null };
  jest.clearAllMocks();
  mockComputeScore.mockReturnValue(MOCK_SCORED_RESULT);
}

// ─── Tests ───────────────────────────────────────────────

describe('scoreProduct', () => {
  beforeEach(resetMocks);

  it('queries product_ingredients with correct product_id and order', async () => {
    queryResult = { data: [makeDbRow(1), makeDbRow(2)], error: null };

    await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    expect(mockFrom).toHaveBeenCalledWith('product_ingredients');
    expect(mockSelect).toHaveBeenCalledWith(
      'position, ingredient_id, ingredients_dict(*)',
    );
    expect(mockEq).toHaveBeenCalledWith('product_id', 'prod-001');
    expect(mockOrder).toHaveBeenCalledWith('position', { ascending: true });
  });

  it('hydrates DB rows into ProductIngredient[] and calls computeScore', async () => {
    queryResult = {
      data: [
        makeDbRow(1, {
          canonical_name: 'chicken',
          dog_base_severity: 'good',
          is_legume: false,
        }),
        makeDbRow(2, {
          canonical_name: 'peas',
          dog_base_severity: 'neutral',
          is_legume: true,
          cluster_id: 'legume_pea',
        }),
      ],
      error: null,
    };

    const { scoredResult, ingredients: returnedIngredients } =
      await scoreProduct(MOCK_PRODUCT, MOCK_PET, ['beef'], ['obesity']);

    // Verify computeScore was called with hydrated ingredients
    expect(mockComputeScore).toHaveBeenCalledTimes(1);
    const [product, ingredients, pet, allergens, conditions] =
      mockComputeScore.mock.calls[0] as [Product, ProductIngredient[], PetProfile | undefined, string[] | undefined, string[] | undefined];

    expect(product).toBe(MOCK_PRODUCT);
    expect(pet).toBe(MOCK_PET);
    expect(allergens).toEqual(['beef']);
    expect(conditions).toEqual(['obesity']);

    // Verify hydrated shape
    expect(ingredients).toHaveLength(2);
    expect(ingredients[0]).toMatchObject({
      position: 1,
      canonical_name: 'chicken',
      dog_base_severity: 'good',
      is_legume: false,
      is_protein_fat_source: false, // M1 default
    });
    expect(ingredients[1]).toMatchObject({
      position: 2,
      canonical_name: 'peas',
      is_legume: true,
      cluster_id: 'legume_pea',
    });

    expect(scoredResult.finalScore).toBe(75);
    expect(returnedIngredients).toHaveLength(2);
    expect(returnedIngredients).toBe(ingredients);
  });

  it('passes undefined for petProfile when null', async () => {
    queryResult = { data: [makeDbRow(1)], error: null };

    await scoreProduct(MOCK_PRODUCT, null);

    expect(mockComputeScore).toHaveBeenCalledTimes(1);
    const [, , pet] = mockComputeScore.mock.calls[0] as [Product, ProductIngredient[], PetProfile | undefined];
    expect(pet).toBeUndefined();
  });

  it('returns partial result with no_ingredient_data flag on query error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    queryResult = { data: null, error: { message: 'connection refused' } };

    const { scoredResult, ingredients } = await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    expect(scoredResult.finalScore).toBe(0);
    expect(scoredResult.isPartialScore).toBe(true);
    expect(scoredResult.flags).toContain('no_ingredient_data');
    expect(scoredResult.petName).toBe('Buddy');
    expect(ingredients).toHaveLength(0);
    expect(mockComputeScore).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('returns partial result when query returns empty array', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    queryResult = { data: [], error: null };

    const { scoredResult, ingredients } = await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    expect(scoredResult.finalScore).toBe(0);
    expect(scoredResult.isPartialScore).toBe(true);
    expect(scoredResult.flags).toContain('no_ingredient_data');
    expect(ingredients).toHaveLength(0);
    expect(mockComputeScore).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('scores with available data and adds partial flag when some ingredients fail hydration', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    queryResult = {
      data: [
        makeDbRow(1, { canonical_name: 'chicken' }),
        { position: 2, ingredient_id: 'ing-missing', ingredients_dict: null },
        makeDbRow(3, { canonical_name: 'rice' }),
      ],
      error: null,
    };

    const { scoredResult, ingredients: returnedIngredients } =
      await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    // computeScore should be called with only 2 hydrated ingredients
    expect(mockComputeScore).toHaveBeenCalledTimes(1);
    const [, ingredients] = mockComputeScore.mock.calls[0] as [Product, ProductIngredient[]];
    expect(ingredients).toHaveLength(2);
    expect(ingredients[0].canonical_name).toBe('chicken');
    expect(ingredients[1].canonical_name).toBe('rice');

    // partial flag should be merged
    expect(scoredResult.flags).toContain('partial_ingredient_data');
    expect(returnedIngredients).toHaveLength(2);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ing-missing'),
    );

    errorSpy.mockRestore();
  });

  it('returns partial result when all ingredients fail hydration', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    queryResult = {
      data: [
        { position: 1, ingredient_id: 'ing-bad1', ingredients_dict: null },
        { position: 2, ingredient_id: 'ing-bad2', ingredients_dict: null },
      ],
      error: null,
    };

    const { scoredResult, ingredients } = await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    expect(scoredResult.finalScore).toBe(0);
    expect(scoredResult.isPartialScore).toBe(true);
    expect(scoredResult.flags).toContain('no_ingredient_data');
    expect(ingredients).toHaveLength(0);
    expect(mockComputeScore).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('preserves product is_recalled in empty result', async () => {
    queryResult = { data: [], error: null };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const recalledProduct = { ...MOCK_PRODUCT, is_recalled: true };
    const { scoredResult } = await scoreProduct(recalledProduct, null);

    expect(scoredResult.isRecalled).toBe(true);
    expect(scoredResult.petName).toBeNull();
    expect(scoredResult.category).toBe('daily_food');

    errorSpy.mockRestore();
  });

  it('defaults allergen_group_possible to empty array when null from DB', async () => {
    queryResult = {
      data: [
        makeDbRow(1, {
          canonical_name: 'natural flavor',
          allergen_group_possible: null,
        }),
      ],
      error: null,
    };

    await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    const [, ingredients] = mockComputeScore.mock.calls[0] as [Product, ProductIngredient[]];
    expect(ingredients[0].allergen_group_possible).toEqual([]);
  });

  // ─── Species Mismatch Bypass ───────────────────────────

  it('returns species_mismatch bypass when cat food scored for dog pet', async () => {
    queryResult = { data: [makeDbRow(1), makeDbRow(2)], error: null };
    const catProduct = { ...MOCK_PRODUCT, target_species: Species.Cat };

    const { scoredResult, ingredients } = await scoreProduct(catProduct, MOCK_PET);

    expect(scoredResult.bypass).toBe('species_mismatch');
    expect(scoredResult.bypassReason).toBe('This product is formulated for cats');
    expect(scoredResult.flags).toContain('species_mismatch');
    expect(scoredResult.finalScore).toBe(0);
    expect(scoredResult.isPartialScore).toBe(false);
    expect(ingredients).toHaveLength(2); // ingredients still hydrated
    expect(mockComputeScore).not.toHaveBeenCalled();
  });

  it('returns species_mismatch bypass when dog food scored for cat pet', async () => {
    queryResult = { data: [makeDbRow(1)], error: null };
    const catPet = { ...MOCK_PET, species: Species.Cat, name: 'Whiskers' };

    const { scoredResult, ingredients } = await scoreProduct(MOCK_PRODUCT, catPet);

    expect(scoredResult.bypass).toBe('species_mismatch');
    expect(scoredResult.bypassReason).toBe('This product is formulated for dogs');
    expect(scoredResult.flags).toContain('species_mismatch');
    expect(scoredResult.petName).toBe('Whiskers');
    expect(ingredients).toHaveLength(1);
    expect(mockComputeScore).not.toHaveBeenCalled();
  });

  it('scores normally when dog food matches dog pet (no bypass)', async () => {
    queryResult = { data: [makeDbRow(1)], error: null };

    const { scoredResult } = await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    expect(scoredResult.bypass).toBeUndefined();
    expect(scoredResult.finalScore).toBe(75);
    expect(mockComputeScore).toHaveBeenCalledTimes(1);
  });

  it('scores normally when cat food matches cat pet (no bypass)', async () => {
    queryResult = { data: [makeDbRow(1)], error: null };
    const catProduct = { ...MOCK_PRODUCT, target_species: Species.Cat };
    const catPet = { ...MOCK_PET, species: Species.Cat };

    const { scoredResult } = await scoreProduct(catProduct, catPet);

    expect(scoredResult.bypass).toBeUndefined();
    expect(scoredResult.finalScore).toBe(75);
    expect(mockComputeScore).toHaveBeenCalledTimes(1);
  });

  // ─── Variety Pack Bypass ────────────────────────────────

  it('returns variety_pack bypass when product name contains "variety pack"', async () => {
    queryResult = { data: [makeDbRow(1), makeDbRow(2)], error: null };
    const vpProduct = { ...MOCK_PRODUCT, name: 'Fancy Feast Variety Pack 24ct' };

    const { scoredResult, ingredients } = await scoreProduct(vpProduct, MOCK_PET);

    expect(scoredResult.bypass).toBe('variety_pack');
    expect(scoredResult.bypassReason).toBe('This is a variety pack with multiple recipes');
    expect(scoredResult.flags).toContain('variety_pack');
    expect(scoredResult.finalScore).toBe(0);
    expect(scoredResult.isPartialScore).toBe(false);
    expect(ingredients).toHaveLength(2);
    expect(mockComputeScore).not.toHaveBeenCalled();
  });

  it('returns variety_pack bypass when 4+ distinct duplicate canonical names detected', async () => {
    queryResult = {
      data: [
        makeDbRow(1, { canonical_name: 'chicken' }),
        makeDbRow(2, { canonical_name: 'water' }),
        makeDbRow(3, { canonical_name: 'rice' }),
        makeDbRow(4, { canonical_name: 'natural_flavor' }),
        makeDbRow(5, { canonical_name: 'salt' }),
        // Second recipe — 4 duplicated names
        makeDbRow(20, { canonical_name: 'chicken' }),
        makeDbRow(21, { canonical_name: 'water' }),
        makeDbRow(22, { canonical_name: 'rice' }),
        makeDbRow(23, { canonical_name: 'natural_flavor' }),
      ],
      error: null,
    };

    const { scoredResult } = await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    expect(scoredResult.bypass).toBe('variety_pack');
    expect(mockComputeScore).not.toHaveBeenCalled();
  });

  it('scores normally when product is not a variety pack', async () => {
    queryResult = {
      data: [
        makeDbRow(1, { canonical_name: 'chicken' }),
        makeDbRow(2, { canonical_name: 'rice' }),
      ],
      error: null,
    };

    const { scoredResult } = await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    expect(scoredResult.bypass).toBeUndefined();
    expect(scoredResult.finalScore).toBe(75);
    expect(mockComputeScore).toHaveBeenCalledTimes(1);
  });

  it('skips species mismatch bypass when no pet profile (null)', async () => {
    queryResult = { data: [makeDbRow(1)], error: null };

    const { scoredResult } = await scoreProduct(MOCK_PRODUCT, null);

    expect(scoredResult.bypass).toBeUndefined();
    expect(mockComputeScore).toHaveBeenCalledTimes(1);
  });

  it('hydrates display_name from ingredients_dict', async () => {
    queryResult = {
      data: [
        makeDbRow(1, {
          canonical_name: 'bha',
          display_name: 'BHA (Butylated Hydroxyanisole)',
        }),
      ],
      error: null,
    };

    const { ingredients } = await scoreProduct(MOCK_PRODUCT, MOCK_PET);

    expect(ingredients[0].display_name).toBe('BHA (Butylated Hydroxyanisole)');
    expect(ingredients[0].canonical_name).toBe('bha');
  });
});
