// Kiba — Safe Switch Helpers (M7)
// Pure functions for transition schedule math. No side effects, fully testable.

import type { TransitionDay } from '../types/safeSwitch';

// ─── Schedule Configuration ─────────────────────────────

/**
 * 7-day schedule (dogs):
 *   Days 1-2: 75/25 → Days 3-4: 50/50 → Days 5-6: 25/75 → Day 7: 0/100
 *
 * 10-day schedule (cats — slower GI transition):
 *   Days 1-3: 75/25 → Days 4-6: 50/50 → Days 7-9: 25/75 → Day 10: 0/100
 */

interface PhaseConfig {
  /** Number of days in this phase */
  days: number;
  /** Percentage of old food */
  oldPct: number;
  /** Percentage of new food */
  newPct: number;
}

const PHASE_RATIOS: readonly { oldPct: number; newPct: number }[] = [
  { oldPct: 75, newPct: 25 },
  { oldPct: 50, newPct: 50 },
  { oldPct: 25, newPct: 75 },
  { oldPct: 0, newPct: 100 },
];

function buildPhases(totalDays: number): PhaseConfig[] {
  // Final day is always 0/100 (1 day)
  const remaining = totalDays - 1;
  const phaseDays = Math.floor(remaining / 3);
  const extraDays = remaining - phaseDays * 3;

  // Distribute extra days to earlier phases (more gradual start)
  return [
    { days: phaseDays + (extraDays > 0 ? 1 : 0), ...PHASE_RATIOS[0] },
    { days: phaseDays + (extraDays > 1 ? 1 : 0), ...PHASE_RATIOS[1] },
    { days: phaseDays, ...PHASE_RATIOS[2] },
    { days: 1, ...PHASE_RATIOS[3] },
  ];
}

// ─── Public API ─────────────────────────────────────────

/**
 * Returns the default transition duration for a species.
 * Dogs: 7 days. Cats: 10 days (slower GI adaptation).
 */
export function getDefaultDuration(species: 'dog' | 'cat'): number {
  return species === 'cat' ? 10 : 7;
}

/**
 * Generates the full day-by-day transition schedule.
 */
export function getTransitionSchedule(totalDays: number): TransitionDay[] {
  const phases = buildPhases(totalDays);
  const schedule: TransitionDay[] = [];
  let dayNum = 1;

  for (const phase of phases) {
    for (let i = 0; i < phase.days; i++) {
      schedule.push({
        day: dayNum,
        oldPct: phase.oldPct,
        newPct: phase.newPct,
        phase: phase.newPct === 100
          ? '100% new food'
          : `${phase.oldPct}% old / ${phase.newPct}% new`,
      });
      dayNum++;
    }
  }

  return schedule;
}

/**
 * Returns the mix percentages for a given day.
 * Day is 1-based; values outside [1, totalDays] are clamped.
 */
export function getMixForDay(
  day: number,
  totalDays: number,
): { oldPct: number; newPct: number } {
  const schedule = getTransitionSchedule(totalDays);
  const clamped = Math.max(1, Math.min(day, totalDays));
  const entry = schedule[clamped - 1];
  return entry
    ? { oldPct: entry.oldPct, newPct: entry.newPct }
    : { oldPct: 0, newPct: 100 };
}

/**
 * Computes the current day number (1-based) from the start date.
 * Returns clamped value in [1, totalDays].
 * Accounts for timezone by using date-only comparison.
 */
export function getCurrentDay(startedAt: string, totalDays: number): number {
  const start = new Date(startedAt + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  const diffMs = today.getTime() - startDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Day 1 = start date (diffDays = 0 → day 1)
  return Math.max(1, Math.min(diffDays + 1, totalDays));
}

/**
 * Splits a total serving amount into old/new portions based on day percentages.
 * Returns amounts rounded to 1 decimal place.
 */
export function getCupSplit(
  totalCups: number,
  oldPct: number,
  newPct: number,
): { oldCups: number; newCups: number } {
  const oldCups = Math.round((totalCups * oldPct / 100) * 10) / 10;
  const newCups = Math.round((totalCups * newPct / 100) * 10) / 10;
  return { oldCups, newCups };
}

/**
 * Checks if a tummy upset pattern warrants showing an advisory.
 * Returns true if 2+ consecutive "upset" logs in the last 3 days.
 * D-095 compliant — informational only, no auto-action.
 */
export function shouldShowUpsetAdvisory(
  logs: { day_number: number; tummy_check: string | null }[],
  currentDay: number,
): boolean {
  // Check the last 3 logged days (or fewer if not enough data)
  const recentDays = [currentDay - 2, currentDay - 1, currentDay].filter(d => d >= 1);
  const recentLogs = recentDays
    .map(d => logs.find(l => l.day_number === d))
    .filter(Boolean);

  let consecutiveUpset = 0;
  for (const log of recentLogs) {
    if (log?.tummy_check === 'upset') {
      consecutiveUpset++;
      if (consecutiveUpset >= 2) return true;
    } else {
      consecutiveUpset = 0;
    }
  }
  return false;
}

/**
 * Returns species-specific copy for the transition duration note.
 * D-095 compliant — factual, no health claims.
 */
export function getSpeciesNote(species: 'dog' | 'cat', petName: string, totalDays: number): string {
  if (species === 'cat') {
    return `${petName} is a cat. A gradual ${totalDays}-day transition is recommended. Cats typically need more time to adjust to new foods. We'll remind you each morning.`;
  }
  return `${petName} is a dog. Standard ${totalDays}-day transition recommended. We'll remind you each morning.`;
}
