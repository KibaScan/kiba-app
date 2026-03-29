// Top Matches Service Tests — Cache freshness checks.
// Pattern: jest.mock Supabase + lifeStage, mockChain helper.

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

jest.mock('../../src/utils/lifeStage', () => ({
  deriveLifeStage: jest.fn(),
  parseDateString: jest.fn(),
}));

import { checkCacheFreshness } from '../../src/services/topMatches';
import { supabase } from '../../src/services/supabase';
import { deriveLifeStage, parseDateString } from '../../src/utils/lifeStage';
import type { Pet } from '../../src/types/pet';

// ─── Helpers ────────────────────────────────────────────

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.single = jest.fn().mockResolvedValue(result);
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
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
    health_reviewed_at: '2026-03-01T00:00:00Z',
    weight_goal_level: null,
    caloric_accumulator: null,
    accumulator_last_reset_at: null,
    accumulator_notification_sent: null,
    bcs_score: null,
    bcs_assessed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

const FRESH_CACHED_ROW = {
  life_stage_at_scoring: 'adult',
  pet_updated_at: '2026-03-01T00:00:00Z',
  pet_health_reviewed_at: '2026-03-01T00:00:00Z',
  scoring_version: '1',
};

// ─── Setup ──────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (parseDateString as jest.Mock).mockReturnValue({ year: 2022, month: 5, day: 15 });
  (deriveLifeStage as jest.Mock).mockReturnValue('adult');
});

// ─── checkCacheFreshness ────────────────────────────────

describe('checkCacheFreshness', () => {
  test('returns false on empty cache (no rows)', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await checkCacheFreshness(makePet());
    expect(result).toBe(false);
  });

  test('returns false on life stage drift', async () => {
    const chain = mockChain({ data: { ...FRESH_CACHED_ROW, life_stage_at_scoring: 'adult' }, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    (deriveLifeStage as jest.Mock).mockReturnValue('senior');

    const result = await checkCacheFreshness(makePet());
    expect(result).toBe(false);
  });

  test('returns false on profile edit', async () => {
    const chain = mockChain({ data: { ...FRESH_CACHED_ROW }, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const pet = makePet({ updated_at: '2026-03-15T00:00:00Z' });
    const result = await checkCacheFreshness(pet);
    expect(result).toBe(false);
  });

  test('returns false on health update', async () => {
    const chain = mockChain({ data: { ...FRESH_CACHED_ROW }, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const pet = makePet({ health_reviewed_at: '2026-03-15T00:00:00Z' });
    const result = await checkCacheFreshness(pet);
    expect(result).toBe(false);
  });

  test('returns false on version mismatch', async () => {
    const chain = mockChain({ data: { ...FRESH_CACHED_ROW, scoring_version: '0' }, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await checkCacheFreshness(makePet());
    expect(result).toBe(false);
  });

  test('returns true when all checks pass', async () => {
    const chain = mockChain({ data: { ...FRESH_CACHED_ROW }, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await checkCacheFreshness(makePet());
    expect(result).toBe(true);
  });
});
