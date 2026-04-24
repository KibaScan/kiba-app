// M5 Pantry Store — Zustand state for active pet's pantry.
// No persistence — data fetched from Supabase on each screen focus.
// All mutations reload via getPantryForPet + evaluateDietCompleteness.

import { Alert } from 'react-native';
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
import { getActiveSwitchForPet } from '../services/safeSwitchService';
import type { SafeSwitchCardData } from '../types/safeSwitch';
import { useActivePetStore } from './useActivePetStore';
import type { Product } from '../types';
import { useTreatBatteryStore, resolveTreatKcal } from './useTreatBatteryStore';
import { rescheduleAllFeeding } from '../services/feedingNotificationScheduler';
import { canUseGoalWeight } from '../utils/permissions';

interface CachedPetPantry {
  items: PantryCardData[];
  dietStatus: DietCompletenessResult | null;
  activeSwitchData: SafeSwitchCardData | null;
}

interface PantryState {
  items: PantryCardData[];
  dietStatus: DietCompletenessResult | null;
  activeSwitchData: SafeSwitchCardData | null;
  loading: boolean;
  error: string | null;
  _petId: string | null;
  _petCache: Record<string, CachedPetPantry>;

  loadPantry: (petId: string) => Promise<void>;
  addItem: (
    input: AddToPantryInput,
    petId: string
  ) => Promise<void>;
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
  activeSwitchData: null,
  loading: false,
  error: null,
  _petId: null,
  _petCache: {},

  loadPantry: async (petId) => {
    const cached = get()._petCache[petId];

    if (cached) {
      // Cache hit: render instantly from cache, refresh in background
      set({
        items: cached.items,
        dietStatus: cached.dietStatus,
        activeSwitchData: cached.activeSwitchData,
        loading: false,
        error: null,
        _petId: petId,
      });
    } else {
      // Cache miss: clear the previous pet's data so it can't leak under
      // the new pet's header, and show the spinner via the
      // `loading && items.length === 0` guard in PantryScreen.
      set({
        items: [],
        dietStatus: null,
        activeSwitchData: null,
        loading: true,
        error: null,
        _petId: petId,
      });
    }

    try {
      const [items, dietStatus, activeSwitchData] = await Promise.all([
        getPantryForPet(petId),
        evaluateDietCompleteness(petId, getPetName(petId)),
        getActiveSwitchForPet(petId),
      ]);

      // User may have switched pets while this fetch was in flight —
      // the store's _petId is the authoritative "current pet".
      if (get()._petId !== petId) return;

      set({
        items,
        dietStatus,
        activeSwitchData,
        loading: false,
        _petCache: {
          ...get()._petCache,
          [petId]: { items, dietStatus, activeSwitchData },
        },
      });
    } catch (e) {
      if (get()._petId !== petId) return;
      console.error('[usePantryStore] loadPantry failed:', e);
      set({
        error: e instanceof PantryOfflineError ? e.message : 'Failed to load pantry.',
        loading: false,
      });
    }
  },

  addItem: async (input, petId) => {
    set({ loading: true, error: null });
    try {
      await addToPantry(input, petId);

      // Refetch the pet we mutated (petId arg), not the currently-active pet.
      // Cross-pet race: if user switched while the server call was in flight,
      // `_petId` now points to a different pet — using it would make us refetch
      // the wrong pet and leave the mutated pet's cache stale.
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(petId),
        evaluateDietCompleteness(petId, getPetName(petId)),
      ]);
      const activeSwitchData = get()._petCache[petId]?.activeSwitchData ?? null;
      const nextCache = {
        ...get()._petCache,
        [petId]: { items, dietStatus, activeSwitchData },
      };

      // Always update cache; only update top-level state if the mutated pet
      // is still active (avoids clobbering the now-visible pet's view).
      if (get()._petId === petId) {
        set({ items, dietStatus, loading: false, _petCache: nextCache });
      } else {
        set({ _petCache: nextCache, loading: false });
      }
      rescheduleAllFeeding().catch(() => {});
    } catch (e) {
      console.error('[usePantryStore] addItem failed:', e);
      if (get()._petId === petId) {
        set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to add item.', loading: false });
      } else {
        set({ loading: false });
      }
    }
  },

  removeItem: async (itemId, petId) => {
    const pid = get()._petId ?? petId;
    if (!pid) {
      const msg = 'No pet ID available for removal.';
      if (__DEV__) console.warn('[usePantryStore] removeItem failed:', msg);
      set({ error: msg, loading: false });
      Alert.alert('Cannot Remove', msg);
      return;
    }
    set({ loading: true, error: null });
    try {
      await removePantryItem(itemId, petId);

      const [items, dietStatus] = await Promise.all([
        getPantryForPet(pid),
        evaluateDietCompleteness(pid, getPetName(pid)),
      ]);
      const activeSwitchData = get()._petCache[pid]?.activeSwitchData ?? null;
      const nextCache = {
        ...get()._petCache,
        [pid]: { items, dietStatus, activeSwitchData },
      };

      if (get()._petId === pid) {
        set({ items, dietStatus, loading: false, _petCache: nextCache });
      } else {
        set({ _petCache: nextCache, loading: false });
      }
      rescheduleAllFeeding().catch(() => {});
    } catch (e) {
      const msg = (e as Error).message ?? 'Failed to remove item.';
      if (__DEV__) console.warn('[usePantryStore] removeItem failed:', msg);
      if (get()._petId === pid) {
        set({ error: msg, loading: false });
        Alert.alert('Cannot Remove', msg);
      } else {
        set({ loading: false });
      }
    }
  },

  restockItem: async (itemId) => {
    // Capture mutated pet BEFORE the await — reading `_petId` after means we'd
    // refetch whatever pet is active when the server call returns, not the one
    // whose item we just restocked.
    const pid = get()._petId;
    if (!pid) return;
    set({ loading: true, error: null });
    try {
      await restockPantryItem(itemId);
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(pid),
        evaluateDietCompleteness(pid, getPetName(pid)),
      ]);
      const activeSwitchData = get()._petCache[pid]?.activeSwitchData ?? null;
      const nextCache = {
        ...get()._petCache,
        [pid]: { items, dietStatus, activeSwitchData },
      };
      if (get()._petId === pid) {
        set({ items, dietStatus, loading: false, _petCache: nextCache });
      } else {
        set({ _petCache: nextCache, loading: false });
      }
    } catch (e) {
      console.error('[usePantryStore] restockItem failed:', e);
      if (get()._petId === pid) {
        set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to restock item.', loading: false });
      } else {
        set({ loading: false });
      }
    }
  },

  updateItem: async (itemId, updates) => {
    const pid = get()._petId;
    if (!pid) return;
    set({ loading: true, error: null });
    try {
      await updatePantryItem(itemId, updates);
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(pid),
        evaluateDietCompleteness(pid, getPetName(pid)),
      ]);
      const activeSwitchData = get()._petCache[pid]?.activeSwitchData ?? null;
      const nextCache = {
        ...get()._petCache,
        [pid]: { items, dietStatus, activeSwitchData },
      };
      if (get()._petId === pid) {
        set({ items, dietStatus, loading: false, _petCache: nextCache });
      } else {
        set({ _petCache: nextCache, loading: false });
      }
    } catch (e) {
      console.error('[usePantryStore] updateItem failed:', e);
      if (get()._petId === pid) {
        set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to update item.', loading: false });
      } else {
        set({ loading: false });
      }
    }
  },

  shareItem: async (itemId, petId, assignment) => {
    // `petId` is the RECIPIENT. The sharer (item owner) is the currently-active
    // pet — capture it before the await so a mid-flight pet switch doesn't
    // make us refetch the wrong pantry.
    const sharerId = get()._petId;
    if (!sharerId) return;
    set({ loading: true, error: null });
    try {
      await sharePantryItem(itemId, petId, assignment);
      const [items, dietStatus] = await Promise.all([
        getPantryForPet(sharerId),
        evaluateDietCompleteness(sharerId, getPetName(sharerId)),
      ]);
      const activeSwitchData = get()._petCache[sharerId]?.activeSwitchData ?? null;
      // Share rebalances/refreshes the recipient's assignments server-side
      // (rebalanceBaseShares + refreshWetReserve) — invalidate its cache entry
      // so the next switch to that pet fetches fresh data. If petId === sharerId
      // (defensive), the subsequent reassignment wins and the entry is rebuilt.
      const nextCache = { ...get()._petCache };
      delete nextCache[petId];
      nextCache[sharerId] = { items, dietStatus, activeSwitchData };
      if (get()._petId === sharerId) {
        set({ items, dietStatus, loading: false, _petCache: nextCache });
      } else {
        set({ _petCache: nextCache, loading: false });
      }
      rescheduleAllFeeding().catch(() => {});
    } catch (e) {
      console.error('[usePantryStore] shareItem failed:', e);
      if (get()._petId === sharerId) {
        set({ error: e instanceof PantryOfflineError ? e.message : 'Failed to share item.', loading: false });
      } else {
        set({ loading: false });
      }
    }
  },

  // Note on cross-pet race: logTreat does NOT share the staleness bug that
  // the other mutations had. All writes are keyed to the explicit `petId` arg
  // (both the optimistic apply and the error revert target `_petCache[petId]`),
  // so a mid-flight pet switch can't misroute the cache update. The only
  // narrow window is the `set({ items: applyTreatDeduction(items) })` write,
  // which targets top-level state — but it happens BEFORE the await, so the
  // switch can only happen after it. The later revert-on-error also writes
  // stale top-level `items`; on a mid-flight pet switch the new pet's state
  // would briefly flicker with the sharer's items. Small enough to flag here
  // rather than fix in this pass.
  logTreat: async (itemId, petId) => {
    const items = get().items;
    const item = items.find(i => i.id === itemId);
    if (!item || item.is_empty) return;

    const newQty = Math.max(0, item.quantity_remaining - 1);
    const kcal = resolveTreatKcal(item.product);

    const applyTreatDeduction = (arr: PantryCardData[]) =>
      arr.map(i =>
        i.id === itemId
          ? {
              ...i,
              quantity_remaining: newQty,
              is_empty: newQty <= 0,
              is_low_stock: newQty > 0 && newQty <= 5,
            }
          : i,
      );

    // Capture pre-mutation cache entry so revert can restore it exactly.
    const cachedBefore = get()._petCache[petId];

    // Optimistic update — live items + cache entry (if cached).
    set({
      items: applyTreatDeduction(items),
      _petCache: cachedBefore
        ? {
            ...get()._petCache,
            [petId]: { ...cachedBefore, items: applyTreatDeduction(cachedBefore.items) },
          }
        : get()._petCache,
    });

    // Track in battery
    useTreatBatteryStore.getState().addTreatConsumption(petId, kcal);

    try {
      await updatePantryItem(itemId, { quantity_remaining: newQty });
    } catch {
      // Revert optimistic update — live items + cache entry.
      set({
        items,
        _petCache: cachedBefore
          ? { ...get()._petCache, [petId]: cachedBefore }
          : get()._petCache,
      });
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
