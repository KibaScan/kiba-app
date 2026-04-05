// Kiba — Safe Switch Helpers (M7)
// Pure functions for transition schedule math. No side effects, fully testable.

import type { TransitionDay, SwitchOutcome, OutcomeMessage } from '../types/safeSwitch';

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
 * Counts the number of consecutive missed days (no tummy check logged)
 * immediately before the current day, going backwards.
 */
export function getConsecutiveMissedDays(
  logs: { day_number: number; tummy_check: string | null }[],
  currentDay: number,
): number {
  let consecutive = 0;
  for (let d = currentDay - 1; d >= 1; d--) {
    const log = logs.find(l => l.day_number === d);
    if (!log || !log.tummy_check) consecutive++;
    else break;
  }
  return consecutive;
}

/**
 * Returns true if the amber "missed days" warning should be shown.
 * Threshold: 3+ consecutive missed days. Suppressed when currentDay <= 2
 * (user hasn't had a chance to log anything yet).
 * D-095 compliant — informational suggestion only.
 */
export function shouldShowConsecutiveMissedWarning(
  logs: { day_number: number; tummy_check: string | null }[],
  currentDay: number,
): boolean {
  if (currentDay <= 2) return false;
  return getConsecutiveMissedDays(logs, currentDay) >= 3;
}

// ─── Completion Outcome (Phase A) ───────────────────────

/**
 * Computes the outcome summary of a completed switch from its tummy logs.
 * Counts each tummy check category, identifies missed days, and finds the
 * longest run of consecutive "upset" logs. Pure function — no side effects.
 * Walks day-by-day in order so the consecutive streak is meaningful.
 */
export function computeSwitchOutcome(
  logs: { day_number: number; tummy_check: string | null }[],
  totalDays: number,
): SwitchOutcome {
  let perfectCount = 0;
  let softStoolCount = 0;
  let upsetCount = 0;
  let loggedDays = 0;
  let maxConsecutiveUpset = 0;
  let currentUpsetStreak = 0;

  for (let day = 1; day <= totalDays; day++) {
    const log = logs.find(l => l.day_number === day);
    const check = log?.tummy_check ?? null;

    if (check === 'perfect') {
      perfectCount++;
      loggedDays++;
      currentUpsetStreak = 0;
    } else if (check === 'soft_stool') {
      softStoolCount++;
      loggedDays++;
      currentUpsetStreak = 0;
    } else if (check === 'upset') {
      upsetCount++;
      loggedDays++;
      currentUpsetStreak++;
      if (currentUpsetStreak > maxConsecutiveUpset) {
        maxConsecutiveUpset = currentUpsetStreak;
      }
    } else {
      // Missed day — does not break or extend the streak for the purposes
      // of this metric; only a non-upset check resets it. We treat "missed"
      // as a gap, not a reset, so a 2-upset / missed / 1-upset pattern still
      // surfaces an upset signal without inflating the streak.
    }
  }

  return {
    totalDays,
    loggedDays,
    missedDays: totalDays - loggedDays,
    perfectCount,
    softStoolCount,
    upsetCount,
    maxConsecutiveUpset,
  };
}

/**
 * Derives the outcome card title/body/tone from a computed SwitchOutcome.
 * D-095 compliant: uses "digestive discomfort" as a body-function reference,
 * defers to vet, no diagnostic language, no "prevent/cure/treat/diagnose".
 *
 * Branches, in precedence order:
 *   1. Upsets reported (>=1)                         → caution
 *   2. No logs at all                                → neutral
 *   3. Limited data (loggedDays < totalDays / 2)     → neutral
 *   4. All logged days perfect, zero soft stool      → good
 *   5. Otherwise (perfect + some soft stool, no upset) → neutral
 */
export function getOutcomeMessage(
  outcome: SwitchOutcome,
  petName: string,
  newProductDisplay: string,
): OutcomeMessage {
  const { totalDays, loggedDays, upsetCount, softStoolCount, perfectCount } = outcome;

  const title = 'Switch Complete';
  const baseBody = `${petName} has fully transitioned to ${newProductDisplay}.`;

  // 1. Upsets — highest priority, caution tone
  if (upsetCount >= 1) {
    const dayWord = upsetCount === 1 ? 'day' : 'days';
    return {
      title,
      body: `${baseBody} You logged signs of digestive discomfort on ${upsetCount} ${dayWord}. If symptoms continue, consider checking in with ${petName}'s veterinarian.`,
      tone: 'caution',
    };
  }

  // 2. Zero logs across the whole transition
  if (loggedDays === 0) {
    return {
      title,
      body: `${baseBody} No tummy checks were logged during the transition.`,
      tone: 'neutral',
    };
  }

  // 3. Limited data — less than half the days logged
  if (loggedDays < totalDays / 2) {
    return {
      title,
      body: `${baseBody} Only ${loggedDays} of ${totalDays} days were logged — limited data on how the transition went.`,
      tone: 'neutral',
    };
  }

  // 4. All clean — every logged day was perfect
  if (perfectCount === loggedDays && softStoolCount === 0) {
    return {
      title,
      body: `${baseBody} No signs of digestive discomfort reported across the ${totalDays}-day transition.`,
      tone: 'good',
    };
  }

  // 5. Mostly smooth — some soft stool, no upset
  const softWord = softStoolCount === 1 ? 'day' : 'days';
  return {
    title,
    body: `${baseBody} ${softStoolCount} soft stool ${softWord} reported — common during transitions.`,
    tone: 'neutral',
  };
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
