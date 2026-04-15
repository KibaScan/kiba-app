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
  getPantryAnchor,
  updateCalorieShares,
  evaluateDietCompleteness,
} from '../../src/services/pantryService';
import { PantryOfflineError } from '../../src/types/pantry';

// ─── Mocks ──────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

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
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'or', 'order', 'limit', 'not']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
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
        feeding_role: 'base',
        auto_deplete_enabled: false,
        calorie_share_pct: 100,
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

// ─── M9 Phase B: getPantryAnchor ────────────────────────

describe('getPantryAnchor', () => {
  function wireAnchor(opts: {
    assignments?: unknown[];
    items?: unknown[];
    scores?: unknown[];
    assignmentsError?: unknown;
    itemsError?: unknown;
  }) {
    const asgnChain = mockChain({ data: opts.assignments ?? [], error: opts.assignmentsError ?? null });
    const itemsChain = mockChain({ data: opts.items ?? [], error: opts.itemsError ?? null });
    const scoresChain = mockChain({ data: opts.scores ?? [], error: null });
    const scanHistoryChain = mockChain({ data: [], error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'pantry_pet_assignments') return asgnChain;
      if (table === 'pantry_items') return itemsChain;
      if (table === 'pet_product_scores') return scoresChain;
      if (table === 'scan_history') return scanHistoryChain;
      return mockChain({ data: null, error: null });
    });
  }

  test('returns [] when the pet has no assignments', async () => {
    wireAnchor({ assignments: [] });
    const result = await getPantryAnchor('pet-1');
    expect(result).toEqual([]);
  });

  test('returns [] when the assignments exist but no items match daily_food filter', async () => {
    wireAnchor({
      assignments: [{ pantry_item_id: 'pi-1', feeding_role: 'base' }],
      items: [{
        id: 'pi-1',
        product_id: 'prod-treat',
        products: { id: 'prod-treat', product_form: null, category: 'treat', is_supplemental: false, is_vet_diet: false },
      }],
    });
    const result = await getPantryAnchor('pet-1');
    expect(result).toEqual([]);
  });

  test('excludes supplemental and vet diet products', async () => {
    wireAnchor({
      assignments: [
        { pantry_item_id: 'pi-1', feeding_role: 'base' },
        { pantry_item_id: 'pi-2', feeding_role: 'base' },
        { pantry_item_id: 'pi-3', feeding_role: null },
      ],
      items: [
        { id: 'pi-1', product_id: 'prod-dry', products: { id: 'prod-dry', product_form: 'dry', category: 'daily_food', is_supplemental: false, is_vet_diet: false } },
        { id: 'pi-2', product_id: 'prod-supp', products: { id: 'prod-supp', product_form: 'wet', category: 'daily_food', is_supplemental: true, is_vet_diet: false } },
        { id: 'pi-3', product_id: 'prod-vet', products: { id: 'prod-vet', product_form: 'dry', category: 'daily_food', is_supplemental: false, is_vet_diet: true } },
      ],
      scores: [{ product_id: 'prod-dry', final_score: 65 }],
    });
    const result = await getPantryAnchor('pet-1');
    expect(result).toHaveLength(1);
    expect(result[0].pantryItemId).toBe('pi-1');
    expect(result[0].feedingRole).toBe('base');
    expect(result[0].productForm).toBe('dry');
    expect(result[0].resolvedScore).toBe(65);
  });

  test('returns both slots for a 2-slot pet with scores hydrated from pet_product_scores', async () => {
    wireAnchor({
      assignments: [
        { pantry_item_id: 'pi-1', feeding_role: 'base' },
        { pantry_item_id: 'pi-2', feeding_role: 'base' },
      ],
      items: [
        { id: 'pi-1', product_id: 'prod-a', products: { id: 'prod-a', product_form: 'dry', category: 'daily_food', is_supplemental: false, is_vet_diet: false } },
        { id: 'pi-2', product_id: 'prod-b', products: { id: 'prod-b', product_form: 'wet', category: 'daily_food', is_supplemental: false, is_vet_diet: false } },
      ],
      scores: [
        { product_id: 'prod-a', final_score: 58 },
        { product_id: 'prod-b', final_score: 82 },
      ],
    });
    const result = await getPantryAnchor('pet-1');
    expect(result).toHaveLength(2);
    expect(result.find(a => a.pantryItemId === 'pi-1')?.resolvedScore).toBe(58);
    expect(result.find(a => a.pantryItemId === 'pi-2')?.resolvedScore).toBe(82);
  });

  test('returns [] gracefully on Supabase error', async () => {
    wireAnchor({ assignmentsError: { message: 'connection failed' } });
    const result = await getPantryAnchor('pet-1');
    expect(result).toEqual([]);
  });
});

// ─── M9 Phase B: removePantryItem active-switch guard ───

describe('removePantryItem active-switch guard', () => {
  test('throws when an active Safe Switch references the pantry item', async () => {
    const switchChain = mockChain({ data: [{ id: 'sw-1' }], error: null });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'safe_switches') return switchChain;
      return mockChain({ data: null, error: null });
    });

    await expect(removePantryItem('pi-1', 'pet-1')).rejects.toThrow(
      'Cancel the active Safe Switch before removing this item',
    );
  });

  test('throws when a paused Safe Switch references the pantry item', async () => {
    const switchChain = mockChain({ data: [{ id: 'sw-2' }], error: null });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'safe_switches') return switchChain;
      return mockChain({ data: null, error: null });
    });

    await expect(removePantryItem('pi-1')).rejects.toThrow(
      'Cancel the active Safe Switch before removing this item',
    );
  });

  test('proceeds when no active or paused switches reference the item', async () => {
    // safe_switches guard returns empty → proceeds to assignment delete path
    const switchChain = mockChain({ data: [], error: null });
    const assignDeleteChain = mockChain({ data: null, error: null });
    const countChain = mockChain({ data: null, error: null });
    (countChain as unknown as { then: (r: (v: unknown) => unknown) => unknown }).then = (resolve) =>
      Promise.resolve({ count: 0, error: null }).then(resolve);
    const itemUpdateChain = mockChain({ data: null, error: null });

    let pantryAssignCallCount = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'safe_switches') return switchChain;
      if (table === 'pantry_pet_assignments') {
        pantryAssignCallCount++;
        // First call: delete. Second call: count check.
        return pantryAssignCallCount === 1 ? assignDeleteChain : countChain;
      }
      if (table === 'pantry_items') return itemUpdateChain;
      return mockChain({ data: null, error: null });
    });

    // Should resolve without throwing (exact flow tested by getPantryForPet tests elsewhere)
    await expect(removePantryItem('pi-1', 'pet-1')).resolves.toBeUndefined();
  });
});

// ─── updateCalorieShares ────────────────────────────────

describe('updateCalorieShares', () => {
  type Row = {
    id: string;
    feedings_per_day: number | null;
    serving_size: number | null;
    calorie_share_pct: number | null;
    pantry_items: { products: Record<string, unknown> } | null;
  };

  function wireShares(rows: Row[], petFeedingStyle: string = 'custom') {
    const pantryChain = mockChain({ data: rows, error: null });
    const petsChain = mockChain({ data: { feeding_style: petFeedingStyle }, error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'pantry_pet_assignments') return pantryChain;
      if (table === 'pets') return petsChain;
      return mockChain({ data: null, error: null });
    });

    return { pantryChain, petsChain };
  }

  test('throws PantryOfflineError when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(
      updateCalorieShares('pet-1', [
        { assignmentId: 'a-1', calorie_share_pct: 100 },
      ]),
    ).rejects.toThrow(PantryOfflineError);
  });

  test('target_kcal=0 writes serving_size=0 via computeAutoServingSize', async () => {
    const { pantryChain } = wireShares([
      {
        id: 'a-1',
        feedings_per_day: 2,
        serving_size: 1,
        calorie_share_pct: 50,
        pantry_items: { products: { ga_kcal_per_cup: 400 } },
      },
    ]);

    await updateCalorieShares('pet-1', [
      { assignmentId: 'a-1', calorie_share_pct: 0, target_kcal: 0 },
    ]);

    const updateCalls = pantryChain.update.mock.calls;
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][0]).toMatchObject({
      calorie_share_pct: 0,
      serving_size: 0,
      serving_size_unit: 'cups',
    });
  });

  test('feedings_per_day=null falls back to 1 feeding/day for back-calc', async () => {
    const { pantryChain } = wireShares([
      {
        id: 'a-1',
        feedings_per_day: null,
        serving_size: 1,
        calorie_share_pct: 100,
        pantry_items: { products: { ga_kcal_per_cup: 400 } },
      },
    ]);

    // 400 kcal / 1 feeding / 400 kcal_per_cup = 1 cup
    await updateCalorieShares('pet-1', [
      { assignmentId: 'a-1', calorie_share_pct: 100, target_kcal: 400 },
    ]);

    const updateCalls = pantryChain.update.mock.calls;
    expect(updateCalls[0][0]).toMatchObject({
      serving_size: 1,
      serving_size_unit: 'cups',
    });
  });

  test('null-kcal product uses proportional fallback from existing serving_size', async () => {
    const { pantryChain } = wireShares([
      {
        id: 'a-1',
        feedings_per_day: 2,
        serving_size: 2,
        calorie_share_pct: 100,
        pantry_items: {
          products: {
            ga_kcal_per_cup: null,
            ga_kcal_per_kg: null,
            kcal_per_unit: null,
            unit_weight_g: null,
            ga_protein_pct: null,
            ga_fat_pct: null,
          },
        },
      },
    ]);

    // oldServing=2, oldShare=100, newShare=50 → 2 * (50/100) = 1
    await updateCalorieShares('pet-1', [
      { assignmentId: 'a-1', calorie_share_pct: 50, target_kcal: 200 },
    ]);

    const updateCalls = pantryChain.update.mock.calls;
    expect(updateCalls[0][0]).toMatchObject({
      calorie_share_pct: 50,
      serving_size: 1,
    });
    // serving_size_unit not touched when using proportional fallback
    expect(updateCalls[0][0]).not.toHaveProperty('serving_size_unit');
  });

  test('mixed shares — one with target_kcal uses back-calc, one without uses proportional', async () => {
    const { pantryChain } = wireShares([
      {
        id: 'a-1',
        feedings_per_day: 2,
        serving_size: 1,
        calorie_share_pct: 50,
        pantry_items: { products: { ga_kcal_per_cup: 300 } },
      },
      {
        id: 'a-2',
        feedings_per_day: 2,
        serving_size: 2,
        calorie_share_pct: 50,
        pantry_items: { products: { ga_kcal_per_cup: 400 } },
      },
    ]);

    await updateCalorieShares('pet-1', [
      { assignmentId: 'a-1', calorie_share_pct: 75, target_kcal: 600 }, // back-calc: 600/2/300 = 1 cup
      { assignmentId: 'a-2', calorie_share_pct: 25 },                   // proportional: 2 * (25/50) = 1
    ]);

    const updateCalls = pantryChain.update.mock.calls;
    expect(updateCalls).toHaveLength(2);
    // Calls come from Promise.all → order matches shares[] order
    expect(updateCalls[0][0]).toMatchObject({
      calorie_share_pct: 75,
      serving_size: 1,
      serving_size_unit: 'cups',
    });
    expect(updateCalls[1][0]).toMatchObject({
      calorie_share_pct: 25,
      serving_size: 1,
    });
    expect(updateCalls[1][0]).not.toHaveProperty('serving_size_unit');
  });

  test('old share 0 + null-kcal product — skips serving_size and warns', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { pantryChain } = wireShares([
      {
        id: 'a-1',
        feedings_per_day: 2,
        serving_size: 0,
        calorie_share_pct: 0,
        pantry_items: {
          products: { ga_kcal_per_cup: null, ga_kcal_per_kg: null, kcal_per_unit: null, unit_weight_g: null },
        },
      },
    ]);

    await updateCalorieShares('pet-1', [
      { assignmentId: 'a-1', calorie_share_pct: 50, target_kcal: 200 },
    ]);

    const updateCalls = pantryChain.update.mock.calls;
    expect(updateCalls[0][0]).toEqual({ calorie_share_pct: 50 });
    expect(updateCalls[0][0]).not.toHaveProperty('serving_size');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('a-1'));

    warnSpy.mockRestore();
  });

  test('absent target_kcal with null-kcal product and no prior serving — leaves serving_size untouched silently', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { pantryChain } = wireShares([
      {
        id: 'a-1',
        feedings_per_day: 2,
        serving_size: null,
        calorie_share_pct: 0,
        pantry_items: { products: { ga_kcal_per_cup: null } },
      },
    ]);

    await updateCalorieShares('pet-1', [
      { assignmentId: 'a-1', calorie_share_pct: 50 }, // no target_kcal
    ]);

    const updateCalls = pantryChain.update.mock.calls;
    expect(updateCalls[0][0]).toEqual({ calorie_share_pct: 50 });
    // No target_kcal → silent skip, no warn
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('includes feeding_role/frequency/auto_deplete when provided', async () => {
    const { pantryChain } = wireShares([
      {
        id: 'a-1',
        feedings_per_day: 2,
        serving_size: 1,
        calorie_share_pct: 100,
        pantry_items: { products: { ga_kcal_per_cup: 400 } },
      },
    ]);

    await updateCalorieShares('pet-1', [
      {
        assignmentId: 'a-1',
        calorie_share_pct: 0,
        target_kcal: 0,
        feeding_role: 'rotational',
        feeding_frequency: 'as_needed',
        auto_deplete_enabled: false,
      },
    ]);

    expect(pantryChain.update.mock.calls[0][0]).toMatchObject({
      feeding_role: 'rotational',
      feeding_frequency: 'as_needed',
      auto_deplete_enabled: false,
    });
  });

  test('invokes refreshWetReserve after all writes (queries pets table)', async () => {
    const { petsChain } = wireShares([
      {
        id: 'a-1',
        feedings_per_day: 2,
        serving_size: 1,
        calorie_share_pct: 100,
        pantry_items: { products: { ga_kcal_per_cup: 400 } },
      },
    ]);

    await updateCalorieShares('pet-1', [
      { assignmentId: 'a-1', calorie_share_pct: 100, target_kcal: 800 },
    ]);

    // refreshWetReserve early-returns on non-dry_and_wet feeding styles, but the
    // pets.select('feeding_style') call is the observable side-effect we can assert on.
    expect(supabase.from).toHaveBeenCalledWith('pets');
    expect(petsChain.select).toHaveBeenCalledWith('feeding_style');
  });
});

// ─── evaluateDietCompleteness ───────────────────────────

describe('evaluateDietCompleteness', () => {
  function wireDiet(opts: {
    assignments?: unknown[];
    items?: unknown[];
    feedingStyle?: string;
  }) {
    const assignChain = mockChain({ data: opts.assignments ?? [], error: null });
    const petsChain = mockChain({ data: { feeding_style: opts.feedingStyle ?? 'dry_only' }, error: null });
    const itemsChain = mockChain({ data: opts.items ?? [], error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'pantry_pet_assignments') return assignChain;
      if (table === 'pets') return petsChain;
      if (table === 'pantry_items') return itemsChain;
      return mockChain({ data: null, error: null });
    });
  }

  test('dry_only pet with only rotational items and no base returns info status with topper-aware message', async () => {
    wireDiet({
      feedingStyle: 'dry_only',
      assignments: [{ pantry_item_id: 'pi-1', feeding_role: 'rotational' }],
      items: [
        {
          id: 'pi-1',
          products: { is_supplemental: true, category: 'daily_food' },
        },
      ],
    });

    const result = await evaluateDietCompleteness('pet-1', 'Rex');

    expect(result.status).toBe('info');
    expect(result.message).toContain('Toppers');
    expect(result.message).toContain('Rex');
    expect(result.message).toMatch(/extras|main food/i);
  });
});
