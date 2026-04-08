// Tests for ensureFormScored — triggers batch scoring when browse cache
// is empty for a specific product form (freeze-dried, wet, etc.)

jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../../src/services/batchScoreOnDevice', () => ({
  batchScoreHybrid: jest.fn(),
}));

import { ensureFormScored } from '../../src/services/categoryBrowseService';
import { supabase } from '../../src/services/supabase';
import { batchScoreHybrid } from '../../src/services/batchScoreOnDevice';
import type { Pet } from '../../src/types/pet';

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

function mockChain(result: { count?: number; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  // Make the chain thenable with count result
  (chain as unknown as PromiseLike<unknown>).then = ((
    resolve: (v: unknown) => unknown,
    reject: (v: unknown) => unknown,
  ) => Promise.resolve({ count: result.count ?? 0, error: result.error }).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ensureFormScored', () => {
  test('cache has scores: returns false, does not trigger scoring', async () => {
    const chain = mockChain({ count: 42, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await ensureFormScored('pet-1', makePet(), 'daily_food', 'freeze_dried');

    expect(result).toBe(false);
    expect(batchScoreHybrid).not.toHaveBeenCalled();
    // Verify correct query shape
    expect(chain.eq).toHaveBeenCalledWith('pet_id', 'pet-1');
    expect(chain.eq).toHaveBeenCalledWith('category', 'daily_food');
    expect(chain.eq).toHaveBeenCalledWith('product_form', 'freeze_dried');
  });

  test('cache empty: triggers batchScoreHybrid with correct args', async () => {
    const chain = mockChain({ count: 0, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    (batchScoreHybrid as jest.Mock).mockResolvedValue({ scored: 50, duration_ms: 3000 });

    const pet = makePet();
    const result = await ensureFormScored('pet-1', pet, 'daily_food', 'freeze_dried');

    expect(result).toBe(true);
    expect(batchScoreHybrid).toHaveBeenCalledWith('pet-1', pet, 'daily_food', 'freeze_dried');
  });

  test('count query error: returns false, does not trigger scoring', async () => {
    const chain = mockChain({ count: 0, error: { message: 'RLS error' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await ensureFormScored('pet-1', makePet(), 'daily_food', 'wet');

    expect(result).toBe(false);
    expect(batchScoreHybrid).not.toHaveBeenCalled();
  });

  test('batchScoreHybrid throws: returns false gracefully', async () => {
    const chain = mockChain({ count: 0, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    (batchScoreHybrid as jest.Mock).mockRejectedValue(new Error('network error'));

    const result = await ensureFormScored('pet-1', makePet(), 'daily_food', 'dry');

    expect(result).toBe(false);
    expect(batchScoreHybrid).toHaveBeenCalled();
  });
});
