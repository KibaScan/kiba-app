// Portion Calculator — Pure calculation functions for daily energy requirements.
// No Supabase, no side effects. Designed for M5 pantry import.
// See PORTION_CALCULATOR_SPEC.md for formulas and worked examples.
// Decisions: D-060 (RER), D-061 (goal weight), D-062 (hepatic guard),
//            D-063 (geriatric cat floor), D-064 (life stage derivation)

import type { LifeStage, Species, ActivityLevel } from '../types/pet';
import { getDerLifeStage } from '../utils/lifeStage';

// ─── Types ──────────────────────────────────────────────

type DerBucket = 'puppy' | 'adult' | 'senior' | 'geriatric';

interface DerMultiplierResult {
  multiplier: number;
  label: string;
  source: string;
}

interface DailyPortionResult {
  cups: number | null;
  grams: number | null;
}

interface GoalWeightResult {
  derKcal: number;
  multiplier: number;
  weeklyLossPercent: number;
  hepaticWarning: boolean;
}

// ─── Helpers ────────────────────────────────────────────

/** Convert pounds to kilograms. Raw float, no rounding. */
export function lbsToKg(lbs: number): number {
  return lbs / 2.205;
}

// ─── Core Functions ─────────────────────────────────────

/**
 * Resting Energy Requirement (D-060).
 * RER = 70 × (weight_kg) ^ 0.75
 * Same formula for dogs and cats.
 * Source: Merck Veterinary Manual, AAHA 2021.
 */
export function calculateRER(weightKg: number): number {
  if (weightKg <= 0) return 0;
  return Math.round(70 * Math.pow(weightKg, 0.75));
}

/**
 * DER multiplier lookup from locked tables (PORTION_CALCULATOR_SPEC.md §3).
 * Accepts 7-tier life stage (or null → adult fallback per spec §11).
 * Returns multiplier, human-readable label, and citation source.
 */
export function getDerMultiplier(params: {
  species: Species;
  lifeStage: LifeStage | null;
  isNeutered: boolean;
  activityLevel: ActivityLevel;
  ageMonths?: number;
  conditions?: string[];
}): DerMultiplierResult {
  const { species, isNeutered, conditions } = params;
  let { activityLevel } = params;

  // Map 7-tier → 4-bucket (null → adult fallback, spec §11)
  const bucket: DerBucket = params.lifeStage
    ? getDerLifeStage(params.lifeStage)
    : 'adult';

  // Edge: working dog + obesity → downgrade to moderate (spec §11)
  if (
    species === 'dog' &&
    activityLevel === 'working' &&
    conditions?.includes('obesity')
  ) {
    activityLevel = 'moderate';
  }

  // Edge: cats cannot be 'working' (UI hides it) — defensive fallback to high
  if (species === 'cat' && activityLevel === 'working') {
    activityLevel = 'high';
  }

  if (species === 'dog') {
    return getDogMultiplier(bucket, activityLevel, isNeutered, params.ageMonths);
  }
  return getCatMultiplier(bucket, activityLevel, isNeutered);
}

// ─── Dog Multiplier Table (LOCKED — AAHA 2021, NRC 2006, Laflamme 2005) ───

function getDogMultiplier(
  bucket: DerBucket,
  activity: ActivityLevel,
  isNeutered: boolean,
  ageMonths?: number,
): DerMultiplierResult {
  switch (bucket) {
    case 'puppy':
      // 4-month split: <4mo → 3.0×, 4+mo → 2.0× (NRC 2006)
      if (ageMonths !== undefined && ageMonths < 4) {
        return { multiplier: 3.0, label: 'Growing puppy (<4mo)', source: 'NRC 2006' };
      }
      return { multiplier: 2.0, label: 'Growing puppy', source: 'NRC 2006' };

    case 'adult':
      // Working dog (no obesity — obesity case already downgraded to moderate)
      if (activity === 'working') {
        return { multiplier: 3.0, label: 'Working dog', source: 'NRC 2006' };
      }
      return getDogAdultMultiplier(activity, isNeutered);

    case 'senior':
      if (activity === 'high' || activity === 'working') {
        return { multiplier: 1.4, label: 'Active senior', source: 'Laflamme 2005' };
      }
      return { multiplier: 1.2, label: 'Senior', source: 'Laflamme 2005' };

    case 'geriatric':
      return { multiplier: 1.2, label: 'Geriatric', source: 'Laflamme 2005' };
  }
}

function getDogAdultMultiplier(
  activity: ActivityLevel,
  isNeutered: boolean,
): DerMultiplierResult {
  const source = 'AAHA 2021';

  if (activity === 'low') {
    return isNeutered
      ? { multiplier: 1.2, label: 'Neutered, low activity', source }
      : { multiplier: 1.4, label: 'Intact, low activity', source };
  }
  if (activity === 'moderate') {
    return isNeutered
      ? { multiplier: 1.4, label: 'Neutered adult', source }
      : { multiplier: 1.6, label: 'Intact adult', source };
  }
  // high
  return isNeutered
    ? { multiplier: 1.6, label: 'Active neutered', source }
    : { multiplier: 1.8, label: 'Active intact', source };
}

// ─── Cat Multiplier Table (LOCKED — NRC 2006) ──────────

function getCatMultiplier(
  bucket: DerBucket,
  activity: ActivityLevel,
  isNeutered: boolean,
): DerMultiplierResult {
  const source = 'NRC 2006';

  switch (bucket) {
    case 'puppy':
      return { multiplier: 2.5, label: 'Growing kitten', source };

    case 'adult':
      return getCatAdultMultiplier(activity, isNeutered);

    case 'senior':
      return { multiplier: 1.1, label: 'Senior', source };

    case 'geriatric':
      // D-063: geriatric cats need MORE calories (1.5×), not fewer.
      // Sarcopenia + declining digestive efficiency.
      return { multiplier: 1.5, label: 'Geriatric', source: 'NRC 2006, Ch. 15' };
  }
}

function getCatAdultMultiplier(
  activity: ActivityLevel,
  isNeutered: boolean,
): DerMultiplierResult {
  const source = 'NRC 2006';

  if (activity === 'high') {
    // High activity cats: 1.6× regardless of neuter status
    return { multiplier: 1.6, label: 'Active cat', source };
  }
  if (activity === 'low') {
    return isNeutered
      ? { multiplier: 1.0, label: 'Indoor neutered', source }
      : { multiplier: 1.2, label: 'Intact, low activity', source };
  }
  // moderate
  return isNeutered
    ? { multiplier: 1.2, label: 'Neutered adult', source }
    : { multiplier: 1.4, label: 'Intact adult', source };
}

// ─── Portion Display ────────────────────────────────────

/**
 * Converts DER to cups/day and grams/day.
 * Returns null for each format when caloric data is unavailable.
 */
export function calculateDailyPortion(
  derKcal: number,
  kcalPerCup: number | null,
  kcalPerKg: number | null,
): DailyPortionResult {
  return {
    cups: kcalPerCup != null && kcalPerCup > 0 ? derKcal / kcalPerCup : null,
    grams: kcalPerKg != null && kcalPerKg > 0 ? (derKcal / kcalPerKg) * 1000 : null,
  };
}

// ─── Goal Weight Mode (D-061) + Hepatic Guard (D-062) ──

/**
 * Calculates DER at goal weight and checks for hepatic lipidosis risk.
 *
 * D-061: RER uses goal weight, not current — creates automatic caloric deficit/surplus.
 * D-062: For cats, if implied weekly loss exceeds 1% body weight, set hepaticWarning.
 * D-063: Geriatric cats always get at least 1.5× multiplier.
 *
 * Formula for hepatic guard (PORTION_CALCULATOR_SPEC.md §5):
 *   dailyDeficit = DER_at_current - DER_at_goal
 *   weeklyDeficit = dailyDeficit × 7
 *   impliedWeeklyLossLbs = weeklyDeficit / 3500
 *   weeklyLossPercent = (impliedWeeklyLossLbs / currentWeightLbs) × 100
 *   Trigger: weeklyLossPercent > 1.0 (exactly 1.0 does NOT trigger)
 */
export function calculateGoalWeightPortion(params: {
  currentWeightLbs: number;
  goalWeightLbs: number;
  species: Species;
  lifeStage: LifeStage | null;
  isNeutered: boolean;
  activityLevel: ActivityLevel;
  ageMonths?: number;
  conditions?: string[];
}): GoalWeightResult {
  const {
    currentWeightLbs,
    goalWeightLbs,
    species,
    lifeStage,
    isNeutered,
    activityLevel,
    ageMonths,
    conditions,
  } = params;

  // Get multiplier (same for both current and goal weight calculations)
  const { multiplier } = getDerMultiplier({
    species,
    lifeStage,
    isNeutered,
    activityLevel,
    ageMonths,
    conditions,
  });

  // DER at goal weight (D-061)
  const rerGoal = calculateRER(lbsToKg(goalWeightLbs));
  const derGoal = Math.round(rerGoal * multiplier);

  // DER at current weight (needed for hepatic guard deficit calculation)
  const rerCurrent = calculateRER(lbsToKg(currentWeightLbs));
  const derCurrent = Math.round(rerCurrent * multiplier);

  // Hepatic lipidosis guard (D-062, spec §5)
  const dailyDeficit = derCurrent - derGoal;
  const weeklyDeficit = dailyDeficit * 7;
  const impliedWeeklyLossLbs = weeklyDeficit / 3500;
  const weeklyLossPercent =
    currentWeightLbs > 0
      ? (impliedWeeklyLossLbs / currentWeightLbs) * 100
      : 0;

  // Only cats trigger the hepatic warning (>1.0%, not >=)
  const hepaticWarning = species === 'cat' && weeklyLossPercent > 1.0;

  return {
    derKcal: derGoal,
    multiplier,
    weeklyLossPercent,
    hepaticWarning,
  };
}
