// Pantry Helpers — Pure functions for depletion math, calorie context, and defaults.
// No Supabase, no side effects.

import type {
  PantryPetAssignment,
  ServingMode,
  ServingSizeUnit,
  QuantityUnit,
  UnitLabel,
  CalorieContext,
  DepletionBreakdown,
} from '../types/pantry';
import type { Product } from '../types';
import type { Pet } from '../types/pet';
import { Category } from '../types';
import { resolveCalories } from './calorieEstimation';
import { lbsToKg, calculateRER, getDerMultiplier } from '../services/portionCalculator';

// ─── Internal Helpers ───────────────────────────────────

function convertToKg(qty: number, unit: QuantityUnit): number {
  switch (unit) {
    case 'kg': return qty;
    case 'g': return qty / 1000;
    case 'lbs': return qty / 2.205;
    case 'oz': return qty / 35.274;
    case 'units': return 0;
  }
}

function formatFraction(n: number): string {
  if (n === Math.floor(n)) return String(n);
  const whole = Math.floor(n);
  const frac = n - whole;
  if (Math.abs(frac - 0.25) < 0.05) return whole > 0 ? `${whole} 1/4` : '1/4';
  if (Math.abs(frac - 0.5) < 0.05) return whole > 0 ? `${whole} 1/2` : '1/2';
  if (Math.abs(frac - 0.75) < 0.05) return whole > 0 ? `${whole} 3/4` : '3/4';
  if (Math.abs(frac - 0.333) < 0.05) return whole > 0 ? `${whole} 1/3` : '1/3';
  if (Math.abs(frac - 0.667) < 0.05) return whole > 0 ? `${whole} 2/3` : '2/3';
  return n.toFixed(1);
}

/** Compute age in whole months from DOB string (YYYY-MM-DD). Inlined from PortionCard. */
function getAgeMonths(dateOfBirth: string | null): number | undefined {
  if (!dateOfBirth) return undefined;
  const parts = dateOfBirth.split('-');
  if (parts.length < 3) return undefined;
  const dob = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(dob.getTime())) return undefined;
  const ref = new Date();
  return (ref.getFullYear() - dob.getFullYear()) * 12 + (ref.getMonth() - dob.getMonth());
}

// ─── Exported Functions ─────────────────────────────────

/**
 * Estimate days until pantry item is depleted.
 * Unit mode: quantityRemaining / total daily unit consumption.
 * Weight mode: convert bag to cups via calorie density, then divide by daily cup consumption.
 */
export function calculateDaysRemaining(
  quantityRemaining: number,
  quantityUnit: QuantityUnit,
  servingMode: ServingMode,
  assignments: PantryPetAssignment[],
  kcalPerCup?: number | null,
  kcalPerKg?: number | null,
): number | null {
  const daily = assignments.filter(a => a.feeding_frequency === 'daily');
  if (daily.length === 0) return null;

  const dailyConsumption = daily.reduce(
    (sum, a) => sum + a.serving_size * a.feedings_per_day, 0,
  );
  if (dailyConsumption <= 0) return null;

  if (servingMode === 'unit') {
    return quantityRemaining / dailyConsumption;
  }

  // Weight mode: need both calorie values
  if (!kcalPerCup || !kcalPerKg || kcalPerCup <= 0 || kcalPerKg <= 0) return null;

  const qtyKg = convertToKg(quantityRemaining, quantityUnit);
  const totalCups = (qtyKg * kcalPerKg) / kcalPerCup;
  return totalCups / dailyConsumption;
}

export function isLowStock(
  daysRemaining: number | null,
  quantityRemaining: number,
  servingMode: ServingMode,
): boolean {
  if (servingMode === 'weight') {
    return daysRemaining != null && daysRemaining <= 5;
  }
  // Unit mode
  return quantityRemaining <= 5 || (daysRemaining != null && daysRemaining <= 5);
}

/**
 * Compute how many kcal the pet eats daily from this item vs their DER target.
 * Returns null if calorie data or pet weight is missing.
 */
export function getCalorieContext(
  product: Product,
  pet: Pet,
  servingSize: number,
  servingSizeUnit: ServingSizeUnit,
  feedingsPerDay: number,
): CalorieContext | null {
  const cal = resolveCalories(product);
  if (!cal) return null;
  if (pet.weight_current_lbs == null) return null;

  let dailyKcal: number;
  if ((servingSizeUnit === 'cups' || servingSizeUnit === 'scoops') && product.ga_kcal_per_cup) {
    dailyKcal = servingSize * feedingsPerDay * product.ga_kcal_per_cup;
  } else if (servingSizeUnit === 'units' && cal.kcalPerUnit) {
    dailyKcal = servingSize * feedingsPerDay * cal.kcalPerUnit;
  } else {
    return null;
  }

  const weightKg = lbsToKg(pet.weight_current_lbs);
  const rer = calculateRER(weightKg);
  const ageMonths = getAgeMonths(pet.date_of_birth);
  const { multiplier } = getDerMultiplier({
    species: pet.species,
    lifeStage: pet.life_stage,
    isNeutered: pet.is_neutered,
    activityLevel: pet.activity_level,
    ageMonths,
  });
  const targetKcal = Math.round(rer * multiplier);

  return {
    daily_kcal: Math.round(dailyKcal),
    target_kcal: targetKcal,
    source: cal.source,
  };
}

/**
 * System-recommended serving amount based on DER / product calorie density.
 * Uses goal weight DER if premium + pet has goal weight set.
 */
export function getSystemRecommendation(
  product: Product,
  pet: Pet,
  isPremiumGoalWeight: boolean,
): { amount: number; unit: ServingSizeUnit } | null {
  if (pet.weight_current_lbs == null) return null;

  const weightLbs = isPremiumGoalWeight && pet.weight_goal_lbs
    ? pet.weight_goal_lbs
    : pet.weight_current_lbs;

  const weightKg = lbsToKg(weightLbs);
  const rer = calculateRER(weightKg);
  const ageMonths = getAgeMonths(pet.date_of_birth);
  const { multiplier } = getDerMultiplier({
    species: pet.species,
    lifeStage: pet.life_stage,
    isNeutered: pet.is_neutered,
    activityLevel: pet.activity_level,
    ageMonths,
  });
  const der = Math.round(rer * multiplier);

  if (product.ga_kcal_per_cup && product.ga_kcal_per_cup > 0) {
    return { amount: der / product.ga_kcal_per_cup, unit: 'cups' };
  }

  const cal = resolveCalories(product);
  if (cal?.kcalPerUnit && cal.kcalPerUnit > 0) {
    return { amount: der / cal.kcalPerUnit, unit: 'units' };
  }

  return null;
}

/**
 * Human-readable depletion rate and estimated days remaining.
 * Returns null for treats (no depletion tracking).
 */
export function calculateDepletionBreakdown(
  servingSize: number,
  servingSizeUnit: ServingSizeUnit,
  feedingsPerDay: number,
  totalQuantity: number,
  quantityUnit: QuantityUnit,
  unitLabel: UnitLabel | null,
  product: Product,
): DepletionBreakdown | null {
  if (product.category === Category.Treat) return null;

  const dailyServings = servingSize * feedingsPerDay;

  if (quantityUnit === 'units') {
    // Unit mode — use dynamic unitLabel
    const singular = unitLabel === 'cans' ? 'can' : unitLabel === 'pouches' ? 'pouch' : 'unit';
    const plural = unitLabel ?? 'units';
    const labelStr = dailyServings <= 1 ? singular : plural;
    const rateText = `${formatFraction(dailyServings)} ${labelStr}/day`;
    const days = totalQuantity / dailyServings;
    return { rateText, daysText: `~${Math.floor(days)} days` };
  }

  // Weight mode
  const unitStr = dailyServings === 1
    ? servingSizeUnit.replace(/s$/, '')
    : servingSizeUnit;
  const rateText = `${formatFraction(dailyServings)} ${unitStr}/day`;

  const kcalPerCup = product.ga_kcal_per_cup;
  const kcalPerKg = product.ga_kcal_per_kg;
  if (kcalPerCup && kcalPerKg && kcalPerCup > 0 && kcalPerKg > 0) {
    const qtyKg = convertToKg(totalQuantity, quantityUnit);
    const totalCups = (qtyKg * kcalPerKg) / kcalPerCup;
    const days = totalCups / dailyServings;
    return { rateText, daysText: `~${Math.floor(days)} days` };
  }

  // Missing calorie data — rate only
  return { rateText, daysText: null };
}

export function defaultServingMode(productForm: string | null): ServingMode {
  switch (productForm) {
    case 'dry':
    case 'freeze_dried':
    case 'dehydrated':
    case 'raw':
      return 'weight';
    case 'wet':
      return 'unit';
    default:
      return 'weight';
  }
}
