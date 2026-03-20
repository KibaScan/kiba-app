// M5 Pantry Store — Zustand state for active pet's pantry.
// No persistence — data fetched from Supabase on each screen focus.
// All mutations reload via getPantryForPet + evaluateDietCompleteness.

import { create } from 'zustand';
import type { PantryCardData, DietCompletenessResult, AddToPantryInput } from '../types/pantry';
import { PantryOfflineError } from '../types/pantry';
import {
  getPantryForPet,
  addToPantry,
  removePantryItem,
  restockPantryItem,
  updatePantryItem,
  sharePantryItem,
  evaluateDietCompleteness,
} from '../services/pantryService';
import { useActivePetStore } from './useActivePetStore';
import { useTreatBatteryStore, resolveTreatKcal } from './useTreatBatteryStore';
import { rescheduleAllFeeding } from '../services/feedingNotificationScheduler';

interface PantryState {
  items: PantryCardData[];
  dietStatus: DietCompletenessResult | null;
  loading: boolean;
  error: string | null;
  _petId: string | null;

  loadPantry: (petId: string) => Promise<void>;
  addItem: (input: AddToPantryInput, petId: string) => Promise<void>;
  removeItem: (itemId: string, petId?: string) => Promise<void>;
  restockItem: (itemId: string) => Promise<void>;
  updateItem: (itemId: string, updates: Parameters<typeof updatePantryItem>[1]) => Promise<void>;
  shareItem: (itemId: string, petId: string, assignment: Parameters<typeof sharePantryItem>[2]) => Promise<void>;
  logTreat: (itemId: string, petId: string) => Promise<void>;
  refreshDietStatus: (petId: string) => Promise<void>;
}

function getPetName(petId: string): string {
  const pet = useActivePetStore.getState().pets.find(p => p.id === petId);
  return pet?.name ?? 'Your pet';
}

export const usePantryStore = create<PantryState>()((set, get) => ({
  items: [],
  dietStatus: null,
  loading: false,
  error: null,
  _petId: null,

  loadPantry: async (petId) => {
    set({ loading: true, error: null, _petId: petId });
    try {
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(petId),
        evaluateDietCompleteness(petId, getPetName(petId)),
      ]);
      set({ items, dietStatus, loading: false });
    } catch (e) {
      console.error('[usePantryStore] loadPantry failed:', e);
      set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to load pantry.', loading: false });
    }
  },

  addItem: async (input, petId) => {
    set({ loading: true, error: null });
    try {
      await addToPantry(input, petId);
      const pid = get()._petId ?? petId;
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(pid),
        evaluateDietCompleteness(pid, getPetName(pid)),
      ]);
      set({ items, dietStatus, loading: false });
      rescheduleAllFeeding().catch(() => {});
    } catch (e) {
      console.error('[usePantryStore] addItem failed:', e);
      set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to add item.', loading: false });
    }
  },

  removeItem: async (itemId, petId) => {
    set({ loading: true, error: null });
    try {
      await removePantryItem(itemId, petId);
      const pid = get()._petId!;
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(pid),
        evaluateDietCompleteness(pid, getPetName(pid)),
      ]);
      set({ items, dietStatus, loading: false });
      rescheduleAllFeeding().catch(() => {});
    } catch (e) {
      console.error('[usePantryStore] removeItem failed:', e);
      set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to remove item.', loading: false });
    }
  },

  restockItem: async (itemId) => {
    set({ loading: true, error: null });
    try {
      await restockPantryItem(itemId);
      const pid = get()._petId!;
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(pid),
        evaluateDietCompleteness(pid, getPetName(pid)),
      ]);
      set({ items, dietStatus, loading: false });
    } catch (e) {
      console.error('[usePantryStore] restockItem failed:', e);
      set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to restock item.', loading: false });
    }
  },

  updateItem: async (itemId, updates) => {
    set({ loading: true, error: null });
    try {
      await updatePantryItem(itemId, updates);
      const pid = get()._petId!;
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(pid),
        evaluateDietCompleteness(pid, getPetName(pid)),
      ]);
      set({ items, dietStatus, loading: false });
    } catch (e) {
      console.error('[usePantryStore] updateItem failed:', e);
      set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to update item.', loading: false });
    }
  },

  shareItem: async (itemId, petId, assignment) => {
    set({ loading: true, error: null });
    try {
      await sharePantryItem(itemId, petId, assignment);
      const pid = get()._petId!;
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(pid),
        evaluateDietCompleteness(pid, getPetName(pid)),
      ]);
      set({ items, dietStatus, loading: false });
      rescheduleAllFeeding().catch(() => {});
    } catch (e) {
      console.error('[usePantryStore] shareItem failed:', e);
      set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to share item.', loading: false });
    }
  },

  logTreat: async (itemId, petId) => {
    const items = get().items;
    const item = items.find(i => i.id === itemId);
    if (!item || item.is_empty) return;

    const newQty = Math.max(0, item.quantity_remaining - 1);
    const kcal = resolveTreatKcal(item.product);

    // Optimistic update
    set({
      items: items.map(i =>
        i.id === itemId
          ? {
              ...i,
              quantity_remaining: newQty,
              is_empty: newQty <= 0,
              is_low_stock: newQty > 0 && newQty <= 5,
            }
          : i
      ),
    });

    // Track in battery
    useTreatBatteryStore.getState().addTreatConsumption(petId, kcal);

    try {
      await updatePantryItem(itemId, { quantity_remaining: newQty });
    } catch {
      // Revert optimistic update
      set({ items });
    }
  },

  refreshDietStatus: async (petId) => {
    try {
      const dietStatus = await evaluateDietCompleteness(petId, getPetName(petId));
      set({ dietStatus });
    } catch (e) {
      console.error('[usePantryStore] refreshDietStatus failed:', e);
    }
  },
}));
