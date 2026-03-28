/**
 * Atwater ME (metabolizable energy) estimation fallback.
 * Used when both kcal_per_cup and kcal_per_kg are missing but GA data exists.
 *
 * NRC Modified Atwater factors for pet food:
 *   Protein: 3.5 kcal/g, Fat: 8.5 kcal/g, Carbohydrate: 3.5 kcal/g
 *
 * Reference: NRC, 2006 — Nutrient Requirements of Dogs and Cats.
 */

import { Category } from '../types';
import type { Product } from '../types';

export type CalorieSource = 'label' | 'estimated' | null;

// NRC Modified Atwater factors (kcal per gram)
const PROTEIN_FACTOR = 3.5;
const FAT_FACTOR = 8.5;
const CARB_FACTOR = 3.5;

/**
 * Estimate kcal/kg from GA percentages using Modified Atwater.
 * All inputs are as-fed percentages.
 */
export function estimateKcalPerKg(
  proteinPct: number,
  fatPct: number,
  carbPct: number,
): number {
  // GA values are percentages (g per 100g), multiply by 10 to get per kg
  return (proteinPct * PROTEIN_FACTOR + fatPct * FAT_FACTOR + carbPct * CARB_FACTOR) * 10;
}

/**
 * Estimate as-fed carb% using NFE method (same as engine.ts estimateCarbDisplay).
 * Returns null if insufficient GA data.
 */
function estimateCarbPct(product: Product): number | null {
  if (
    product.ga_protein_pct == null ||
    product.ga_fat_pct == null ||
    product.ga_fiber_pct == null
  ) {
    return null;
  }

  const moisture = product.ga_moisture_pct ?? 10;

  // Ash estimation (as-fed)
  let ash: number;
  const hasCaP = product.ga_calcium_pct != null && product.ga_phosphorus_pct != null;
  if (hasCaP) {
    ash = (product.ga_calcium_pct! + product.ga_phosphorus_pct!) * 2.5;
  } else if (product.category === Category.Treat) {
    ash = 5.0;
  } else if (moisture > 12) {
    ash = 2.0;
  } else {
    ash = 7.0;
  }

  return Math.max(0, 100 - product.ga_protein_pct - product.ga_fat_pct - product.ga_fiber_pct - moisture - ash);
}

export interface CalorieEstimate {
  kcalPerKg: number;
  kcalPerUnit: number | null; // derived from kcalPerKg + unit_weight_g
  source: CalorieSource;
}

/**
 * Resolves calorie data using a priority fallback chain:
 * 1. Scraped kcal_per_kg (label) → derive kcal_per_unit from unit_weight_g
 * 2. Scraped kcal_per_cup (label) → derive kcal_per_kg via density
 * 3. Atwater estimation from GA macros (D-149) → source: 'estimated'
 * 4. null — no calorie data available
 * CalorieSource in the return ('label' | 'estimated' | null) indicates which path was used.
 */
export function resolveCalories(product: Product): CalorieEstimate | null {
  // Priority 1: scraped kcal_per_kg
  if (product.ga_kcal_per_kg != null && product.ga_kcal_per_kg > 0) {
    return {
      kcalPerKg: product.ga_kcal_per_kg,
      kcalPerUnit: product.kcal_per_unit ?? deriveKcalPerUnit(product.ga_kcal_per_kg, product.unit_weight_g),
      source: 'label',
    };
  }

  // Priority 2: scraped kcal_per_cup (label value, even without kcal_per_kg)
  if (product.ga_kcal_per_cup != null && product.ga_kcal_per_cup > 0) {
    // Approximate: 1 cup of kibble ≈ 100-120g, but we don't have density data.
    // Still label-sourced — PortionCard uses kcal_per_cup directly for cups/day.
    return {
      kcalPerKg: 0, // not derivable from cups alone without density
      kcalPerUnit: product.kcal_per_unit ?? null,
      source: 'label',
    };
  }

  // Priority 3: Atwater estimate from GA
  const carbPct = estimateCarbPct(product);
  if (
    carbPct != null &&
    product.ga_protein_pct != null &&
    product.ga_fat_pct != null
  ) {
    const kcalPerKg = Math.round(estimateKcalPerKg(
      product.ga_protein_pct,
      product.ga_fat_pct,
      carbPct,
    ));
    return {
      kcalPerKg,
      kcalPerUnit: deriveKcalPerUnit(kcalPerKg, product.unit_weight_g),
      source: 'estimated',
    };
  }

  return null;
}

function deriveKcalPerUnit(kcalPerKg: number, unitWeightG: number | null): number | null {
  if (unitWeightG == null || unitWeightG <= 0 || kcalPerKg <= 0) return null;
  return Math.round((kcalPerKg * unitWeightG) / 1000);
}

// ─── kcal/cup Resolution ────────────────────────────────

/** Standard dry kibble cup weight in grams (industry average 100-120g). */
const DRY_FOOD_GRAMS_PER_CUP = 110;

export interface KcalPerCupResult {
  kcalPerCup: number;
  isEstimated: boolean;
}

/**
 * Resolves kcal per cup using a priority fallback chain:
 * 1. Supabase ga_kcal_per_cup → source: label
 * 2. ga_kcal_per_kg + standard cup weight (dry food only) → source: estimated
 * 3. Atwater kcal/kg + standard cup weight (dry food only) → source: estimated
 * 4. null — can't determine kcal/cup
 */
export function resolveKcalPerCup(product: Product): KcalPerCupResult | null {
  // Priority 1: DB label value
  if (product.ga_kcal_per_cup != null && product.ga_kcal_per_cup > 0) {
    return { kcalPerCup: product.ga_kcal_per_cup, isEstimated: false };
  }

  // Priority 2+3: Estimate from kcal/kg (dry food only — cups don't apply to wet)
  const isDry = product.product_form === 'dry' || (product.ga_moisture_pct ?? 10) <= 14;
  if (!isDry) return null;

  // Try DB kcal/kg first
  if (product.ga_kcal_per_kg != null && product.ga_kcal_per_kg > 0) {
    return {
      kcalPerCup: Math.round((product.ga_kcal_per_kg / 1000) * DRY_FOOD_GRAMS_PER_CUP),
      isEstimated: true,
    };
  }

  // Try Atwater estimate
  const cal = resolveCalories(product);
  if (cal && cal.kcalPerKg > 0) {
    return {
      kcalPerCup: Math.round((cal.kcalPerKg / 1000) * DRY_FOOD_GRAMS_PER_CUP),
      isEstimated: true,
    };
  }

  return null;
}
