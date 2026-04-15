// Kiba — Scan History State
import { create } from 'zustand';
import { Product, ScanRecord } from '../types';

const SCAN_CACHE_MAX = 10;

interface ScanState {
  currentScan: ScanRecord | null;
  recentScans: ScanRecord[];
  weeklyCount: number;
  scanCache: Product[];
  treatLogging: boolean;

  setCurrentScan: (scan: ScanRecord | null) => void;
  addScan: (scan: ScanRecord) => void;
  addToScanCache: (product: Product) => void;
  clearCurrentScan: () => void;
  resetWeeklyCount: () => void;
  setTreatLogging: (val: boolean) => void;
}

export const useScanStore = create<ScanState>((set) => ({
  currentScan: null,
  recentScans: [],
  weeklyCount: 0,
  scanCache: [],
  treatLogging: false,

  setCurrentScan: (scan) => set({ currentScan: scan }),

  addScan: (scan) =>
    set((state) => ({
      currentScan: scan,
      recentScans: [scan, ...state.recentScans].slice(0, 50),
      weeklyCount: state.weeklyCount + 1,
    })),

  addToScanCache: (product) =>
    set((state) => {
      const filtered = state.scanCache.filter((p) => p.id !== product.id);
      return { scanCache: [product, ...filtered].slice(0, SCAN_CACHE_MAX) };
    }),

  clearCurrentScan: () => set({ currentScan: null }),
  resetWeeklyCount: () => set({ weeklyCount: 0 }),
  setTreatLogging: (val) => set({ treatLogging: val }),
}));
