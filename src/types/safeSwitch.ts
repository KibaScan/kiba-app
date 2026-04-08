// Kiba — M7 Safe Switch Types
// Matches safe_switches + safe_switch_logs tables (migration 025).

// ─── Union Types ────────────────────────────────────────

export type SafeSwitchStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type TummyCheck = 'perfect' | 'soft_stool' | 'upset';

// ─── DB Interfaces ──────────────────────────────────────

/** Matches safe_switches table exactly. Migration 031 added pantry_item_id + outcome_summary. */
export interface SafeSwitch {
  id: string;
  user_id: string;
  pet_id: string;
  old_product_id: string;
  new_product_id: string;
  /**
   * M9 Phase B: anchors the switch to a specific pantry_items row so completion
   * can atomically swap that row's product_id. Nullable for historical rows
   * and backfill-unmatched rows. New rows enforced non-null via service layer.
   */
  pantry_item_id: string | null;
  new_serving_size: number | null;
  new_serving_size_unit: string | null;
  new_feedings_per_day: number | null;
  status: SafeSwitchStatus;
  total_days: number;
  started_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  /** M9 Phase B: persisted SwitchOutcome + OutcomeMessage at completion time. */
  outcome_summary: { outcome: SwitchOutcome; message: OutcomeMessage } | null;
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
  /** Daily total serving amount from pantry serving data (fallback: 2.4) */
  dailyServingAmount: number;
  /** Serving size unit from pantry (fallback: 'cups') */
  dailyServingUnit: string;
}

/**
 * Input for creating a new safe switch.
 * M9 Phase B: `pantry_item_id` replaces `old_product_id`. The service derives
 * old_product_id server-side from the anchored pantry item's product_id, so
 * callers cannot create switches against phantom products.
 */
export interface CreateSafeSwitchInput {
  pet_id: string;
  pantry_item_id: string;
  new_product_id: string;
  total_days: number;
  new_serving_size: number | null;
  new_serving_size_unit: string | null;
  new_feedings_per_day: number | null;
}

// ─── Completion Outcome (Phase A) ───────────────────────

/** Computed outcome summary from a completed switch's tummy logs. */
export interface SwitchOutcome {
  totalDays: number;
  loggedDays: number;
  missedDays: number;
  perfectCount: number;
  softStoolCount: number;
  upsetCount: number;
  /** Longest run of consecutive "upset" logs during the transition. */
  maxConsecutiveUpset: number;
}

/** Copy + tone for the completed-state card, derived from a SwitchOutcome. */
export interface OutcomeMessage {
  title: string;
  body: string;
  /** Visual tone hint for the completion card. */
  tone: 'good' | 'neutral' | 'caution';
}
