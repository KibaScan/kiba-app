// usePantryStore — cross-pet race regression tests.
//
// Bug class: mutation for pet A (optimistic write + server call) resolves AFTER
// user has switched to pet B. Before the fix, the mutation wrote fresh data
// into top-level `items`/`dietStatus` keyed to whatever `_petId` was when the
// server call returned — clobbering pet B's visible state and leaving pet A's
// `_petCache` entry stale.
//
// After the fix, the mutation always writes into `_petCache[petId]` for the
// pet it was dispatched for, and only writes top-level state when `_petId`
// still equals that pet.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/services/pantryService', () => ({
  getPantryForPet: jest.fn(),
  addToPantry: jest.fn(),
  removePantryItem: jest.fn(),
  restockPantryItem: jest.fn(),
  updatePantryItem: jest.fn(),
  sharePantryItem: jest.fn(),
  evaluateDietCompleteness: jest.fn().mockResolvedValue({ status: 'empty', message: null }),
}));
jest.mock('../../src/services/safeSwitchService', () => ({
  getActiveSwitchForPet: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../src/services/feedingNotificationScheduler', () => ({
  rescheduleAllFeeding: jest.fn().mockResolvedValue(undefined),
}));

import { usePantryStore } from '../../src/stores/usePantryStore';
import { useActivePetStore } from '../../src/stores/useActivePetStore';
import * as pantryService from '../../src/services/pantryService';
import type { PantryCardData } from '../../src/types/pantry';

const mockedService = pantryService as jest.Mocked<typeof pantryService>;

// Minimal stub — tests only assert identity/equality on the items array, never
// shape. Casting to PantryCardData keeps the store's types honest.
function mockItem(id: string): PantryCardData {
  return { id, product_id: 'prod-' + id } as unknown as PantryCardData;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset store. Load pet A first so `_petId === 'A'` baseline.
  usePantryStore.setState({
    items: [],
    dietStatus: null,
    activeSwitchData: null,
    loading: false,
    error: null,
    _petId: 'A',
    _petCache: {},
  });
  useActivePetStore.setState({
    activePetId: 'A',
    pets: [
      { id: 'A', name: 'PetA', species: 'dog' } as any,
      { id: 'B', name: 'PetB', species: 'dog' } as any,
    ],
  });
});

describe('usePantryStore cross-pet race', () => {
  test('addItem caches to _petCache[petId] even when user switches mid-await', async () => {
    // Hanging addToPantry so we can interleave a pet switch. addToPantry resolves
    // to a PantryItem in prod; for this test the resolved value is unused downstream.
    let resolveAdd!: () => void;
    const hangingAdd = new Promise<any>((resolve) => { resolveAdd = () => resolve({}); });
    mockedService.addToPantry.mockImplementationOnce(() => hangingAdd);
    // After add completes, refetch returns pet A's data.
    const petAItems = [mockItem('a1')];
    mockedService.getPantryForPet.mockImplementation((petId: string) =>
      Promise.resolve(petId === 'A' ? petAItems : []),
    );

    // Dispatch add for pet A (the sharer captured state).
    const addPromise = usePantryStore.getState().addItem(
      { productId: 'prod-a1', petId: 'A' } as any,
      'A',
    );

    // User switches to pet B while server call hangs.
    usePantryStore.setState({ _petId: 'B', items: [], dietStatus: null });

    // Server call resolves — the refetch then fires.
    resolveAdd();
    await addPromise;

    const state = usePantryStore.getState();

    // Top-level must NOT be overwritten by the stale mutation's refetch.
    expect(state._petId).toBe('B');
    expect(state.items).toEqual([]);

    // But pet A's cache MUST be populated with the refetched data so that
    // switching back to A shows the newly-added item without a round trip.
    expect(state._petCache['A']).toBeDefined();
    expect(state._petCache['A']?.items).toEqual(petAItems);
  });

  test('addItem happy path (no switch) still writes top-level + cache for active pet', async () => {
    mockedService.addToPantry.mockResolvedValueOnce({} as any);
    const petAItems = [mockItem('a1')];
    mockedService.getPantryForPet.mockResolvedValue(petAItems);

    await usePantryStore.getState().addItem(
      { productId: 'prod-a1', petId: 'A' } as any,
      'A',
    );

    const state = usePantryStore.getState();
    expect(state.items).toEqual(petAItems);
    expect(state._petCache['A']?.items).toEqual(petAItems);
    expect(state.loading).toBe(false);
  });
});
