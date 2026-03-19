// Pantry Service Tests — Offline guard behavior.
// Pattern: jest.mock Supabase + network, mockChain helper, factories.

import {
  addToPantry,
  removePantryItem,
  restockPantryItem,
  updatePantryItem,
  updatePetAssignment,
  sharePantryItem,
  getPantryForPet,
} from '../../src/services/pantryService';
import { PantryOfflineError } from '../../src/types/pantry';

// ─── Mocks ──────────────────────────────────────────────

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
    },
  },
}));

import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

// ─── Helpers ────────────────────────────────────────────

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'or', 'order']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

// ─── Setup ──────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
});

// ─── Offline Guards ─────────────────────────────────────

describe('offline guards', () => {
  beforeEach(() => {
    (isOnline as jest.Mock).mockResolvedValue(false);
  });

  test('addToPantry throws PantryOfflineError when offline', async () => {
    await expect(
      addToPantry({
        product_id: 'prod-1',
        quantity_original: 24,
        quantity_unit: 'units',
        serving_mode: 'unit',
        serving_size: 1,
        serving_size_unit: 'units',
        feedings_per_day: 2,
        feeding_frequency: 'daily',
      }, 'pet-1'),
    ).rejects.toThrow(PantryOfflineError);

    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('removePantryItem throws PantryOfflineError when offline', async () => {
    await expect(removePantryItem('item-1')).rejects.toThrow(PantryOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('restockPantryItem throws PantryOfflineError when offline', async () => {
    await expect(restockPantryItem('item-1')).rejects.toThrow(PantryOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('updatePantryItem throws PantryOfflineError when offline', async () => {
    await expect(updatePantryItem('item-1', { quantity_remaining: 10 })).rejects.toThrow(PantryOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('updatePetAssignment throws PantryOfflineError when offline', async () => {
    await expect(updatePetAssignment('assign-1', { serving_size: 2 })).rejects.toThrow(PantryOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('sharePantryItem throws PantryOfflineError when offline', async () => {
    await expect(
      sharePantryItem('item-1', 'pet-2', {
        serving_size: 1,
        serving_size_unit: 'cups',
        feedings_per_day: 2,
        feeding_frequency: 'daily',
      }),
    ).rejects.toThrow(PantryOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('getPantryForPet returns [] when offline', async () => {
    // getPantryForPet doesn't call requireOnline() — it catches Supabase errors gracefully
    const chain = mockChain({ data: null, error: { message: 'network error' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getPantryForPet('pet-1');
    expect(result).toEqual([]);
  });
});
