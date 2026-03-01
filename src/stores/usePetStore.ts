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
      date_of_birth: null,
      dob_is_approximate: false,
      weight_current_lbs: null,
      weight_goal_lbs: null,
      weight_updated_at: null,
      activity_level: 'moderate',
      is_neutered: true,
      sex: null,
      breed_size: null,
      life_stage: LifeStage.Adult,
      photo_url: null,
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
