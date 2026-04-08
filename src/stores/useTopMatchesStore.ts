// M5 Top Matches Store — Zustand state for active pet's scored product rankings.
// No persistence — data fetched from Supabase on each screen focus.

import { create } from 'zustand';
import type { CachedScore, ProductSearchResult } from '../services/topMatches';
import {
  checkCacheFreshness,
  fetchTopMatches,
  searchProducts,
  invalidateStaleScores,
} from '../services/topMatches';
import { batchScoreHybrid } from '../services/batchScoreOnDevice';
import { useActivePetStore } from './useActivePetStore';

type CategoryFilter = 'daily_food' | 'treat' | 'all';

interface TopMatchesState {
  scores: CachedScore[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  categoryFilter: CategoryFilter;
  searchQuery: string;
  searchResults: ProductSearchResult[];
  searchLoading: boolean;

  loadTopMatches: (petId: string) => Promise<void>;
  refreshScores: (petId: string) => Promise<void>;
  setFilter: (category: CategoryFilter) => void;
  setSearch: (query: string) => void;
  executeSearch: (query: string, species: 'dog' | 'cat') => Promise<void>;
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
  searchResults: [],
  searchLoading: false,

  loadTopMatches: async (petId) => {
    set({ loading: true, error: null });
    try {
      const pet = getPet(petId);
      if (!pet) throw new Error('Pet not found');

      try {
        const fresh = await checkCacheFreshness(pet);
        if (!fresh) {
          set({ refreshing: true });
          await invalidateStaleScores(petId);
          await batchScoreHybrid(petId, pet);
          set({ refreshing: false });
        }
      } catch (e) {
        console.warn('[useTopMatchesStore] batch scoring failed, using cached scores:', e);
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

      try {
        await invalidateStaleScores(petId);
        await batchScoreHybrid(petId, pet);
      } catch (e) {
        console.warn('[useTopMatchesStore] batch scoring failed during refresh:', e);
      }

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
    const { activePetId } = useActivePetStore.getState();
    const query = get().searchQuery;
    set({ categoryFilter: category });

    if (!activePetId) return;

    if (query.trim()) {
      // In search mode — re-search with new category
      const pet = getPet(activePetId);
      if (pet) {
        get().executeSearch(query, pet.species);
      }
    } else {
      // Top Matches mode — re-fetch from cache
      set({ searchQuery: '' });
      fetchTopMatches(activePetId, {
        category: category === 'all' ? undefined : category,
      })
        .then(scores => set({ scores }))
        .catch(e => console.error('[useTopMatchesStore] setFilter fetch failed:', e));
    }
  },

  setSearch: (query) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [], searchLoading: false });
    }
  },

  executeSearch: async (query, species) => {
    if (!query.trim()) {
      set({ searchResults: [], searchLoading: false });
      return;
    }
    set({ searchLoading: true });
    try {
      const category = get().categoryFilter;
      const results = await searchProducts(query, species, {
        category: category === 'all' ? undefined : category,
      });
      // Staleness guard — only apply if query hasn't changed
      if (get().searchQuery === query) {
        set({ searchResults: results, searchLoading: false });
      }
    } catch (e) {
      console.warn('[useTopMatchesStore] executeSearch failed:', e);
      if (get().searchQuery === query) {
        set({ searchResults: [], searchLoading: false });
      }
    }
  },
}));
