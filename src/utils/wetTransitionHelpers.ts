// Kiba — Wet Food Transition Helpers (V2-3)
// Pure functions for discrete-food (cans, pouches) transition schedules.
// Unlike Safe Switch (cup-mixing ratios), this uses portion-swap phases.
// No side effects, fully testable.

// ─── Types ─────────────────────────────────────────────

export interface WetTransitionPhase {
  /** Number of days in this phase. 0 = steady state (final phase). */
  days: number;
  /** Old food portions per day. '½' for half-portion splits. */
  oldPortions: number | '½';
  /** New food portions per day. '½' for half-portion splits. */
  newPortions: number | '½';
  /** Human-readable phase description. */
  label: string;
}

export interface WetTransitionRecord {
  petId: string;
  productId: string;
  productName: string;
  startedAt: string; // ISO 8601
  totalDays: number;
  unitsPerDay: number;
  schedule: WetTransitionPhase[];
  dismissed: boolean;
}

export interface CurrentPhaseResult {
  phase: WetTransitionPhase;
  dayInPhase: number;
  overallDay: number;
  phaseIndex: number;
}

// ─── Schedule Generation ───────────────────────────────

/**
 * Phase duration per species.
 * Dogs: 2 days/phase. Cats: 3 days/phase (slower GI adaptation).
 */
function phaseDays(species: 'dog' | 'cat'): number {
  return species === 'cat' ? 3 : 2;
}

/**
 * Generates a portion-swap schedule for discrete food transitions.
 *
 * For n ≥ 3: three phases (introduce → half → all new).
 * For n ≤ 2: two phases (introduce → all new).
 * For n = 1: half-portion split (½ old + ½ new → all new).
 */
export function getWetTransitionSchedule(
  unitsPerDay: number,
  species: 'dog' | 'cat',
): WetTransitionPhase[] {
  const n = Math.max(1, Math.round(unitsPerDay));
  const d = phaseDays(species);

  if (n === 1) {
    return [
      { days: d, oldPortions: '½', newPortions: '½', label: 'Feed ½ old and ½ new per day' },
      { days: 0, oldPortions: 0, newPortions: 1, label: 'All new food' },
    ];
  }

  if (n === 2) {
    return [
      { days: d, oldPortions: 1, newPortions: 1, label: 'Swap 1 serving to the new food per day' },
      { days: 0, oldPortions: 0, newPortions: 2, label: 'All new food' },
    ];
  }

  // n ≥ 3: three-phase schedule
  const halfOld = Math.ceil(n / 2);
  const halfNew = Math.floor(n / 2);

  return [
    { days: d, oldPortions: n - 1, newPortions: 1, label: `Swap 1 of your ${n} daily servings to the new food` },
    { days: d, oldPortions: halfOld, newPortions: halfNew, label: `Swap ${halfNew} of your ${n} daily servings to the new food` },
    { days: 0, oldPortions: 0, newPortions: n, label: 'All new food' },
  ];
}

/**
 * Total transition days (excludes the final steady-state phase).
 */
export function getWetTransitionTotalDays(schedule: WetTransitionPhase[]): number {
  return schedule.reduce((sum, phase) => sum + phase.days, 0);
}

// ─── Phase Lookup ──────────────────────────────────────

/**
 * Computes the current day number (1-based) from the start date.
 * Uses date-only comparison for timezone safety (matches Safe Switch pattern).
 */
function daysSinceStart(startedAt: string): number {
  const start = new Date(startedAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffMs = today.getTime() - startDay.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // Day 1 = start date
}

/**
 * Returns the current phase, day within that phase, and overall day number.
 * Returns null when the transition has expired (past totalDays).
 */
export function getCurrentWetPhase(
  startedAt: string,
  schedule: WetTransitionPhase[],
): CurrentPhaseResult | null {
  const totalDays = getWetTransitionTotalDays(schedule);
  const overall = daysSinceStart(startedAt);

  if (overall < 1 || overall > totalDays) return null;

  let dayCounter = 0;
  for (let i = 0; i < schedule.length; i++) {
    const phase = schedule[i];
    if (phase.days === 0) continue; // Skip steady-state
    if (overall <= dayCounter + phase.days) {
      return {
        phase,
        dayInPhase: overall - dayCounter,
        overallDay: overall,
        phaseIndex: i,
      };
    }
    dayCounter += phase.days;
  }

  return null;
}

/**
 * Whether the transition period has passed.
 */
export function isWetTransitionExpired(startedAt: string, totalDays: number): boolean {
  return daysSinceStart(startedAt) > totalDays;
}
