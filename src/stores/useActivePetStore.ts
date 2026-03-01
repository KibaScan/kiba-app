// D-120: Global Active Pet Store
// Manages which pet is currently active for scoring/scanning context.
// Only `activePetId` is persisted to AsyncStorage (survives app restart).
// Full pets array is fetched from Supabase on load — not persisted locally.
//
// Does NOT replace usePetStore.ts yet. Both stores coexist until Session 2 UI migration.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pet } from '../types/pet';
import { supabase } from '../services/supabase';

interface ActivePetState {
  activePetId: string | null;
  pets: Pet[];
  setActivePet: (petId: string) => void;
  loadPets: () => Promise<void>;
  addPet: (pet: Pet) => void;
  removePet: (petId: string) => void;
  updatePet: (petId: string, updates: Partial<Pet>) => void;
}

export const useActivePetStore = create<ActivePetState>()(
  persist(
    (set, get) => ({
      activePetId: null,
      pets: [],

      setActivePet: (petId) => set({ activePetId: petId }),

      loadPets: async () => {
        const { data, error } = await supabase
          .from('pets')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[useActivePetStore] Failed to load pets:', error.message);
          return;
        }

        const pets = (data ?? []) as Pet[];
        const currentActiveId = get().activePetId;
        const activeStillValid = pets.some((p) => p.id === currentActiveId);

        set({
          pets,
          activePetId: activeStillValid ? currentActiveId : (pets[0]?.id ?? null),
        });
      },

      addPet: (pet) =>
        set((state) => ({
          pets: [...state.pets, pet],
          activePetId: state.pets.length === 0 ? pet.id : state.activePetId,
        })),

      removePet: (petId) =>
        set((state) => {
          const remaining = state.pets.filter((p) => p.id !== petId);
          return {
            pets: remaining,
            activePetId:
              state.activePetId === petId
                ? (remaining[0]?.id ?? null)
                : state.activePetId,
          };
        }),

      updatePet: (petId, updates) =>
        set((state) => ({
          pets: state.pets.map((p) =>
            p.id === petId ? { ...p, ...updates } : p,
          ),
        })),
    }),
    {
      name: 'kiba-active-pet',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activePetId: state.activePetId }),
    },
  ),
);
