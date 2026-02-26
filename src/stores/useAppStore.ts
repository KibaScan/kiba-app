// Kiba — App-Level State
import { create } from 'zustand';

interface AppState {
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  activeModal: string | null;

  completeOnboarding: () => void;
  setLoading: (loading: boolean) => void;
  showModal: (modalId: string) => void;
  hideModal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  hasCompletedOnboarding: false,
  isLoading: false,
  activeModal: null,

  completeOnboarding: () => set({ hasCompletedOnboarding: true }),
  setLoading: (loading) => set({ isLoading: loading }),
  showModal: (modalId) => set({ activeModal: modalId }),
  hideModal: () => set({ activeModal: null }),
}));
