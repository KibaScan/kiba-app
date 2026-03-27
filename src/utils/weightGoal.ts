// Weight Goal — Pure functions for D-160 weight goal slider.
// Multiplier math, level availability, calorie context, weekly estimates.
// No side effects — all testable without mocking.

// ─── Constants ──────────────────────────────────────────

/** DER multiplier per weight goal level. D-160: 7 positions, -3 to +3. */
export const WEIGHT_GOAL_MULTIPLIERS: Record<number, number> = {
  [-3]: 0.80,
  [-2]: 0.90,
  [-1]: 0.95,
  [0]: 1.00,
  [1]: 1.05,
  [2]: 1.10,
  [3]: 1.20,
};

/** Display labels for each slider position. */
export const WEIGHT_GOAL_LABELS: Record<number, string> = {
  [-3]: 'Significant loss',
  [-2]: 'Moderate loss',
  [-1]: 'Gradual loss',
  [0]: 'Maintain',
  [1]: 'Gradual gain',
  [2]: 'Moderate gain',
  [3]: 'Significant gain',
};

/** All valid levels in order. */
export const ALL_LEVELS = [-3, -2, -1, 0, 1, 2, 3] as const;

/** Mixed-tissue kcal per lb for estimated weight change. D-161. */
export const KCAL_PER_LB: Record<string, number> = { dog: 3150, cat: 3000 };

// ─── Functions ──────────────────────────────────────────

/**
 * Apply weight goal multiplier to a base DER.
 * Returns rounded kcal. Level defaults to 0 (maintain) if null/undefined.
 */
export function getAdjustedDER(baseDER: number, weightGoalLevel: number | null | undefined): number {
  const level = weightGoalLevel ?? 0;
  const multiplier = WEIGHT_GOAL_MULTIPLIERS[level] ?? 1.0;
  return Math.round(baseDER * multiplier);
}

/**
 * Returns which slider levels are available for a given pet.
 * - Cats: -3 physically absent (D-062 hepatic lipidosis guard)
 * - Obesity condition: blocks gain (+1, +2, +3)
 * - Underweight condition: blocks loss (-1, -2, -3)
 */
export function getAvailableLevels(
  species: 'dog' | 'cat',
  conditions: string[],
): number[] {
  const blocked = new Set<number>();

  // Cat hepatic lipidosis guard — -3 structurally absent
  if (species === 'cat') {
    blocked.add(-3);
  }

  // Condition tags from conditionLogic.ts: 'obesity' and 'underweight'
  const isOverweight = conditions.includes('obesity');
  const isUnderweight = conditions.includes('underweight');

  if (isOverweight) {
    blocked.add(1);
    blocked.add(2);
    blocked.add(3);
  }

  if (isUnderweight) {
    blocked.add(-1);
    blocked.add(-2);
    blocked.add(-3);
  }

  return ALL_LEVELS.filter((level) => !blocked.has(level));
}

/**
 * Estimate weekly weight change at a given goal level.
 * Uses species-specific kcal/lb thresholds (D-161).
 */
export function estimateWeeklyChange(
  baseDER: number,
  adjustedDER: number,
  species: 'dog' | 'cat',
): { lbs: number; direction: 'loss' | 'gain' | 'maintain' } {
  const dailyDelta = adjustedDER - baseDER;

  if (dailyDelta === 0) return { lbs: 0, direction: 'maintain' };

  const threshold = KCAL_PER_LB[species] ?? 3150;
  const weeklyDelta = dailyDelta * 7;
  const weeklyLbs = Math.abs(weeklyDelta / threshold);

  return {
    lbs: Math.round(weeklyLbs * 10) / 10,
    direction: dailyDelta < 0 ? 'loss' : 'gain',
  };
}

/**
 * Get calorie context string data for a given level.
 * Returns adjusted kcal, percentage delta, and formatted label.
 */
export function getCalorieContext(
  baseDER: number,
  level: number | null | undefined,
): { kcal: number; pctDelta: number; label: string } {
  const adjustedKcal = getAdjustedDER(baseDER, level);
  const effectiveLevel = level ?? 0;
  const multiplier = WEIGHT_GOAL_MULTIPLIERS[effectiveLevel] ?? 1.0;
  const pctDelta = Math.round((multiplier - 1) * 100);

  let label: string;
  if (pctDelta === 0) {
    label = `~${adjustedKcal} kcal/day (maintenance)`;
  } else if (pctDelta < 0) {
    label = `~${adjustedKcal} kcal/day (${Math.abs(pctDelta)}% below maintenance)`;
  } else {
    label = `~${adjustedKcal} kcal/day (${pctDelta}% above maintenance)`;
  }

  return { kcal: adjustedKcal, pctDelta, label };
}

/**
 * Clamp a weight goal level to the nearest available level.
 * Used for auto-reset when a health condition conflict is added.
 * Returns 0 (Maintain) if current level is blocked.
 */
export function shouldClampLevel(
  level: number | null | undefined,
  species: 'dog' | 'cat',
  conditions: string[],
): number {
  const current = level ?? 0;
  const available = getAvailableLevels(species, conditions);

  if (available.includes(current)) return current;

  // Default to maintain when blocked
  return 0;
}
