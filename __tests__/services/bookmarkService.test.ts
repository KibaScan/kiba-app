// Bookmark Service Tests — offline guard + cap enforcement + CRUD.
// Mirrors pantryService.test.ts pattern.

import {
  addBookmark,
  removeBookmark,
  toggleBookmark,
  getBookmarksForPet,
  isBookmarked,
  fetchBookmarkCards,
} from '../../src/services/bookmarkService';
import type { Pet } from '../../src/types/pet';
import {
  BookmarkOfflineError,
  BookmarksFullError,
  MAX_BOOKMARKS_PER_PET,
} from '../../src/types/bookmark';

jest.mock('../../src/services/batchScoreOnDevice', () => ({
  batchScoreHybrid: jest.fn().mockResolvedValue({ scored: 0, duration_ms: 0 }),
  SCORING_COLUMNS: [],
}));

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

function mockChain(result: { data: unknown; error: unknown; count?: number | null }) {
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

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
});

describe('offline guards', () => {
  beforeEach(() => {
    (isOnline as jest.Mock).mockResolvedValue(false);
  });

  test('addBookmark throws BookmarkOfflineError when offline', async () => {
    await expect(addBookmark('pet-1', 'prod-1')).rejects.toBeInstanceOf(BookmarkOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('removeBookmark throws BookmarkOfflineError when offline', async () => {
    await expect(removeBookmark('pet-1', 'prod-1')).rejects.toBeInstanceOf(BookmarkOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('getBookmarksForPet returns [] when offline', async () => {
    await expect(getBookmarksForPet('pet-1')).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('cap enforcement', () => {
  test('addBookmark throws BookmarksFullError when pet has 20 bookmarks', async () => {
    const countChain = mockChain({ data: null, error: null, count: MAX_BOOKMARKS_PER_PET });
    (supabase.from as jest.Mock).mockReturnValueOnce(countChain);

    await expect(addBookmark('pet-1', 'prod-1')).rejects.toBeInstanceOf(BookmarksFullError);
  });

  test('addBookmark succeeds when pet has 19 bookmarks', async () => {
    const countChain = mockChain({ data: null, error: null, count: 19 });
    const insertChain = mockChain({
      data: { id: 'bm-1', user_id: 'user-1', pet_id: 'pet-1', product_id: 'prod-1', created_at: 'now' },
      error: null,
    });
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(insertChain);

    const result = await addBookmark('pet-1', 'prod-1');
    expect(result.id).toBe('bm-1');
  });
});

describe('CRUD', () => {
  test('removeBookmark deletes row', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await removeBookmark('pet-1', 'prod-1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('pet_id', 'pet-1');
  });

  test('isBookmarked returns true when row exists', async () => {
    const chain = mockChain({ data: { id: 'bm-1' }, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await expect(isBookmarked('pet-1', 'prod-1')).resolves.toBe(true);
  });

  test('isBookmarked returns false when row missing', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await expect(isBookmarked('pet-1', 'prod-1')).resolves.toBe(false);
  });

  test('toggleBookmark removes when bookmarked', async () => {
    const existsChain = mockChain({ data: { id: 'bm-1' }, error: null });
    const deleteChain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(existsChain)
      .mockReturnValueOnce(deleteChain);

    const result = await toggleBookmark('pet-1', 'prod-1');
    expect(result).toBe(false);
    expect(deleteChain.delete).toHaveBeenCalled();
  });

  test('toggleBookmark adds when not bookmarked', async () => {
    const existsChain = mockChain({ data: null, error: null });
    const countChain = mockChain({ data: null, error: null, count: 0 });
    const insertChain = mockChain({
      data: { id: 'bm-1', user_id: 'user-1', pet_id: 'pet-1', product_id: 'prod-1', created_at: 'now' },
      error: null,
    });
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(existsChain)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(insertChain);

    const result = await toggleBookmark('pet-1', 'prod-1');
    expect(result).toBe(true);
  });
});

const makeTestPet = (id = 'pet-1'): Pet => ({
  id,
  user_id: 'user-1',
  name: 'Test',
  species: 'dog',
  breed: 'mixed',
  weight_current_lbs: 50,
  life_stage: 'adult',
  activity_level: 'moderate',
  is_neutered: true,
} as Pet);

describe('fetchBookmarkCards', () => {
  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchBookmarkCards(makeTestPet())).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns cards hydrated with scores; triggers batchScoreHybrid only when a score is null', async () => {
    // First call: bookmarks joined with product
    const bookmarksChain = mockChain({
      data: [
        {
          id: 'bm-1',
          user_id: 'user-1',
          pet_id: 'pet-1',
          product_id: 'prod-1',
          created_at: 'now',
          product: {
            id: 'prod-1',
            brand: 'Acme',
            name: 'Food',
            image_url: null,
            is_recalled: false,
            is_vet_diet: false,
            is_variety_pack: false,
            is_supplemental: false,
            target_species: 'dog',
          },
        },
      ],
      error: null,
    });
    // Second call: pet_product_scores (no row → null score → should trigger JIT)
    const scoresChain = mockChain({ data: [], error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(bookmarksChain)
      .mockReturnValueOnce(scoresChain);

    const cards = await fetchBookmarkCards(makeTestPet());
    expect(cards).toHaveLength(1);
    expect(cards[0].final_score).toBeNull();
    expect(cards[0].product.brand).toBe('Acme');
  });
});
