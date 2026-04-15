// Kiba — Daily Treat Battery Store (M5)
// Tracks daily treat consumption per pet. Persisted via AsyncStorage, resets daily.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ──────────────────────────────────────────────

interface PetConsumption {
  kcal: number;
  count: number;
}

interface TreatBatteryState {
  consumedByPet: Record<string, PetConsumption>;
  lastResetDate: string;

  addTreatConsumption: (petId: string, kcal: number | null) => void;
  resetIfNewDay: () => void;
}

// ─── Helpers ────────────────────────────────────────────

export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolve kcal per single treat unit from pantry product data.
 * Fallback chain: kcal_per_unit → derive from kcal_per_kg + unit_weight_g → null.
 */
export function resolveTreatKcal(product: {
  kcal_per_unit: number | null;
  ga_kcal_per_kg: number | null;
  unit_weight_g: number | null;
}): number | null {
  if (product.kcal_per_unit != null && product.kcal_per_unit > 0) {
    return product.kcal_per_unit;
  }
  if (
    product.ga_kcal_per_kg != null && product.ga_kcal_per_kg > 0 &&
    product.unit_weight_g != null && product.unit_weight_g > 0
  ) {
    return Math.round((product.ga_kcal_per_kg * product.unit_weight_g) / 1000);
  }
  return null;
}

// ─── Store ──────────────────────────────────────────────

export const useTreatBatteryStore = create<TreatBatteryState>()(
  persist(
    (set, get) => ({
      consumedByPet: {},
      lastResetDate: getTodayStr(),

      addTreatConsumption: (petId, kcal) => {
        const state = get();
        const today = getTodayStr();
        const base = state.lastResetDate !== today ? {} : state.consumedByPet;
        const current = base[petId] ?? { kcal: 0, count: 0 };
        set({
          consumedByPet: {
            ...base,
            [petId]: {
              kcal: current.kcal + (kcal ?? 0),
              count: current.count + 1,
            },
          },
          lastResetDate: today,
        });
      },

      resetIfNewDay: () => {
        const today = getTodayStr();
        if (get().lastResetDate !== today) {
          set({ consumedByPet: {}, lastResetDate: today });
        }
      },
    }),
    {
      name: 'kiba-treat-battery',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        consumedByPet: state.consumedByPet,
        lastResetDate: state.lastResetDate,
      }),
    },
  ),
);
