// useBookmarkStore — per-pet bookmark list + optimistic toggle with sync cap guard.
// Mirrors usePantryStore pattern (optimistic update + server resync on error).

import { create } from 'zustand';
import { type Bookmark, MAX_BOOKMARKS_PER_PET, BookmarksFullError } from '../types/bookmark';
import {
  getBookmarksForPet as svcLoad,
  toggleBookmark as svcToggle,
} from '../services/bookmarkService';

interface BookmarkState {
  bookmarks: Bookmark[];
  currentPetId: string | null;
  isLoading: boolean;
  loadForPet: (petId: string | null) => Promise<void>;
  toggle: (petId: string, productId: string) => Promise<boolean>;
  isBookmarked: (petId: string, productId: string) => boolean;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  currentPetId: null,
  isLoading: false,

  loadForPet: async (petId) => {
    if (!petId) {
      set({ bookmarks: [], currentPetId: null });
      return;
    }
    set({ isLoading: true, currentPetId: petId });
    try {
      const rows = await svcLoad(petId);
      set({ bookmarks: rows, isLoading: false });
    } catch {
      set({ bookmarks: [], isLoading: false });
    }
  },

  toggle: async (petId, productId) => {
    const existing = get().bookmarks.find(
      (b) => b.pet_id === petId && b.product_id === productId,
    );

    // Synchronous cap check — prevents UI flicker of a 21st row before server rejects.
    if (!existing && get().bookmarks.length >= MAX_BOOKMARKS_PER_PET) {
      throw new BookmarksFullError();
    }

    const optimisticBookmarks = existing
      ? get().bookmarks.filter((b) => b.id !== existing.id)
      : [
          ...get().bookmarks,
          {
            id: `__optimistic_${Date.now()}`,
            user_id: '',
            pet_id: petId,
            product_id: productId,
            created_at: new Date().toISOString(),
          } as Bookmark,
        ];
    set({ bookmarks: optimisticBookmarks });

    try {
      const newState = await svcToggle(petId, productId);
      await get().loadForPet(petId);
      return newState;
    } catch (err) {
      // Resync from server rather than manual re-insert — preserves DESC sort order.
      await get().loadForPet(petId);
      throw err;
    }
  },

  isBookmarked: (petId, productId) => {
    const state = get();
    if (state.currentPetId !== petId) return false;
    return state.bookmarks.some(
      (b) => b.pet_id === petId && b.product_id === productId,
    );
  },
}));
