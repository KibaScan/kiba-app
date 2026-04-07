// Batch Score On-Device Tests — orchestration only.
// Scoring engine correctness covered by regressionAnchors.test.ts.
// Pattern: jest.mock Supabase + petService + scoring deps, mockChain helper.

jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../../src/services/petService', () => ({
  getPetAllergens: jest.fn(),
  getPetConditions: jest.fn(),
}));

jest.mock('../../src/services/scoring/engine', () => ({
  computeScore: jest.fn(),
}));

jest.mock('../../src/services/scoring/pipeline', () => ({
  hydrateIngredient: jest.fn(),
}));

jest.mock('../../src/utils/varietyPackDetector', () => ({
  detectVarietyPack: jest.fn(),
}));

jest.mock('../../src/utils/supplementalClassifier', () => ({
  isSupplementalByName: jest.fn(),
}));

import { batchScoreOnDevice } from '../../src/services/batchScoreOnDevice';
import { supabase } from '../../src/services/supabase';
import { getPetAllergens, getPetConditions } from '../../src/services/petService';
import { computeScore } from '../../src/services/scoring/engine';
import { hydrateIngredient } from '../../src/services/scoring/pipeline';
import { detectVarietyPack } from '../../src/utils/varietyPackDetector';
import { isSupplementalByName } from '../../src/utils/supplementalClassifier';
import type { Pet } from '../../src/types/pet';

// ─── Helpers ────────────────────────────────────────────

/** Builds a fluent Supabase query chain that resolves to `result`. */
function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'in', 'neq', 'or', 'order', 'limit', 'range']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.upsert = jest.fn().mockResolvedValue({ error: null });
  // Make the chain itself thenable (for queries without .maybeSingle)
  (chain as unknown as PromiseLike<unknown>).then = ((
    resolve: (v: unknown) => unknown,
    reject: (v: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Buster',
    species: 'dog',
    breed: 'Labrador',
    weight_current_lbs: 65,
    weight_goal_lbs: null,
    weight_updated_at: null,
    date_of_birth: '2022-06-15',
    dob_is_approximate: false,
    activity_level: 'moderate',
    is_neutered: true,
    sex: 'male',
    photo_url: null,
    life_stage: 'adult',
    breed_size: 'large',
    health_reviewed_at: null,
    weight_goal_level: null,
    caloric_accumulator: null,
    accumulator_last_reset_at: null,
    accumulator_notification_sent: null,
    bcs_score: null,
    bcs_assessed_at: null,
    feeding_style: 'dry_only',
    wet_reserve_kcal: 0,
    wet_reserve_source: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

const MOCK_PRODUCT = {
  id: 'prod-1',
  brand: 'Acme',
  name: 'Acme Dog Kibble',
  category: 'daily_food',
  target_species: 'dog',
  is_supplemental: false,
  is_vet_diet: false,
  is_recalled: false,
  product_form: 'dry',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_INGREDIENT_ROW = {
  product_id: 'prod-1',
  position: 1,
  ingredient_id: 'ing-1',
  ingredients_dict: { canonical_name: 'chicken' },
};

// ─── Setup ──────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (getPetAllergens as jest.Mock).mockResolvedValue([]);
  (getPetConditions as jest.Mock).mockResolvedValue([]);
  (detectVarietyPack as jest.Mock).mockReturnValue(false);
  (isSupplementalByName as jest.Mock).mockReturnValue(false);
  (hydrateIngredient as jest.Mock).mockImplementation((row: Record<string, unknown>) =>
    row.ingredients_dict ? { position: row.position, canonical_name: 'chicken' } : null,
  );
  (computeScore as jest.Mock).mockReturnValue({
    finalScore: 72,
    isPartialScore: false,
    category: 'daily_food',
    flags: [],
  });
});

/**
 * Helper: wires supabase.from() to return different chains per table.
 * Tables: pets (pet anchor), products (candidates), product_ingredients (ingredients),
 * pet_product_scores (upsert target).
 */
function setupSupabaseMocks(opts: {
  petRow?: Record<string, unknown> | null;
  products?: Record<string, unknown>[];
  ingredientPages?: Record<string, unknown>[][];
  upsertError?: { message: string } | null;
} = {}) {
  const petChain = mockChain({
    data: opts.petRow ?? { id: 'pet-1', updated_at: '2026-03-01T00:00:00Z', health_reviewed_at: null },
    error: null,
  });

  const productChain = mockChain({
    data: opts.products ?? [MOCK_PRODUCT],
    error: null,
  });

  // Ingredient pages: return pages sequentially, then empty
  const ingredientPages = opts.ingredientPages ?? [[MOCK_INGREDIENT_ROW]];
  let pageIndex = 0;
  const ingredientChain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'in', 'order']) {
    ingredientChain[m] = jest.fn(() => ingredientChain);
  }
  ingredientChain.range = jest.fn(() => {
    const page = ingredientPages[pageIndex] ?? [];
    pageIndex++;
    const result = { data: page, error: null };
    const thenable = {
      then: ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'],
    };
    return Object.assign(ingredientChain, thenable);
  });
  (ingredientChain as unknown as PromiseLike<unknown>).then = ((
    resolve: (v: unknown) => unknown,
    reject: (v: unknown) => unknown,
  ) => {
    const page = ingredientPages[pageIndex] ?? [];
    pageIndex++;
    return Promise.resolve({ data: page, error: null }).then(resolve, reject);
  }) as PromiseLike<unknown>['then'];

  const upsertChain = mockChain({ data: null, error: null });
  upsertChain.upsert = jest.fn().mockResolvedValue({ error: opts.upsertError ?? null });

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    switch (table) {
      case 'pets': return petChain;
      case 'products': return productChain;
      case 'product_ingredients': return ingredientChain;
      case 'pet_product_scores': return upsertChain;
      default: return mockChain({ data: null, error: null });
    }
  });

  return { petChain, productChain, ingredientChain, upsertChain };
}

// ─── Tests ──────────────────────────────────────────────

describe('batchScoreOnDevice', () => {
  test('happy path: fetches, scores, upserts, returns count', async () => {
    const { upsertChain } = setupSupabaseMocks();

    const result = await batchScoreOnDevice('pet-1', makePet());

    expect(result.scored).toBe(1);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(getPetAllergens).toHaveBeenCalledWith('pet-1');
    expect(getPetConditions).toHaveBeenCalledWith('pet-1');
    expect(computeScore).toHaveBeenCalledTimes(1);
    expect(upsertChain.upsert).toHaveBeenCalledTimes(1);

    // Verify upsert row shape
    const upsertedRows = upsertChain.upsert.mock.calls[0][0];
    expect(upsertedRows[0]).toMatchObject({
      pet_id: 'pet-1',
      product_id: 'prod-1',
      final_score: 72,
      is_partial_score: false,
      is_supplemental: false,
      category: 'daily_food',
      scoring_version: '1',
    });
  });

  test('rate limit: returns scored=0 within 5 minutes', async () => {
    setupSupabaseMocks();

    // First call should score
    const first = await batchScoreOnDevice('pet-rate', makePet({ id: 'pet-rate' }));
    expect(first.scored).toBe(1);

    // Second call within 5 min should be rate-limited
    const second = await batchScoreOnDevice('pet-rate', makePet({ id: 'pet-rate' }));
    expect(second.scored).toBe(0);
    expect(second.duration_ms).toBe(0);
  });

  test('empty products: returns scored=0 gracefully', async () => {
    setupSupabaseMocks({ products: [] });

    const result = await batchScoreOnDevice('pet-empty', makePet({ id: 'pet-empty' }));
    expect(result.scored).toBe(0);
    expect(computeScore).not.toHaveBeenCalled();
  });

  test('variety pack products are skipped', async () => {
    (detectVarietyPack as jest.Mock).mockReturnValue(true);
    setupSupabaseMocks();

    const result = await batchScoreOnDevice('pet-vp', makePet({ id: 'pet-vp' }));
    expect(result.scored).toBe(0);
    expect(computeScore).not.toHaveBeenCalled();
  });

  test('supplemental detection overrides is_supplemental', async () => {
    (isSupplementalByName as jest.Mock).mockReturnValue(true);
    setupSupabaseMocks();

    await batchScoreOnDevice('pet-supp', makePet({ id: 'pet-supp' }));

    // computeScore should receive product with is_supplemental = true
    const scoredProduct = (computeScore as jest.Mock).mock.calls[0][0];
    expect(scoredProduct.is_supplemental).toBe(true);
  });

  test('products with no ingredients are skipped', async () => {
    (hydrateIngredient as jest.Mock).mockReturnValue(null);
    setupSupabaseMocks();

    const result = await batchScoreOnDevice('pet-noimg', makePet({ id: 'pet-noimg' }));
    expect(result.scored).toBe(0);
    expect(computeScore).not.toHaveBeenCalled();
  });

  test('pet not found throws', async () => {
    // Override from('pets') to return an error instead of data
    const petErrChain = mockChain({ data: null, error: { message: 'not found' } });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'pets') return petErrChain;
      return mockChain({ data: null, error: null });
    });

    await expect(
      batchScoreOnDevice('pet-missing', makePet({ id: 'pet-missing' })),
    ).rejects.toThrow('Pet not found');
  });

  test('upsert error does not throw (logs and continues)', async () => {
    setupSupabaseMocks({ upsertError: { message: 'RLS violation' } });

    // Should not throw — errors are logged, not thrown
    const result = await batchScoreOnDevice('pet-upsert', makePet({ id: 'pet-upsert' }));
    expect(result.scored).toBe(1);
  });

  test('allergens and conditions are passed to computeScore', async () => {
    (getPetAllergens as jest.Mock).mockResolvedValue([
      { allergen: 'chicken', is_custom: false },
    ]);
    (getPetConditions as jest.Mock).mockResolvedValue([
      { condition_tag: 'obesity' },
    ]);
    setupSupabaseMocks();

    await batchScoreOnDevice('pet-allerg', makePet({ id: 'pet-allerg' }));

    const callArgs = (computeScore as jest.Mock).mock.calls[0];
    expect(callArgs[3]).toEqual(['chicken']); // allergens
    expect(callArgs[4]).toEqual(['obesity']); // conditions
  });
});
