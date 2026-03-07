// Kiba — App-Level State (persisted via AsyncStorage)
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENT_TOS_VERSION = '1.0';

interface AppState {
  hasCompletedOnboarding: boolean;
  hasAcceptedTos: boolean;
  tosVersion: string | null;
  tosAcceptedAt: string | null;
  isLoading: boolean;
  activeModal: string | null;

  completeOnboarding: () => void;
  acceptTos: () => void;
  setLoading: (loading: boolean) => void;
  showModal: (modalId: string) => void;
  hideModal: () => void;
}

export { CURRENT_TOS_VERSION };

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      hasAcceptedTos: false,
      tosVersion: null,
      tosAcceptedAt: null,
      isLoading: false,
      activeModal: null,

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      acceptTos: () =>
        set({
          hasAcceptedTos: true,
          tosVersion: CURRENT_TOS_VERSION,
          tosAcceptedAt: new Date().toISOString(),
        }),
      setLoading: (loading) => set({ isLoading: loading }),
      showModal: (modalId) => set({ activeModal: modalId }),
      hideModal: () => set({ activeModal: null }),
    }),
    {
      name: 'kiba-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasAcceptedTos: state.hasAcceptedTos,
        tosVersion: state.tosVersion,
        tosAcceptedAt: state.tosAcceptedAt,
      }),
      // Re-prompt TOS if version changes
      merge: (persisted: any, current) => {
        const merged = { ...current, ...(persisted as object) };
        if (merged.tosVersion !== CURRENT_TOS_VERSION) {
          merged.hasAcceptedTos = false;
          merged.tosVersion = null;
          merged.tosAcceptedAt = null;
        }
        return merged;
      },
    },
  ),
);
