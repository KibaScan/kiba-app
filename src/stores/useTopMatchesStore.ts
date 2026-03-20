// M5 Top Matches Store — Zustand state for active pet's scored product rankings.
// No persistence — data fetched from Supabase on each screen focus.

import { create } from 'zustand';
import type { CachedScore } from '../services/topMatches';
import {
  checkCacheFreshness,
  fetchTopMatches,
  triggerBatchScore,
} from '../services/topMatches';
import { useActivePetStore } from './useActivePetStore';

type CategoryFilter = 'daily_food' | 'treat' | 'all';

interface TopMatchesState {
  scores: CachedScore[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  categoryFilter: CategoryFilter;
  searchQuery: string;

  loadTopMatches: (petId: string) => Promise<void>;
  refreshScores: (petId: string) => Promise<void>;
  setFilter: (category: CategoryFilter) => void;
  setSearch: (query: string) => void;
}

function getPet(petId: string) {
  return useActivePetStore.getState().pets.find(p => p.id === petId) ?? null;
}

export const useTopMatchesStore = create<TopMatchesState>()((set, get) => ({
  scores: [],
  loading: false,
  refreshing: false,
  error: null,
  categoryFilter: 'daily_food',
  searchQuery: '',

  loadTopMatches: async (petId) => {
    set({ loading: true, error: null });
    try {
      const pet = getPet(petId);
      if (!pet) throw new Error('Pet not found');

      const fresh = await checkCacheFreshness(pet);
      if (!fresh) {
        set({ refreshing: true });
        await triggerBatchScore(petId, pet);
        set({ refreshing: false });
      }

      const category = get().categoryFilter;
      const scores = await fetchTopMatches(petId, {
        category: category === 'all' ? undefined : category,
      });
      set({ scores, loading: false });
    } catch (e) {
      console.error('[useTopMatchesStore] loadTopMatches failed:', e);
      set({
        error: e instanceof Error ? e.message : 'Failed to load top matches.',
        loading: false,
        refreshing: false,
      });
    }
  },

  refreshScores: async (petId) => {
    set({ refreshing: true, error: null });
    try {
      const pet = getPet(petId);
      if (!pet) throw new Error('Pet not found');

      await triggerBatchScore(petId, pet);

      const category = get().categoryFilter;
      const scores = await fetchTopMatches(petId, {
        category: category === 'all' ? undefined : category,
      });
      set({ scores, refreshing: false });
    } catch (e) {
      console.error('[useTopMatchesStore] refreshScores failed:', e);
      set({
        error: e instanceof Error ? e.message : 'Failed to refresh scores.',
        refreshing: false,
      });
    }
  },

  setFilter: (category) => {
    const petId = useActivePetStore.getState().activePetId;
    set({ categoryFilter: category, searchQuery: '' });
    if (petId) {
      // Re-fetch from cache with new filter
      fetchTopMatches(petId, {
        category: category === 'all' ? undefined : category,
      })
        .then(scores => set({ scores }))
        .catch(e => console.error('[useTopMatchesStore] setFilter fetch failed:', e));
    }
  },

  setSearch: (query) => {
    set({ searchQuery: query });
  },
}));
