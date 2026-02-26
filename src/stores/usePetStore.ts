// Kiba — Pet Profiles State
import { create } from 'zustand';
import { PetProfile, Species, LifeStage, OnboardingPetInput } from '../types';

interface PetState {
  activePetId: string | null;
  pets: PetProfile[];

  setActivePet: (petId: string) => void;
  addPet: (input: OnboardingPetInput) => void;
  updatePet: (petId: string, updates: Partial<PetProfile>) => void;
  removePet: (petId: string) => void;
}

let nextId = 1;

export const usePetStore = create<PetState>((set, get) => ({
  activePetId: null,
  pets: [],

  setActivePet: (petId) => set({ activePetId: petId }),

  addPet: (input) => {
    const id = `local_${nextId++}`;
    const now = new Date().toISOString();
    const pet: PetProfile = {
      id,
      user_id: 'local',
      name: input.name,
      species: input.species,
      breed: null,
      age_years: null,
      age_months: null,
      weight_kg: null,
      goal_weight: null,
      life_stage: LifeStage.Adult,
      photo_url: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    set((state) => ({
      pets: [...state.pets, pet],
      activePetId: state.activePetId ?? id,
    }));
  },

  updatePet: (petId, updates) =>
    set((state) => ({
      pets: state.pets.map((p) =>
        p.id === petId ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
      ),
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
}));
