// Kiba Index Service Tests — fetchKibaIndexStats, fetchUserVote, submitKibaIndexVote.
// Pattern: jest.mock Supabase + network, mockChain helper (matches appointmentService.test.ts).

import {
  fetchKibaIndexStats,
  fetchUserVote,
  submitKibaIndexVote,
} from '../../src/services/kibaIndexService';

// ─── Mocks ──────────────────────────────────────────────

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
  },
}));

import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

// ─── Helpers ────────────────────────────────────────────

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'upsert', 'eq', 'order', 'maybeSingle']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  // Make chain thenable for queries without terminal call
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

const MOCK_STATS = {
  total_votes: 42,
  taste: { total: 30, loved: 20, picky: 7, refused: 3 },
  tummy: { total: 25, perfect: 18, soft_stool: 5, upset: 2 },
};

const MOCK_VOTE = {
  taste_vote: 'loved' as const,
  tummy_vote: 'perfect' as const,
};

// ─── Setup ──────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: 'user-1' } },
  });
});

// ─── fetchKibaIndexStats ────────────────────────────────

describe('fetchKibaIndexStats', () => {
  test('returns stats from RPC on success', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: MOCK_STATS, error: null });

    const result = await fetchKibaIndexStats('prod-1', 'dog');

    expect(supabase.rpc).toHaveBeenCalledWith('get_kiba_index_stats', {
      p_product_id: 'prod-1',
      p_species: 'dog',
    });
    expect(result).toEqual(MOCK_STATS);
  });

  test('passes species correctly for cats', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: MOCK_STATS, error: null });

    await fetchKibaIndexStats('prod-2', 'cat');

    expect(supabase.rpc).toHaveBeenCalledWith('get_kiba_index_stats', {
      p_product_id: 'prod-2',
      p_species: 'cat',
    });
  });

  test('returns null on RPC error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    const result = await fetchKibaIndexStats('prod-1', 'dog');

    expect(result).toBeNull();
  });
});

// ─── fetchUserVote ──────────────────────────────────────

describe('fetchUserVote', () => {
  test('returns vote on success', async () => {
    const chain = mockChain({ data: MOCK_VOTE, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchUserVote('prod-1', 'pet-1');

    expect(supabase.from).toHaveBeenCalledWith('kiba_index_votes');
    expect(chain.select).toHaveBeenCalledWith('taste_vote, tummy_vote');
    expect(chain.eq).toHaveBeenCalledWith('product_id', 'prod-1');
    expect(chain.eq).toHaveBeenCalledWith('pet_id', 'pet-1');
    expect(result).toEqual(MOCK_VOTE);
  });

  test('returns null when no vote exists', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchUserVote('prod-1', 'pet-1');

    expect(result).toBeNull();
  });

  test('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'Query failed' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchUserVote('prod-1', 'pet-1');

    expect(result).toBeNull();
  });
});

// ─── submitKibaIndexVote ────────────────────────────────

describe('submitKibaIndexVote', () => {
  test('returns false when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);

    const result = await submitKibaIndexVote('prod-1', 'pet-1', 'loved', 'perfect');

    expect(result).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns false when no authenticated user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
    });

    const result = await submitKibaIndexVote('prod-1', 'pet-1', 'loved', 'perfect');

    expect(result).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('upserts vote with correct payload on success', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await submitKibaIndexVote('prod-1', 'pet-1', 'loved', 'perfect');

    expect(result).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('kiba_index_votes');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        pet_id: 'pet-1',
        product_id: 'prod-1',
        taste_vote: 'loved',
        tummy_vote: 'perfect',
      }),
      { onConflict: 'user_id, pet_id, product_id' },
    );
  });

  test('includes voted_at timestamp in upsert payload', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await submitKibaIndexVote('prod-1', 'pet-1', 'loved', null);

    const upsertPayload = (chain.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertPayload.voted_at).toBeDefined();
    expect(typeof upsertPayload.voted_at).toBe('string');
  });

  test('handles partial vote (taste only, tummy null)', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await submitKibaIndexVote('prod-1', 'pet-1', 'picky', null);

    const upsertPayload = (chain.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertPayload.taste_vote).toBe('picky');
    expect(upsertPayload.tummy_vote).toBeNull();
  });

  test('returns false on Supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'Upsert failed' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await submitKibaIndexVote('prod-1', 'pet-1', 'loved', 'perfect');

    expect(result).toBe(false);
  });
});
