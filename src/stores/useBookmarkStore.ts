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
  /** True while an initial fetch (`loadForPet`) is in flight. Toggle ops use optimistic UI and do NOT set this flag. */
  isLoading: boolean;
  /** Set of "${petId}:${productId}" keys currently being toggled — prevents mash-tap race causing duplicate INSERTs. */
  inFlight: Set<string>;
  loadForPet: (petId: string | null) => Promise<void>;
  toggle: (petId: string, productId: string) => Promise<boolean>;
  isBookmarked: (petId: string, productId: string) => boolean;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  currentPetId: null,
  isLoading: false,
  inFlight: new Set(),

  loadForPet: async (petId) => {
    if (!petId) {
      set({ bookmarks: [], currentPetId: null });
      return;
    }
    set({ isLoading: true, currentPetId: petId });
    try {
      const rows = await svcLoad(petId);
      set({ bookmarks: rows, isLoading: false });
    } catch (err) {
      console.warn('[useBookmarkStore] loadForPet error:', err);
      set({ bookmarks: [], isLoading: false });
    }
  },

  toggle: async (petId, productId) => {
    const key = `${petId}:${productId}`;
    if (get().inFlight.has(key)) {
      // Mash-tap: return current state without firing another service call.
      return get().isBookmarked(petId, productId);
    }

    set({ inFlight: new Set(get().inFlight).add(key) });

    try {
      // Sync guard: if caller's petId doesn't match loaded pet, resync first.
      // Prevents stale state from cross-pet race conditions.
      if (get().currentPetId !== petId) {
        await get().loadForPet(petId);
      }

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
        // Skip resync if user has switched pets mid-toggle — a stale reload would
        // clobber the now-active pet's state (currentPetId + bookmarks).
        if (get().currentPetId === petId) {
          await get().loadForPet(petId);
        }
        return newState;
      } catch (err) {
        // Resync from server rather than manual re-insert — preserves DESC sort order.
        // Same cross-pet guard: only reload if the toggled pet is still active.
        if (get().currentPetId === petId) {
          await get().loadForPet(petId);
        }
        throw err;
      }
    } finally {
      // Always clear the in-flight key, even on throw.
      const next = new Set(get().inFlight);
      next.delete(key);
      set({ inFlight: next });
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
