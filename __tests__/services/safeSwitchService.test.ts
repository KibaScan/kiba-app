// Safe Switch Service Tests — CRUD, offline guards, composite data loading.
// Pattern: jest.mock Supabase + network, mockChain helper (matches appointmentService.test.ts).

import {
  createSafeSwitch,
  logTummyCheck,
  completeSafeSwitch,
  cancelSafeSwitch,
  pauseSafeSwitch,
  resumeSafeSwitch,
  restartSafeSwitch,
  getActiveSwitchForPet,
  hasActiveSwitchForPet,
} from '../../src/services/safeSwitchService';

// ─── Mocks ──────────────────────────────────────────────

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
    },
  },
}));

jest.mock('../../src/utils/safeSwitchHelpers', () => ({
  getCurrentDay: jest.fn().mockReturnValue(3),
  getMixForDay: jest.fn().mockReturnValue({ oldPct: 50, newPct: 50 }),
  getTransitionSchedule: jest.fn().mockReturnValue([
    { day: 1, oldPct: 75, newPct: 25, phase: '75% old / 25% new' },
  ]),
  computeSwitchOutcome: jest.fn().mockReturnValue({
    totalDays: 7,
    loggedDays: 7,
    missedDays: 0,
    perfectCount: 7,
    softStoolCount: 0,
    upsetCount: 0,
    maxConsecutiveUpset: 0,
  }),
  getOutcomeMessage: jest.fn().mockReturnValue({
    title: 'Switch Complete',
    body: 'Luna has fully transitioned to NewBrand New Kibble.',
    tone: 'good',
  }),
}));

import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';
import { getCurrentDay, getMixForDay, getTransitionSchedule } from '../../src/utils/safeSwitchHelpers';

// ─── Helpers ────────────────────────────────────────────

function mockChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'limit', 'maybeSingle']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  // Make chain thenable for queries without terminal call
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

/** Creates a mock that dispatches different results per table name. */
function mockFromDispatch(dispatch: Record<string, ReturnType<typeof mockChain>>) {
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    return dispatch[table] ?? mockChain({ data: null, error: null });
  });
}

const MOCK_SWITCH = {
  id: 'sw-1',
  user_id: 'user-1',
  pet_id: 'pet-1',
  old_product_id: 'prod-old',
  new_product_id: 'prod-new',
  pantry_item_id: 'pi-1',
  status: 'active',
  total_days: 7,
  started_at: '2026-03-25T00:00:00Z',
  completed_at: null,
  cancelled_at: null,
  outcome_summary: null,
  created_at: '2026-03-25T00:00:00Z',
  updated_at: '2026-03-25T00:00:00Z',
};

const MOCK_PRODUCT_OLD = {
  id: 'prod-old',
  name: 'Old Kibble',
  brand: 'OldBrand',
  image_url: null,
  category: 'daily_food',
  is_supplemental: false,
  ga_kcal_per_cup: 350,
  ga_kcal_per_kg: 3500,
};

const MOCK_PRODUCT_NEW = {
  id: 'prod-new',
  name: 'New Kibble',
  brand: 'NewBrand',
  image_url: null,
  category: 'daily_food',
  is_supplemental: false,
  ga_kcal_per_cup: 380,
  ga_kcal_per_kg: 3800,
};

const MOCK_LOG = {
  id: 'log-1',
  switch_id: 'sw-1',
  day_number: 1,
  tummy_check: 'perfect',
  logged_at: '2026-03-25T19:00:00Z',
};

const MOCK_INPUT = {
  pet_id: 'pet-1',
  pantry_item_id: 'pi-1',
  new_product_id: 'prod-new',
  total_days: 7,
  new_serving_size: null,
  new_serving_size_unit: null,
  new_feedings_per_day: null,
};

/** A successful pantry_items join row used by createSafeSwitch validation. */
const MOCK_PANTRY_JOIN = {
  id: 'pi-1',
  product_id: 'prod-old',
  is_active: true,
  products: {
    id: 'prod-old',
    category: 'daily_food',
    is_supplemental: false,
    is_vet_diet: false,
    target_species: 'dog',
  },
  pantry_pet_assignments: [{ pet_id: 'pet-1' }],
};

/** A successful new product lookup row used by createSafeSwitch validation. */
const MOCK_NEW_PRODUCT_LOOKUP = {
  id: 'prod-new',
  category: 'daily_food',
  is_supplemental: false,
};

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

  test('createSafeSwitch throws when offline', async () => {
    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('logTummyCheck throws when offline', async () => {
    await expect(logTummyCheck('sw-1', 1, 'perfect')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('completeSafeSwitch throws when offline', async () => {
    await expect(completeSafeSwitch('sw-1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('cancelSafeSwitch throws when offline', async () => {
    await expect(cancelSafeSwitch('sw-1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('pauseSafeSwitch throws when offline', async () => {
    await expect(pauseSafeSwitch('sw-1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('resumeSafeSwitch throws when offline', async () => {
    await expect(resumeSafeSwitch('sw-1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ─── createSafeSwitch (M9 Phase B) ──────────────────────

describe('createSafeSwitch', () => {
  /**
   * Helper that wires the three supabase.from calls createSafeSwitch makes:
   *   1. pantry_items (join validation)
   *   2. products (new product validation)
   *   3. safe_switches (insert)
   */
  function wirePantryAndInsert(opts: {
    pantryData: unknown;
    pantryError?: unknown;
    /** Pass `null` explicitly to simulate "new product not found". Undefined → default. */
    newProductData?: unknown;
    newProductError?: unknown;
    insertData?: unknown;
    insertError?: unknown;
  }) {
    const pantryChain = mockChain({ data: opts.pantryData, error: opts.pantryError ?? null });
    const newProductChain = mockChain({
      // Use `'newProductData' in opts` so explicit null survives (not coalesced to default)
      data: 'newProductData' in opts ? opts.newProductData : MOCK_NEW_PRODUCT_LOOKUP,
      error: opts.newProductError ?? null,
    });
    const insertChain = mockChain({
      data: opts.insertData ?? MOCK_SWITCH,
      error: opts.insertError ?? null,
    });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'pantry_items') return pantryChain;
      if (table === 'products') return newProductChain;
      if (table === 'safe_switches') return insertChain;
      return mockChain({ data: null, error: null });
    });
    return { pantryChain, newProductChain, insertChain };
  }

  test('validates pantry anchor, derives old_product_id, and inserts successfully', async () => {
    const { insertChain } = wirePantryAndInsert({ pantryData: MOCK_PANTRY_JOIN });

    const result = await createSafeSwitch(MOCK_INPUT);

    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      pet_id: 'pet-1',
      pantry_item_id: 'pi-1',
      old_product_id: 'prod-old',
      new_product_id: 'prod-new',
      total_days: 7,
      new_serving_size: null,
      new_serving_size_unit: null,
      new_feedings_per_day: null,
      status: 'active',
    }));
    expect(result).toEqual(MOCK_SWITCH);
  });

  test('rejects when pantry item is not found (orphan switch attempt)', async () => {
    wirePantryAndInsert({ pantryData: null });

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow(
      'This pantry item is no longer available',
    );
  });

  test('rejects when joined product is not daily_food', async () => {
    wirePantryAndInsert({
      pantryData: {
        ...MOCK_PANTRY_JOIN,
        products: { ...MOCK_PANTRY_JOIN.products, category: 'treat' },
      },
    });

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow(
      'Safe Switch is only available for daily food',
    );
  });

  test('rejects when joined product is supplemental', async () => {
    wirePantryAndInsert({
      pantryData: {
        ...MOCK_PANTRY_JOIN,
        products: { ...MOCK_PANTRY_JOIN.products, is_supplemental: true },
      },
    });

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow(
      'Safe Switch is not available for supplemental',
    );
  });

  test('rejects when joined product is vet diet', async () => {
    wirePantryAndInsert({
      pantryData: {
        ...MOCK_PANTRY_JOIN,
        products: { ...MOCK_PANTRY_JOIN.products, is_vet_diet: true },
      },
    });

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow(
      'Safe Switch is not available for supplemental or vet diet',
    );
  });

  test('rejects when new product does not exist', async () => {
    wirePantryAndInsert({
      pantryData: MOCK_PANTRY_JOIN,
      newProductData: null,
    });

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow('New product not found');
  });

  test('rejects when new product is not daily_food', async () => {
    wirePantryAndInsert({
      pantryData: MOCK_PANTRY_JOIN,
      newProductData: { ...MOCK_NEW_PRODUCT_LOOKUP, category: 'treat' },
    });

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow('The new product must be a daily food');
  });

  test('throws specific error on unique constraint violation (23505)', async () => {
    wirePantryAndInsert({
      pantryData: MOCK_PANTRY_JOIN,
      insertData: null,
      insertError: { code: '23505', message: 'duplicate' },
    });

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow(
      'An active food transition already exists for this pet',
    );
  });

  test('throws generic error on other insert failures', async () => {
    wirePantryAndInsert({
      pantryData: MOCK_PANTRY_JOIN,
      insertData: null,
      insertError: { code: '42000', message: 'unknown error' },
    });

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow('Failed to create safe switch');
  });
});

// ─── logTummyCheck ──────────────────────────────────────

describe('logTummyCheck', () => {
  test('upserts log and returns data on success', async () => {
    const chain = mockChain({ data: MOCK_LOG, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await logTummyCheck('sw-1', 1, 'perfect');

    expect(supabase.from).toHaveBeenCalledWith('safe_switch_logs');
    expect(chain.upsert).toHaveBeenCalledWith(
      { switch_id: 'sw-1', day_number: 1, tummy_check: 'perfect' },
      { onConflict: 'switch_id,day_number' },
    );
    expect(result).toEqual(MOCK_LOG);
  });

  test('throws on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'upsert failed' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(logTummyCheck('sw-1', 1, 'upset')).rejects.toThrow('Failed to log tummy check');
  });
});

// ─── Status Updates ─────────────────────────────────────

describe('completeSafeSwitch (M9 Phase B — atomic RPC)', () => {
  /**
   * Helper: wires the two parallel fetches (safe_switches + safe_switch_logs)
   * and the rpc call. The service computes outcome + message via mocked helpers.
   */
  function wireCompletion(opts: {
    switchData?: unknown;
    switchError?: unknown;
    logsData?: unknown;
    rpcError?: unknown;
  }) {
    const switchRow = opts.switchData ?? {
      id: 'sw-1',
      pet_id: 'pet-1',
      new_product_id: 'prod-new',
      total_days: 7,
      pet: { name: 'Luna' },
      new_product: { brand: 'NewBrand', name: 'New Kibble' },
    };
    const switchChain = mockChain({ data: switchRow, error: opts.switchError ?? null });
    const logsChain = mockChain({ data: opts.logsData ?? [], error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'safe_switches') return switchChain;
      if (table === 'safe_switch_logs') return logsChain;
      return mockChain({ data: null, error: null });
    });

    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: opts.rpcError ?? null,
    });

    return { switchChain, logsChain };
  }

  test('calls complete_safe_switch_with_pantry_swap RPC with outcome_summary', async () => {
    wireCompletion({});

    const result = await completeSafeSwitch('sw-1');

    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_safe_switch_with_pantry_swap',
      expect.objectContaining({
        p_switch_id: 'sw-1',
        p_outcome_summary: expect.objectContaining({
          outcome: expect.objectContaining({ totalDays: 7 }),
          message: expect.objectContaining({ title: 'Switch Complete', tone: 'good' }),
        }),
      }),
    );
    expect(result).toEqual({
      outcome: expect.objectContaining({ totalDays: 7, perfectCount: 7 }),
      message: expect.objectContaining({ title: 'Switch Complete' }),
    });
  });

  test('throws when the switch row cannot be loaded', async () => {
    wireCompletion({ switchData: null, switchError: { message: 'not found' } });

    await expect(completeSafeSwitch('sw-1')).rejects.toThrow('Failed to load safe switch');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('throws when the RPC call fails', async () => {
    wireCompletion({ rpcError: { message: 'rpc failed' } });

    await expect(completeSafeSwitch('sw-1')).rejects.toThrow('Failed to complete safe switch');
  });
});

describe('cancelSafeSwitch', () => {
  test('updates status to cancelled with timestamp', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await cancelSafeSwitch('sw-1');

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'cancelled',
    }));
    const updatePayload = (chain.update as jest.Mock).mock.calls[0][0];
    expect(updatePayload.cancelled_at).toBeDefined();
  });
});

describe('pauseSafeSwitch', () => {
  test('updates status to paused', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await pauseSafeSwitch('sw-1');

    expect(chain.update).toHaveBeenCalledWith({ status: 'paused' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'sw-1');
  });
});

describe('resumeSafeSwitch', () => {
  test('updates status to active', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await resumeSafeSwitch('sw-1');

    expect(chain.update).toHaveBeenCalledWith({ status: 'active' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'sw-1');
  });
});

// ─── getActiveSwitchForPet ──────────────────────────────

describe('getActiveSwitchForPet', () => {
  test('returns null when no active switch exists', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getActiveSwitchForPet('pet-1');

    expect(result).toBeNull();
  });

  test('returns assembled SafeSwitchCardData using direct pantry_item_id join (Phase B)', async () => {
    const switchRow = {
      ...MOCK_SWITCH,
      old_product: MOCK_PRODUCT_OLD,
      new_product: MOCK_PRODUCT_NEW,
    };

    const switchChain = mockChain({ data: switchRow, error: null });
    const logsChain = mockChain({ data: [MOCK_LOG], error: null });
    const scoresChain = mockChain({ data: [
      { product_id: 'prod-old', final_score: 45 },
      { product_id: 'prod-new', final_score: 72 },
    ], error: null });
    // Phase B: direct join on pantry_pet_assignments via pantry_item_id (no intermediate pantry_items fetch)
    const asgnChain = mockChain({
      data: { serving_size: 1.2, serving_size_unit: 'cups', feedings_per_day: 2 },
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'safe_switches') return switchChain;
      if (table === 'safe_switch_logs') return logsChain;
      if (table === 'pet_product_scores') return scoresChain;
      if (table === 'pantry_pet_assignments') return asgnChain;
      return mockChain({ data: null, error: null });
    });

    const result = await getActiveSwitchForPet('pet-1');

    expect(result).not.toBeNull();
    expect(result!.switch.id).toBe('sw-1');
    expect(result!.oldProduct).toEqual(MOCK_PRODUCT_OLD);
    expect(result!.newProduct).toEqual(MOCK_PRODUCT_NEW);
    expect(result!.oldScore).toBe(45);
    expect(result!.newScore).toBe(72);
    expect(result!.logs).toEqual([MOCK_LOG]);
    expect(result!.currentDay).toBe(3);
    expect(result!.todayMix).toEqual({ oldPct: 50, newPct: 50 });
    expect(result!.dailyCups).toBe(2.4); // 1.2 cups × 2 feedings
    // Verify the fragile product_id string-match path is NOT used — Phase B drops it
    expect(asgnChain.eq).toHaveBeenCalledWith('pantry_item_id', 'pi-1');
    expect(getCurrentDay).toHaveBeenCalledWith(MOCK_SWITCH.started_at, 7);
  });

  test('returns null gracefully on Supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'connection failed' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getActiveSwitchForPet('pet-1');

    expect(result).toBeNull();
  });

  test('falls back to 2.4 dailyCups for historical rows with null pantry_item_id', async () => {
    // Phase B: historical switches created before migration 031 have no anchor.
    const historicalSwitch = {
      ...MOCK_SWITCH,
      pantry_item_id: null,
      old_product: MOCK_PRODUCT_OLD,
      new_product: MOCK_PRODUCT_NEW,
    };

    const switchChain = mockChain({ data: historicalSwitch, error: null });
    const logsChain = mockChain({ data: [], error: null });
    const scoresChain = mockChain({ data: [], error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'safe_switches') return switchChain;
      if (table === 'safe_switch_logs') return logsChain;
      if (table === 'pet_product_scores') return scoresChain;
      return mockChain({ data: null, error: null });
    });

    const result = await getActiveSwitchForPet('pet-1');

    expect(result).not.toBeNull();
    expect(result!.dailyCups).toBe(2.4);
  });
});

// ─── restartSafeSwitch (M9 Phase B — anchor propagation) ──

describe('restartSafeSwitch', () => {
  test('propagates pantry_item_id from the old switch to the new row', async () => {
    const oldSwitchRow = {
      pet_id: 'pet-1',
      old_product_id: 'prod-old',
      new_product_id: 'prod-new',
      total_days: 7,
      pantry_item_id: 'pi-1',
    };
    const fetchChain = mockChain({ data: oldSwitchRow, error: null });
    const cancelChain = mockChain({ data: null, error: null });
    const insertChain = mockChain({ data: { ...MOCK_SWITCH, id: 'sw-2' }, error: null });

    let fromCall = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      fromCall++;
      if (table === 'safe_switches') {
        // First call: SELECT for fetch. Second: UPDATE for cancel. Third: INSERT for new row.
        if (fromCall === 1) return fetchChain;
        if (fromCall === 2) return cancelChain;
        return insertChain;
      }
      return mockChain({ data: null, error: null });
    });

    const result = await restartSafeSwitch('sw-1');

    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      pet_id: 'pet-1',
      pantry_item_id: 'pi-1', // <-- the key Phase B assertion
      old_product_id: 'prod-old',
      new_product_id: 'prod-new',
      total_days: 7,
      status: 'active',
    }));
    expect(result.id).toBe('sw-2');
  });
});

// ─── hasActiveSwitchForPet ──────────────────────────────

describe('hasActiveSwitchForPet', () => {
  test('returns true when active switch exists', async () => {
    const chain = mockChain({ data: null, error: null, count: 1 });
    // Override count on the resolved value
    chain.in = jest.fn().mockResolvedValue({ count: 1, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await hasActiveSwitchForPet('pet-1');

    expect(result).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('safe_switches');
  });

  test('returns false when no active switch', async () => {
    const chain = mockChain({ data: null, error: null, count: 0 });
    chain.in = jest.fn().mockResolvedValue({ count: 0, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await hasActiveSwitchForPet('pet-1');

    expect(result).toBe(false);
  });

  test('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' }, count: null });
    chain.in = jest.fn().mockResolvedValue({ count: null, error: { message: 'fail' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await hasActiveSwitchForPet('pet-1');

    expect(result).toBe(false);
  });
});
