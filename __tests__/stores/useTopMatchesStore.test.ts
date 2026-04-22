// useTopMatchesStore — cross-pet race regression test.
//
// Bug class: loadTopMatches for pet A resolves AFTER the user has already
// switched to pet B. Before the fix, the final `set({ scores })` clobbered
// pet B's visible list with pet A's scores.

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
jest.mock('../../src/services/topMatches', () => ({
  checkCacheFreshness: jest.fn().mockResolvedValue(true),
  fetchTopMatches: jest.fn(),
  searchProducts: jest.fn(),
  invalidateStaleScores: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/batchScoreOnDevice', () => ({
  batchScoreHybrid: jest.fn().mockResolvedValue(undefined),
}));

import { useTopMatchesStore } from '../../src/stores/useTopMatchesStore';
import { useActivePetStore } from '../../src/stores/useActivePetStore';
import * as topMatchesService from '../../src/services/topMatches';

const mockedService = topMatchesService as jest.Mocked<typeof topMatchesService>;

beforeEach(() => {
  jest.clearAllMocks();
  useTopMatchesStore.setState({
    scores: [],
    loading: false,
    refreshing: false,
    error: null,
    categoryFilter: 'daily_food',
    searchQuery: '',
    searchResults: [],
    searchLoading: false,
  });
  useActivePetStore.setState({
    activePetId: 'A',
    pets: [
      { id: 'A', name: 'PetA', species: 'dog' } as any,
      { id: 'B', name: 'PetB', species: 'dog' } as any,
    ],
  });
});

describe('useTopMatchesStore cross-pet race', () => {
  test('loadTopMatches does not overwrite scores when user switches pets mid-fetch', async () => {
    // Pre-create the hanging promise so the resolver exists before fetchTopMatches
    // is actually called (loadTopMatches awaits checkCacheFreshness first, so the
    // inline `new Promise` executor pattern would fire too late).
    let resolveFetchA!: (scores: any[]) => void;
    const hangingFetch = new Promise<any[]>((resolve) => {
      resolveFetchA = resolve;
    });
    mockedService.fetchTopMatches.mockImplementationOnce(() => hangingFetch);

    // Seed pet B's scores already visible.
    const petBScores = [{ product_id: 'prod-b1', final_score: 82 } as any];
    useTopMatchesStore.setState({ scores: petBScores });

    // Dispatch load for pet A.
    const loadPromise = useTopMatchesStore.getState().loadTopMatches('A');

    // User switches active pet to B before the fetch resolves.
    useActivePetStore.setState({ activePetId: 'B' });

    // A's fetch finally resolves with its own scores.
    const petAScores = [{ product_id: 'prod-a1', final_score: 55 } as any];
    resolveFetchA(petAScores);
    await loadPromise;

    const state = useTopMatchesStore.getState();
    // Pet B's scores must remain — stale A fetch must not overwrite.
    expect(state.scores).toBe(petBScores);
    expect(state.loading).toBe(false);
  });

  test('loadTopMatches happy path (no switch) still writes scores for the requested pet', async () => {
    const petAScores = [{ product_id: 'prod-a1', final_score: 55 } as any];
    mockedService.fetchTopMatches.mockResolvedValueOnce(petAScores);

    await useTopMatchesStore.getState().loadTopMatches('A');

    const state = useTopMatchesStore.getState();
    expect(state.scores).toEqual(petAScores);
    expect(state.loading).toBe(false);
  });
});
