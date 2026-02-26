// Kiba — Scan History State
import { create } from 'zustand';
import { ScanRecord } from '../types';

interface ScanState {
  currentScan: ScanRecord | null;
  recentScans: ScanRecord[];
  weeklyCount: number;

  setCurrentScan: (scan: ScanRecord | null) => void;
  addScan: (scan: ScanRecord) => void;
  clearCurrentScan: () => void;
  resetWeeklyCount: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  currentScan: null,
  recentScans: [],
  weeklyCount: 0,

  setCurrentScan: (scan) => set({ currentScan: scan }),

  addScan: (scan) =>
    set((state) => ({
      currentScan: scan,
      recentScans: [scan, ...state.recentScans].slice(0, 50),
      weeklyCount: state.weeklyCount + 1,
    })),

  clearCurrentScan: () => set({ currentScan: null }),
  resetWeeklyCount: () => set({ weeklyCount: 0 }),
}));
