// useBookmarkStore Tests — optimistic toggle + rollback on error + pet-switch refetch.

jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/services/bookmarkService', () => ({
  getBookmarksForPet: jest.fn(),
  toggleBookmark: jest.fn(),
  addBookmark: jest.fn(),
  removeBookmark: jest.fn(),
}));

import { useBookmarkStore } from '../../src/stores/useBookmarkStore';
import * as bookmarkService from '../../src/services/bookmarkService';
import { BookmarksFullError } from '../../src/types/bookmark';

beforeEach(() => {
  jest.clearAllMocks();
  useBookmarkStore.setState({ bookmarks: [], isLoading: false, currentPetId: null });
});

describe('loadForPet', () => {
  test('fetches and sets bookmarks for a pet', async () => {
    (bookmarkService.getBookmarksForPet as jest.Mock).mockResolvedValue([
      { id: 'b1', user_id: 'u1', pet_id: 'p1', product_id: 'prod-1', created_at: 'now' },
    ]);

    await useBookmarkStore.getState().loadForPet('p1');

    expect(useBookmarkStore.getState().bookmarks.length).toBe(1);
    expect(useBookmarkStore.getState().currentPetId).toBe('p1');
  });

  test('clears bookmarks when petId is null', async () => {
    useBookmarkStore.setState({ bookmarks: [{ id: 'b1' } as any] });
    await useBookmarkStore.getState().loadForPet(null);
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
  });
});

describe('toggle', () => {
  test('adds bookmark optimistically and confirms on service success', async () => {
    (bookmarkService.toggleBookmark as jest.Mock).mockResolvedValue(true);
    (bookmarkService.getBookmarksForPet as jest.Mock).mockResolvedValue([
      { id: 'b1', user_id: 'u1', pet_id: 'p1', product_id: 'prod-1', created_at: 'now' },
    ]);
    useBookmarkStore.setState({ currentPetId: 'p1', bookmarks: [] });

    const result = await useBookmarkStore.getState().toggle('p1', 'prod-1');

    expect(result).toBe(true);
    expect(bookmarkService.toggleBookmark).toHaveBeenCalledWith('p1', 'prod-1');
  });

  test('rolls back optimistic add on BookmarksFullError (service call never happens — sync guard)', async () => {
    // Seed store at MAX_BOOKMARKS_PER_PET (20)
    const full = Array.from({ length: 20 }, (_, i) => ({
      id: `b${i}`,
      user_id: 'u1',
      pet_id: 'p1',
      product_id: `prod-${i}`,
      created_at: 'now',
    }));
    useBookmarkStore.setState({ currentPetId: 'p1', bookmarks: full });

    await expect(
      useBookmarkStore.getState().toggle('p1', 'prod-new'),
    ).rejects.toBeInstanceOf(BookmarksFullError);

    // Store not mutated — sync cap check fires before optimistic update
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(20);
    expect(bookmarkService.toggleBookmark).not.toHaveBeenCalled();
  });

  test('rolls back optimistic on service error by re-syncing from server', async () => {
    (bookmarkService.toggleBookmark as jest.Mock).mockRejectedValue(new Error('net fail'));
    // loadForPet called in catch to resync — return the original empty list
    (bookmarkService.getBookmarksForPet as jest.Mock).mockResolvedValue([]);
    useBookmarkStore.setState({ currentPetId: 'p1', bookmarks: [] });

    await expect(
      useBookmarkStore.getState().toggle('p1', 'prod-1'),
    ).rejects.toThrow('net fail');

    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
  });
});

describe('isBookmarked', () => {
  test('returns true when product is in store for current pet', () => {
    useBookmarkStore.setState({
      currentPetId: 'p1',
      bookmarks: [
        { id: 'b1', user_id: 'u1', pet_id: 'p1', product_id: 'prod-1', created_at: 'now' },
      ],
    });
    expect(useBookmarkStore.getState().isBookmarked('p1', 'prod-1')).toBe(true);
  });

  test('returns false when petId mismatch', () => {
    useBookmarkStore.setState({
      currentPetId: 'p1',
      bookmarks: [
        { id: 'b1', user_id: 'u1', pet_id: 'p1', product_id: 'prod-1', created_at: 'now' },
      ],
    });
    expect(useBookmarkStore.getState().isBookmarked('p2', 'prod-1')).toBe(false);
  });
});
