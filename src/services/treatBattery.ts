// Treat Battery — Pure treat budget and per-day calculations.
// Consumes DER from portionCalculator.ts. No Supabase, no side effects.
// D-060: Treat budget = 10% of DER (veterinary standard).
// Spec: PORTION_CALCULATOR_SPEC.md §9.

// ─── Types ──────────────────────────────────────────────

interface TreatsPerDayResult {
  count: number;
  warning: boolean;
}

// ─── Functions ──────────────────────────────────────────

/**
 * 10% treat budget rule.
 * Returns the maximum daily treat calorie allowance.
 */
export function calculateTreatBudget(derKcal: number): number {
  return Math.round(derKcal * 0.1);
}

/**
 * How many treats fit within the budget.
 * count: floor (never recommend more than budget allows).
 * warning: true if a single treat exceeds the entire budget.
 */
export function calculateTreatsPerDay(
  treatBudgetKcal: number,
  kcalPerTreat: number,
): TreatsPerDayResult {
  if (kcalPerTreat <= 0) {
    return { count: 0, warning: false };
  }

  const count = Math.floor(treatBudgetKcal / kcalPerTreat);
  const warning = kcalPerTreat > treatBudgetKcal;

  return { count, warning };
}
