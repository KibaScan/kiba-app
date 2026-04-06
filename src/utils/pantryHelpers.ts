// Pantry Helpers — Pure functions for depletion math, calorie context, and defaults.
// Weight unit preference helpers are the one exception to "no side effects" — AsyncStorage read/write.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PantryPetAssignment,
  PantryCardData,
  PantryAnchor,
  ServingMode,
  ServingSizeUnit,
  QuantityUnit,
  UnitLabel,
  CalorieContext,
  DepletionBreakdown,
  BudgetWarning,
} from '../types/pantry';
import type { Product } from '../types';
import type { Pet } from '../types/pet';
import { Category } from '../types';
import { resolveCalories } from './calorieEstimation';
import { lbsToKg, calculateRER, getDerMultiplier } from '../services/portionCalculator';
import { getAdjustedDER as applyGoalLevel } from './weightGoal';

// ─── Internal Helpers ───────────────────────────────────

export function convertToKg(qty: number, unit: QuantityUnit): number {
  switch (unit) {
    case 'kg': return qty;
    case 'g': return qty / 1000;
    case 'lbs': return qty / 2.205;
    case 'oz': return qty / 35.274;
    case 'units': return 0;
  }
}

export function convertFromKg(kg: number, unit: QuantityUnit): number {
  switch (unit) {
    case 'kg': return kg;
    case 'g': return kg * 1000;
    case 'lbs': return kg * 2.205;
    case 'oz': return kg * 35.274;
    case 'units': return 0;
  }
}

// ─── Weight Unit Preference ──────────────────────────────
const WEIGHT_UNIT_KEY = '@kiba/weight_unit';

export async function getWeightUnitPref(): Promise<'lbs' | 'kg'> {
  const val = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
  return val === 'kg' ? 'kg' : 'lbs';
}

export async function setWeightUnitPref(unit: 'lbs' | 'kg'): Promise<void> {
  await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
}

export function convertWeightToCups(
  qty: number,
  unit: QuantityUnit,
  kcalPerKg: number | null | undefined,
  kcalPerCup: number | null | undefined,
): number | null {
  if (!kcalPerKg || !kcalPerCup || kcalPerKg <= 0 || kcalPerCup <= 0) return null;
  const kg = convertToKg(qty, unit);
  return (kg * kcalPerKg) / kcalPerCup;
}

export function convertWeightToServings(
  qty: number,
  unit: QuantityUnit,
  kcalPerKg: number | null | undefined,
  kcalPerCup: number | null | undefined,
  cupsPerFeeding: number,
): number | null {
  const cups = convertWeightToCups(qty, unit, kcalPerKg, kcalPerCup);
  if (cups == null || cupsPerFeeding <= 0) return null;
  return cups / cupsPerFeeding;
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

// ─── D-165: Budget-Aware Helpers ────────────────────────

/**
 * Single source of DER for a pet. Extracts duplicated logic from
 * getSystemRecommendation and getCalorieContext.
 * D-160: When weightGoalLevel is provided, applies the goal multiplier on top.
 */
export function computePetDer(
  pet: Pet,
  isPremiumGoalWeight: boolean,
  weightGoalLevel?: number | null,
): number | null {
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
  const baseDer = Math.round(rer * multiplier);

  // D-160: Apply weight goal level adjustment
  if (weightGoalLevel != null && weightGoalLevel !== 0) {
    return applyGoalLevel(baseDer, weightGoalLevel);
  }
  return baseDer;
}

/**
 * Sum daily kcal from active pantry items assigned to this pet.
 * Only counts daily-frequency, non-empty items with calorie data.
 */
export function computeExistingPantryKcal(
  items: PantryCardData[],
  petId: string,
  excludeItemId?: string,
): number {
  let total = 0;
  for (const item of items) {
    if (excludeItemId && item.id === excludeItemId) continue;
    if (!item.calorie_context) continue;
    if (item.is_empty) continue;
    if (item.product.category === 'treat') continue;
    const hasDaily = item.assignments.some(
      a => a.pet_id === petId && a.feeding_frequency === 'daily',
    );
    if (!hasDaily) continue;
    total += item.calorie_context.daily_kcal;
  }
  return total;
}

/**
 * D-165: Budget-aware auto-serving calculation.
 * Divides remaining calorie budget by feedings/day, then converts to
 * the best available unit: cups (if kcal_per_cup), grams (if kcal_per_kg),
 * or servings (if kcal_per_unit). Returns null if no calorie data exists.
 */
export function computeAutoServingSize(
  remainingBudgetKcal: number,
  feedingsPerDay: number,
  product: Product,
): { amount: number; unit: ServingSizeUnit } | null {
  if (feedingsPerDay <= 0) return null;
  const perFeedingKcal = remainingBudgetKcal / feedingsPerDay;

  if (product.ga_kcal_per_cup && product.ga_kcal_per_cup > 0) {
    return { amount: perFeedingKcal / product.ga_kcal_per_cup, unit: 'cups' };
  }

  const cal = resolveCalories(product);
  if (cal?.kcalPerUnit && cal.kcalPerUnit > 0) {
    return { amount: perFeedingKcal / cal.kcalPerUnit, unit: 'units' };
  }

  return null;
}

/**
 * Budget warning for manual mode. Anchored to maintenance DER (slider level 0).
 * Today maintenanceDer === adjustedDer since D-160 is not implemented yet.
 */
export function computeBudgetWarning(params: {
  servingSize: number;
  servingSizeUnit: ServingSizeUnit;
  feedingsPerDay: number;
  product: Product;
  maintenanceDer: number;
  adjustedDer: number;
  existingPantryKcal: number;
  petName: string;
  isTreat: boolean;
}): BudgetWarning | null {
  if (params.isTreat) return null;

  const cal = resolveCalories(params.product);
  if (!cal) return null;

  let thisItemKcal: number;
  if ((params.servingSizeUnit === 'cups' || params.servingSizeUnit === 'scoops') && params.product.ga_kcal_per_cup) {
    thisItemKcal = params.servingSize * params.feedingsPerDay * params.product.ga_kcal_per_cup;
  } else if (params.servingSizeUnit === 'units' && cal.kcalPerUnit) {
    thisItemKcal = params.servingSize * params.feedingsPerDay * cal.kcalPerUnit;
  } else {
    return null;
  }

  const totalAfterAdd = params.existingPantryKcal + thisItemKcal;
  const pctOfMaintenance = Math.round((totalAfterAdd / params.maintenanceDer) * 100);

  if (pctOfMaintenance > 120) {
    return {
      level: 'significantly_over',
      message: `${params.petName}'s daily intake from pantry items would be ${pctOfMaintenance}% of the ${params.maintenanceDer} kcal maintenance target.`,
      pct: pctOfMaintenance,
    };
  }
  if (pctOfMaintenance > 100) {
    return {
      level: 'over',
      message: `${params.petName}'s pantry items total ~${Math.round(totalAfterAdd)} kcal/day, ${pctOfMaintenance}% of the ${params.maintenanceDer} kcal maintenance target.`,
      pct: pctOfMaintenance,
    };
  }

  const pctOfAdjusted = Math.round((totalAfterAdd / params.adjustedDer) * 100);
  if (pctOfAdjusted < 80) {
    return {
      level: 'under',
      message: `${params.petName}'s pantry items cover ~${pctOfAdjusted}% of daily calorie needs.`,
      pct: pctOfAdjusted,
    };
  }

  return null;
}

/**
 * Condition → recommended feedings per day mapping.
 * Conditions that benefit from smaller, more frequent meals return 3+.
 * Returns null when no condition requires a non-default frequency.
 *
 * Clinical rationale (all from standard vet nutrition references):
 *   pancreatitis — smaller meals reduce pancreatic enzyme load per feeding
 *   gi_sensitive  — easier digestion, reduced GI distension
 *   ckd           — reduce phosphorus load per meal, manage nausea
 *   liver         — reduce hepatic processing load (dogs only, but tag is dog-only)
 *   diabetes      — steadier glucose curves with smaller meals
 *   obesity       — satiety maintenance, reduce gorging
 *   underweight   — more feeding opportunities to increase total intake
 */
const CONDITION_FEEDINGS: Record<string, number> = {
  pancreatitis: 3,
  gi_sensitive: 3,
  ckd: 3,
  liver: 4,
  diabetes: 3,
  obesity: 3,
  underweight: 3,
};

/**
 * Returns the recommended feedings_per_day based on conditions, or null
 * if no condition warrants a non-default frequency.
 * When multiple conditions are present, the highest recommendation wins.
 */
export function getConditionFeedingsPerDay(conditions: string[]): number | null {
  let max = 0;
  for (const c of conditions) {
    const rec = CONDITION_FEEDINGS[c];
    if (rec != null && rec > max) max = rec;
  }
  return max > 0 ? max : null;
}

/** Human-readable condition labels for feeding advisory display. */
const CONDITION_LABELS: Record<string, string> = {
  pancreatitis: 'pancreatitis',
  gi_sensitive: 'sensitive digestion',
  ckd: 'kidney health',
  liver: 'liver health',
  diabetes: 'diabetes',
  obesity: 'weight management',
  underweight: 'weight gain',
};

/**
 * Returns a feeding frequency advisory string for PortionCard display,
 * or null if no condition warrants special frequency.
 * D-095 compliant: factual observation, not a directive.
 */
export function getConditionFeedingAdvisory(conditions: string[]): {
  mealsPerDay: number;
  reason: string;
} | null {
  let maxMeals = 0;
  let reason = '';
  for (const c of conditions) {
    const rec = CONDITION_FEEDINGS[c];
    if (rec != null && rec > maxMeals) {
      maxMeals = rec;
      reason = CONDITION_LABELS[c] ?? c;
    }
  }
  return maxMeals > 0 ? { mealsPerDay: maxMeals, reason } : null;
}

/**
 * Smart default feedings per day. Priority:
 *   1. Treats → always 1
 *   2. Adding second daily food → 1 (splitting existing meals)
 *   3. Health condition recommendation (highest across all conditions)
 *   4. Fallback → 2
 */
export function getSmartDefaultFeedingsPerDay(
  category: Category,
  pantryItems: PantryCardData[],
  petId: string,
  conditions?: string[],
): number {
  if (category === Category.Treat) return 1;
  const hasDailyFood = pantryItems.some(item =>
    item.product.category === 'daily_food'
    && !item.is_empty
    && item.assignments.some(a => a.pet_id === petId && a.feeding_frequency === 'daily'),
  );
  if (hasDailyFood) return 1;
  const conditionRec = conditions ? getConditionFeedingsPerDay(conditions) : null;
  return conditionRec ?? 2;
}

/**
 * Parse product name for bag/pack size. Best-effort regex extraction.
 * Returns null if no recognizable pattern found.
 */
export function parseProductSize(
  name: string,
): { quantity: number; unit: QuantityUnit } | null {
  // Weight patterns (most specific first)
  const lbMatch = name.match(/(\d+\.?\d*)\s*-?\s*(?:lb|lbs|pound|pounds)\b/i);
  if (lbMatch) return { quantity: parseFloat(lbMatch[1]), unit: 'lbs' };

  const ozMatch = name.match(/(\d+\.?\d*)\s*-?\s*(?:oz|ounce|ounces)\b/i);
  if (ozMatch) return { quantity: parseFloat(ozMatch[1]), unit: 'oz' };

  const kgMatch = name.match(/(\d+\.?\d*)\s*-?\s*(?:kg|kilogram|kilograms)\b/i);
  if (kgMatch) return { quantity: parseFloat(kgMatch[1]), unit: 'kg' };

  // 'g' needs word boundary before number to avoid matching "dog", "bag", etc.
  const gMatch = name.match(/\b(\d+\.?\d*)\s*-?\s*(?:gram|grams)\b/i);
  if (gMatch) return { quantity: parseFloat(gMatch[1]), unit: 'g' };

  // Count patterns
  const countMatch = name.match(/(\d+)\s*-?\s*(?:pack|count|ct|pk)\b/i);
  if (countMatch) return { quantity: parseInt(countMatch[1], 10), unit: 'units' };

  return null;
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

  // D-160: Use computePetDer which respects weight_goal_level
  const targetKcal = computePetDer(pet, false, pet.weight_goal_level) ?? 0;

  return {
    daily_kcal: Math.round(dailyKcal),
    target_kcal: targetKcal,
    source: cal.source,
  };
}

/**
 * System-recommended serving amount based on full DER / product calorie density.
 * Returns total daily amount (not per-feeding). Uses computePetDer internally.
 */
export function getSystemRecommendation(
  product: Product,
  pet: Pet,
  isPremiumGoalWeight: boolean,
): { amount: number; unit: ServingSizeUnit } | null {
  const der = computePetDer(pet, isPremiumGoalWeight);
  if (der == null) return null;

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
    // Unit mode — show "cups" if product has cup data (dry food), otherwise "servings"
    const useCups = product.ga_kcal_per_cup != null && product.ga_kcal_per_cup > 0;
    const labelStr = useCups
      ? (dailyServings <= 1 ? 'cup' : 'cups')
      : (dailyServings <= 1 ? 'serving' : 'servings');
    const rateText = `${formatFraction(dailyServings)} ${labelStr}/day`;
    const days = totalQuantity / dailyServings;
    return { rateText, daysText: `~${Math.floor(days)} days` };
  }

  // Weight mode
  const unitStr = dailyServings === 1
    ? servingSizeUnit.replace(/s$/, '')
    : servingSizeUnit;
  const rateText = `${formatFraction(dailyServings)} ${unitStr}/day`;

  const totalCups = convertWeightToCups(totalQuantity, quantityUnit, product.ga_kcal_per_kg, product.ga_kcal_per_cup);
  if (totalCups != null) {
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

// ─── Safe Switch slot resolution (M9 Phase B) ───────────

/**
 * Picks the pantry anchor (slot) that a Safe Switch should replace.
 *
 * Rules (in priority order):
 *   1. Zero anchors → null (caller should hide the "Switch to this" CTA).
 *   2. One anchor → that anchor.
 *   3. Multiple anchors:
 *      a. Prefer exact product_form match (dry↔dry, wet↔wet). If newProductForm
 *         is null, no form preference is applied.
 *      b. Tie-break by lowest resolvedScore (most urgent to replace).
 *      c. Final tie-break: prefer slot 0 (primary) over slot 1 (secondary).
 *         Grandfathered null slots sort last via `?? 99`.
 *
 * Pure, side-effect free. Used by ResultScreen at tap time.
 */
export function pickSlotForSwap(
  anchors: PantryAnchor[],
  newProductForm: string | null,
): PantryAnchor | null {
  if (anchors.length === 0) return null;
  if (anchors.length === 1) return anchors[0];

  // 3a: exact form match preferred
  const formMatches = newProductForm
    ? anchors.filter(a => a.productForm === newProductForm)
    : [];
  const candidates = formMatches.length > 0 ? formMatches : anchors;

  // 3b + 3c: lowest score wins, then slot 0 beats slot 1
  const sorted = [...candidates].sort((a, b) => {
    const sa = a.resolvedScore ?? 100;
    const sb = b.resolvedScore ?? 100;
    if (sa !== sb) return sa - sb;
    return (a.slotIndex ?? 99) - (b.slotIndex ?? 99);
  });
  return sorted[0];
}

// ─── M9 Phase C: Meal-Based Allocation Helpers ──────────

/**
 * Computes the per-meal serving size based on how many meals this food covers.
 * Returns null if kcal data is missing.
 */
export function computeMealBasedServing(
  pet: Pet,
  product: Product,
  mealsThisFoodCovers: number,
  totalMealsPerDay: number,
  isPremiumGoalWeight: boolean,
  weightGoalLevel?: number | null,
): { amount: number; unit: ServingSizeUnit; dailyKcal: number } | null {
  if (totalMealsPerDay <= 0 || mealsThisFoodCovers <= 0) return null;
  const der = computePetDer(pet, isPremiumGoalWeight, weightGoalLevel);
  if (der == null) return null;

  const derAllocation = mealsThisFoodCovers / totalMealsPerDay;
  const dailyKcal = der * derAllocation;

  if (product.ga_kcal_per_cup && product.ga_kcal_per_cup > 0) {
    const totalDailyCups = dailyKcal / product.ga_kcal_per_cup;
    return { amount: totalDailyCups / mealsThisFoodCovers, unit: 'cups', dailyKcal };
  }

  const cal = resolveCalories(product);
  if (cal?.kcalPerUnit && cal.kcalPerUnit > 0) {
    const totalDailyUnits = dailyKcal / cal.kcalPerUnit;
    return { amount: totalDailyUnits / mealsThisFoodCovers, unit: 'units', dailyKcal };
  }

  return null;
}

export function getDefaultMealsCovered(
  dailyFoodCount: number,
  totalMealsPerDay: number,
): number {
  if (dailyFoodCount === 0) return totalMealsPerDay;
  return 1;
}

export function computeRebalancedMeals(
  totalMealsPerDay: number,
  newFoodMeals: number,
): number {
  const adjusted = totalMealsPerDay - newFoodMeals;
  if (adjusted <= 0) return 1;
  if (adjusted > totalMealsPerDay) return totalMealsPerDay;
  return adjusted;
}

// Fixed standard conversions for dry food volume.
// 1 standard measuring cup of dry kibble = ~4 oz = ~113.4 g
const DRY_CUP_TO_OZ_RATIO = 4.0;
const DRY_CUP_TO_G_RATIO = 113.4;

export function computeServingConversions(
  cupsPerMeal: number,
): { oz: number; g: number } {
  return {
    oz: cupsPerMeal * DRY_CUP_TO_OZ_RATIO,
    g: cupsPerMeal * DRY_CUP_TO_G_RATIO,
  };
}
