import { getRecentScans } from '../../src/services/scanHistoryService';

// ─── Mocks ──────────────────────────────────────────────────

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../../src/services/supabase';

// ─── Mock Helpers ───────────────────────────────────────────

function mockChain(result: { data: any; error: any }) {
  const chain: any = {};
  for (const m of ['select', 'eq', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function fakeScan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scan-1',
    product_id: 'prod-1',
    pet_id: 'pet-1',
    final_score: 72,
    scanned_at: '2026-03-23T10:00:00Z',
    products: {
      name: 'Chicken & Rice Formula',
      brand: 'Blue Buffalo',
      image_url: 'https://example.com/img.jpg',
      category: 'daily_food',
      is_supplemental: false,
      is_recalled: false,
      is_vet_diet: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────

describe('getRecentScans', () => {
  test('returns empty array when petId is empty', async () => {
    const result = await getRecentScans('');
    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns mapped scan history items', async () => {
    const chain = mockChain({ data: [fakeScan()], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getRecentScans('pet-1');

    expect(supabase.from).toHaveBeenCalledWith('scan_history');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'scan-1',
      product_id: 'prod-1',
      pet_id: 'pet-1',
      final_score: 72,
      scanned_at: '2026-03-23T10:00:00Z',
      product: {
        name: 'Chicken & Rice Formula',
        brand: 'Blue Buffalo',
        image_url: 'https://example.com/img.jpg',
        category: 'daily_food',
        is_supplemental: false,
        is_recalled: false,
        is_vet_diet: false,
      },
    });
  });

  test('deduplicates by product_id, keeping most recent', async () => {
    const chain = mockChain({
      data: [
        fakeScan({ id: 'scan-2', scanned_at: '2026-03-23T12:00:00Z' }),
        fakeScan({ id: 'scan-1', scanned_at: '2026-03-23T10:00:00Z' }), // same product_id
        fakeScan({ id: 'scan-3', product_id: 'prod-2', scanned_at: '2026-03-22T10:00:00Z' }),
      ],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getRecentScans('pet-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('scan-2'); // most recent for prod-1
    expect(result[1].product_id).toBe('prod-2');
  });

  test('respects limit parameter', async () => {
    const scans = Array.from({ length: 6 }, (_, i) =>
      fakeScan({ id: `scan-${i}`, product_id: `prod-${i}` }),
    );
    const chain = mockChain({ data: scans, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getRecentScans('pet-1', 3);
    expect(result).toHaveLength(3);
  });

  test('returns empty array on Supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'db error' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getRecentScans('pet-1');
    expect(result).toEqual([]);
  });

  test('filters out rows where product is null', async () => {
    const chain = mockChain({
      data: [
        fakeScan({ id: 'scan-1', products: null }),
        fakeScan({ id: 'scan-2', product_id: 'prod-2' }),
      ],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getRecentScans('pet-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('scan-2');
  });
});
