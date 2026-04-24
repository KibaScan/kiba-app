// communityService — fetchRecentRecalls + fetchKibaIndexHighlights tests.
// Mirrors bookmarkService.test.ts mockChain pattern.

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import { fetchRecentRecalls, fetchKibaIndexHighlights } from '../../src/services/communityService';
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

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
});

// ─── fetchRecentRecalls ─────────────────────────────────

describe('fetchRecentRecalls', () => {
  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchRecentRecalls()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('queries products with recall + recency filters and returns mapped rows', async () => {
    const rows = [
      { id: 'p-1', brand: 'Acme', name: 'Beef Bites' },
      { id: 'p-2', brand: 'Fluffy', name: 'Salmon Patties' },
    ];
    const chain = mockChain({ data: rows, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchRecentRecalls();

    expect(supabase.from).toHaveBeenCalledWith('products');
    expect(chain.select).toHaveBeenCalledWith('id, brand, name');
    expect(chain.eq).toHaveBeenCalledWith('is_recalled', true);
    expect(chain.gte).toHaveBeenCalled();
    expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual([
      { product_id: 'p-1', brand: 'Acme', name: 'Beef Bites' },
      { product_id: 'p-2', brand: 'Fluffy', name: 'Salmon Patties' },
    ]);
  });

  test('returns [] on supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchRecentRecalls()).resolves.toEqual([]);
  });
});

// ─── fetchKibaIndexHighlights ───────────────────────────

describe('fetchKibaIndexHighlights', () => {
  // Dispatch-by-name helper: candidates RPC returns flat rows, stats RPC
  // returns KibaIndexStats. Mirrors how communityService.ts now consumes them
  // post-migration 052.
  function mockRpcDispatch(options: {
    candidates?: { data: unknown; error: unknown };
    statsByProduct?: Record<string, unknown>;
    statsByProductError?: Record<string, unknown>;
  }) {
    (supabase.rpc as jest.Mock).mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === 'get_kiba_index_candidates') {
        return Promise.resolve(options.candidates ?? { data: [], error: null });
      }
      if (name === 'get_kiba_index_stats') {
        const id = args.p_product_id as string;
        if (options.statsByProductError?.[id]) {
          return Promise.resolve({ data: null, error: options.statsByProductError[id] });
        }
        return Promise.resolve({ data: options.statsByProduct?.[id] ?? null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  }

  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchKibaIndexHighlights('cat')).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('returns [] when no candidate votes exist', async () => {
    mockRpcDispatch({ candidates: { data: [], error: null } });
    await expect(fetchKibaIndexHighlights('dog')).resolves.toEqual([]);
    // Only the candidates RPC should have been called — no stats fan-out.
    const rpcCalls = (supabase.rpc as jest.Mock).mock.calls;
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0][0]).toBe('get_kiba_index_candidates');
  });

  test('returns [] when the candidates RPC errors', async () => {
    mockRpcDispatch({ candidates: { data: null, error: { message: 'boom' } } });
    await expect(fetchKibaIndexHighlights('dog')).resolves.toEqual([]);
  });

  test('returns top 3 per metric for the given species, ranked by ratio', async () => {
    // Five candidate products each with distinct stats so ranking is deterministic.
    const candidates = [
      { product_id: 'p-1', brand: 'A', name: 'One' },
      { product_id: 'p-2', brand: 'B', name: 'Two' },
      { product_id: 'p-3', brand: 'C', name: 'Three' },
      { product_id: 'p-4', brand: 'D', name: 'Four' },
      { product_id: 'p-5', brand: 'E', name: 'Five' },
    ];
    // Stats per product. Ratios:
    //   p-1: taste 0.90 (9/10), tummy 0.80 (8/10)  ← top picky
    //   p-2: taste 0.10 (1/10), tummy 0.10 (1/10)  ← bottom both
    //   p-3: taste 0.80 (8/10), tummy 0.90 (9/10)  ← top tummy
    //   p-4: taste 0.70 (7/10), tummy 0.60 (6/10)  ← mid-tier
    //   p-5: taste 0.50 (1/2),  tummy 0.50 (1/2)   ← under min-vote threshold (2 votes < 3)
    const statsByProduct: Record<string, unknown> = {
      'p-1': { total_votes: 18, taste: { total: 10, loved: 9, picky: 1, refused: 0 }, tummy: { total: 10, perfect: 8, soft_stool: 1, upset: 1 } },
      'p-2': { total_votes: 18, taste: { total: 10, loved: 1, picky: 4, refused: 5 }, tummy: { total: 10, perfect: 1, soft_stool: 4, upset: 5 } },
      'p-3': { total_votes: 18, taste: { total: 10, loved: 8, picky: 1, refused: 1 }, tummy: { total: 10, perfect: 9, soft_stool: 1, upset: 0 } },
      'p-4': { total_votes: 18, taste: { total: 10, loved: 7, picky: 2, refused: 1 }, tummy: { total: 10, perfect: 6, soft_stool: 3, upset: 1 } },
      'p-5': { total_votes: 4,  taste: { total: 2,  loved: 1, picky: 1, refused: 0 }, tummy: { total: 2,  perfect: 1, soft_stool: 1, upset: 0 } },
    };
    mockRpcDispatch({
      candidates: { data: candidates, error: null },
      statsByProduct,
    });

    const result = await fetchKibaIndexHighlights('cat');

    // Picky-eaters top 3 by taste.loved/total: p-1 (0.9), p-3 (0.8), p-4 (0.7)
    const picky = result.filter(r => r.metric === 'picky_eaters');
    expect(picky).toHaveLength(3);
    expect(picky.map(r => r.product_id)).toEqual(['p-1', 'p-3', 'p-4']);
    // Sensitive-tummies top 3 by tummy.perfect/total: p-3 (0.9), p-1 (0.8), p-4 (0.6)
    const tummy = result.filter(r => r.metric === 'sensitive_tummies');
    expect(tummy).toHaveLength(3);
    expect(tummy.map(r => r.product_id)).toEqual(['p-3', 'p-1', 'p-4']);
    // Shape sanity
    expect(result[0]).toEqual(expect.objectContaining({
      brand: expect.any(String),
      name: expect.any(String),
      score: expect.any(Number),
    }));
  });

  test('passes species + limit through to the candidates RPC', async () => {
    mockRpcDispatch({ candidates: { data: [], error: null } });
    await fetchKibaIndexHighlights('cat');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_kiba_index_candidates',
      expect.objectContaining({ p_species: 'cat' }),
    );
  });

  test('skips products with stat-fetch errors instead of crashing', async () => {
    const candidates = [
      { product_id: 'p-1', brand: 'A', name: 'One' },
      { product_id: 'p-2', brand: 'B', name: 'Two' },
    ];
    mockRpcDispatch({
      candidates: { data: candidates, error: null },
      statsByProductError: { 'p-1': { message: 'boom' } },
      statsByProduct: {
        'p-2': { total_votes: 10, taste: { total: 10, loved: 8, picky: 1, refused: 1 }, tummy: { total: 10, perfect: 7, soft_stool: 2, upset: 1 } },
      },
    });

    const result = await fetchKibaIndexHighlights('dog');
    // Only p-2 should appear (p-1 errored)
    const ids = new Set(result.map(r => r.product_id));
    expect(ids.has('p-1')).toBe(false);
    expect(ids.has('p-2')).toBe(true);
  });
});
