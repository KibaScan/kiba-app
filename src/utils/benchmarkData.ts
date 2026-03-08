/**
 * Benchmark Data — Zustand-cached category averages for BenchmarkBar.
 * Fetches once per session, serves from cache thereafter.
 */

import { create } from 'zustand';
import { supabase } from '../services/supabase';

// ─── Types ────────────────────────────────────────────────

export interface CategoryAverage {
  avg_score: number;
  median_score: number;
  min_score: number;
  max_score: number;
  product_count: number;
}

interface BenchmarkState {
  cache: Record<string, CategoryAverage>;
  loading: Record<string, boolean>;
  getCategoryAverage: (
    category: 'daily_food' | 'treat',
    targetSpecies: 'dog' | 'cat',
    isGrainFree: boolean,
  ) => Promise<CategoryAverage | null>;
}

function cacheKey(category: string, species: string, grainFree: boolean): string {
  return `${category}|${species}|${grainFree}`;
}

// ─── Store ────────────────────────────────────────────────

export const useBenchmarkStore = create<BenchmarkState>()((set, get) => ({
  cache: {},
  loading: {},

  getCategoryAverage: async (category, targetSpecies, isGrainFree) => {
    const key = cacheKey(category, targetSpecies, isGrainFree);
    const state = get();

    // Return cached result
    if (state.cache[key]) return state.cache[key];

    // Already fetching
    if (state.loading[key]) return null;

    set({ loading: { ...get().loading, [key]: true } });

    const { data, error } = await supabase
      .from('category_averages')
      .select('avg_score, median_score, min_score, max_score, product_count')
      .eq('category', category)
      .eq('target_species', targetSpecies)
      .eq('is_grain_free', isGrainFree)
      .single();

    if (error || !data) {
      set({ loading: { ...get().loading, [key]: false } });
      return null;
    }

    const avg = data as CategoryAverage;
    set({
      cache: { ...get().cache, [key]: avg },
      loading: { ...get().loading, [key]: false },
    });

    return avg;
  },
}));
