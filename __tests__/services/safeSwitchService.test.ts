// Safe Switch Service Tests — CRUD, offline guards, composite data loading.
// Pattern: jest.mock Supabase + network, mockChain helper (matches appointmentService.test.ts).

import {
  createSafeSwitch,
  logTummyCheck,
  completeSafeSwitch,
  cancelSafeSwitch,
  pauseSafeSwitch,
  resumeSafeSwitch,
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
  status: 'active',
  total_days: 7,
  started_at: '2026-03-25T00:00:00Z',
  completed_at: null,
  cancelled_at: null,
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
  old_product_id: 'prod-old',
  new_product_id: 'prod-new',
  total_days: 7,
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

// ─── createSafeSwitch ───────────────────────────────────

describe('createSafeSwitch', () => {
  test('inserts and returns switch data on success', async () => {
    const chain = mockChain({ data: MOCK_SWITCH, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await createSafeSwitch(MOCK_INPUT);

    expect(supabase.from).toHaveBeenCalledWith('safe_switches');
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      pet_id: 'pet-1',
      old_product_id: 'prod-old',
      new_product_id: 'prod-new',
      total_days: 7,
      status: 'active',
    }));
    expect(result).toEqual(MOCK_SWITCH);
  });

  test('throws specific error on unique constraint violation (23505)', async () => {
    const chain = mockChain({ data: null, error: { code: '23505', message: 'duplicate' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(createSafeSwitch(MOCK_INPUT)).rejects.toThrow(
      'An active food transition already exists for this pet',
    );
  });

  test('throws generic error on other failures', async () => {
    const chain = mockChain({ data: null, error: { code: '42000', message: 'unknown error' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

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

describe('completeSafeSwitch', () => {
  test('updates status to completed with timestamp', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await completeSafeSwitch('sw-1');

    expect(supabase.from).toHaveBeenCalledWith('safe_switches');
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
    }));
    // Verify completed_at is included
    const updatePayload = (chain.update as jest.Mock).mock.calls[0][0];
    expect(updatePayload.completed_at).toBeDefined();
  });

  test('throws on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

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

  test('returns assembled SafeSwitchCardData on success', async () => {
    const switchRow = {
      ...MOCK_SWITCH,
      old_product: MOCK_PRODUCT_OLD,
      new_product: MOCK_PRODUCT_NEW,
    };

    // Table-dispatch mock: different results per table
    const switchChain = mockChain({ data: switchRow, error: null });
    const logsChain = mockChain({ data: [MOCK_LOG], error: null });
    const scoresChain = mockChain({ data: [
      { product_id: 'prod-old', final_score: 45 },
      { product_id: 'prod-new', final_score: 72 },
    ], error: null });
    const pantryChain = mockChain({ data: [{ id: 'pi-1' }], error: null });
    const asgnChain = mockChain({ data: { serving_size: 1.2, serving_size_unit: 'cups', feedings_per_day: 2 }, error: null });

    let fromCallCount = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      fromCallCount++;
      if (table === 'safe_switches') return switchChain;
      if (table === 'safe_switch_logs') return logsChain;
      if (table === 'pet_product_scores') return scoresChain;
      if (table === 'pantry_items') return pantryChain;
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
    expect(getCurrentDay).toHaveBeenCalledWith(MOCK_SWITCH.started_at, 7);
    expect(getMixForDay).toHaveBeenCalledWith(3, 7);
    expect(getTransitionSchedule).toHaveBeenCalledWith(7);
  });

  test('returns null gracefully on Supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'connection failed' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getActiveSwitchForPet('pet-1');

    expect(result).toBeNull();
  });

  test('falls back to 2.4 dailyCups when no pantry data', async () => {
    const switchRow = {
      ...MOCK_SWITCH,
      old_product: MOCK_PRODUCT_OLD,
      new_product: MOCK_PRODUCT_NEW,
    };

    const switchChain = mockChain({ data: switchRow, error: null });
    const logsChain = mockChain({ data: [], error: null });
    const scoresChain = mockChain({ data: [], error: null });
    const pantryChain = mockChain({ data: [], error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'safe_switches') return switchChain;
      if (table === 'safe_switch_logs') return logsChain;
      if (table === 'pet_product_scores') return scoresChain;
      if (table === 'pantry_items') return pantryChain;
      return mockChain({ data: null, error: null });
    });

    const result = await getActiveSwitchForPet('pet-1');

    expect(result).not.toBeNull();
    expect(result!.dailyCups).toBe(2.4);
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
