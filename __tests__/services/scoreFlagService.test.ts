// scoreFlagService — submitFlag + fetchMyFlags + fetchCommunityActivityCounts.
// Mirrors recipeService.test.ts mocking pattern (Supabase + network). Reads
// return [] on DB error per src/services/CLAUDE.md convention (blogService,
// recipeService, appointmentService all do this). Writes still throw.

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

import {
  submitFlag,
  fetchMyFlags,
  fetchCommunityActivityCounts,
} from '../../src/services/scoreFlagService';
import {
  ScoreFlagOfflineError,
  type ScoreFlag,
  type SubmitScoreFlagInput,
  type CommunityActivityCount,
} from '../../src/types/scoreFlag';
import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'or', 'order', 'limit', 'not', 'gte', 'lte']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

const SAMPLE_INPUT: SubmitScoreFlagInput = {
  pet_id: 'pet-1',
  product_id: 'prod-1',
  scan_id: 'scan-1',
  reason: 'score_wrong',
  detail: 'I think this should score higher.',
};

const SAMPLE_FLAG: ScoreFlag = {
  id: 'flag-1',
  user_id: 'user-1',
  pet_id: 'pet-1',
  product_id: 'prod-1',
  scan_id: 'scan-1',
  reason: 'score_wrong',
  detail: 'I think this should score higher.',
  status: 'open',
  admin_note: null,
  created_at: '2026-04-20T00:00:00Z',
  reviewed_at: null,
};

const SAMPLE_COUNTS: CommunityActivityCount[] = [
  { reason: 'recalled', count: 12 },
  { reason: 'score_wrong', count: 8 },
  { reason: 'ingredient_missing', count: 3 },
];

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
});

// ─── submitFlag ─────────────────────────────────────────

describe('submitFlag', () => {
  test('throws ScoreFlagOfflineError when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(submitFlag(SAMPLE_INPUT)).rejects.toBeInstanceOf(ScoreFlagOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('throws when there is no auth user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
    await expect(submitFlag(SAMPLE_INPUT)).rejects.toThrow(/auth|user/i);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('happy path: inserts row with RLS-safe minimal payload, returns inserted row', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const chain = mockChain({ data: SAMPLE_FLAG, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await submitFlag(SAMPLE_INPUT);

    expect(supabase.from).toHaveBeenCalledWith('score_flags');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        pet_id: 'pet-1',
        product_id: 'prod-1',
        scan_id: 'scan-1',
        reason: 'score_wrong',
        detail: 'I think this should score higher.',
      }),
    );
    // RLS WITH CHECK pins these — must not be in the payload (defaults handle).
    const insertPayload = (chain.insert as jest.Mock).mock.calls[0][0];
    expect(insertPayload.status).toBeUndefined();
    expect(insertPayload.admin_note).toBeUndefined();
    expect(insertPayload.reviewed_at).toBeUndefined();

    expect(chain.select).toHaveBeenCalled();
    expect(chain.single).toHaveBeenCalled();
    expect(result).toEqual(SAMPLE_FLAG);
  });

  test('omits scan_id and detail when caller did not supply them', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const chain = mockChain({ data: SAMPLE_FLAG, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await submitFlag({
      pet_id: 'pet-1',
      product_id: 'prod-1',
      reason: 'other',
    });

    const insertPayload = (chain.insert as jest.Mock).mock.calls[0][0];
    expect(insertPayload.scan_id).toBeNull();
    expect(insertPayload.detail).toBeNull();
    expect(insertPayload.reason).toBe('other');
  });

  test('propagates DB error', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const chain = mockChain({ data: null, error: { message: 'rls violation' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(submitFlag(SAMPLE_INPUT)).rejects.toThrow(/insert|rls/i);
  });
});

// ─── fetchMyFlags ───────────────────────────────────────

describe('fetchMyFlags', () => {
  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchMyFlags()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns [] when no auth user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
    await expect(fetchMyFlags()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('queries score_flags for current user, ordered by created_at DESC', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const chain = mockChain({ data: [SAMPLE_FLAG], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchMyFlags();

    expect(supabase.from).toHaveBeenCalledWith('score_flags');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([SAMPLE_FLAG]);
  });

  test('returns [] on DB error', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(fetchMyFlags()).resolves.toEqual([]);
  });
});

// ─── fetchCommunityActivityCounts ───────────────────────

describe('fetchCommunityActivityCounts', () => {
  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchCommunityActivityCounts()).resolves.toEqual([]);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('returns reason counts from RPC', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: SAMPLE_COUNTS, error: null });

    const result = await fetchCommunityActivityCounts();

    expect(supabase.rpc).toHaveBeenCalledWith('get_score_flag_activity_counts');
    expect(result).toEqual(SAMPLE_COUNTS);
  });

  test('returns [] when RPC returns null data', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
    await expect(fetchCommunityActivityCounts()).resolves.toEqual([]);
  });

  test('returns [] on RPC error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    });
    await expect(fetchCommunityActivityCounts()).resolves.toEqual([]);
  });
});
