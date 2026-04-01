// Kiba — M7 Safe Switch Types
// Matches safe_switches + safe_switch_logs tables (migration 025).

// ─── Union Types ────────────────────────────────────────

export type SafeSwitchStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type TummyCheck = 'perfect' | 'soft_stool' | 'upset';

// ─── DB Interfaces ──────────────────────────────────────

/** Matches safe_switches table exactly. */
export interface SafeSwitch {
  id: string;
  user_id: string;
  pet_id: string;
  old_product_id: string;
  new_product_id: string;
  status: SafeSwitchStatus;
  total_days: number;
  started_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Matches safe_switch_logs table exactly. */
export interface SafeSwitchLog {
  id: string;
  switch_id: string;
  day_number: number;
  tummy_check: TummyCheck | null;
  logged_at: string;
}

// ─── Composite / Computed Interfaces ────────────────────

/** Product summary for Safe Switch cards — minimal fields to avoid over-fetching. */
export interface SafeSwitchProduct {
  id: string;
  name: string;
  brand: string;
  image_url: string | null;
  category: string;
  is_supplemental: boolean;
  ga_kcal_per_cup: number | null;
  ga_kcal_per_kg: number | null;
}

/** Day entry in the transition schedule. */
export interface TransitionDay {
  day: number;
  oldPct: number;
  newPct: number;
  phase: string;  // e.g. "75% old / 25% new"
}

/** Full composite type for UI rendering. */
export interface SafeSwitchCardData {
  switch: SafeSwitch;
  oldProduct: SafeSwitchProduct;
  newProduct: SafeSwitchProduct;
  oldScore: number | null;
  newScore: number | null;
  logs: SafeSwitchLog[];
  currentDay: number;
  todayMix: { oldPct: number; newPct: number };
  todayLogged: boolean;
  schedule: TransitionDay[];
  /** Daily total cups from pantry serving data (fallback: 2.4) */
  dailyCups: number;
}

/** Input for creating a new safe switch. */
export interface CreateSafeSwitchInput {
  pet_id: string;
  old_product_id: string;
  new_product_id: string;
  total_days: number;
}
