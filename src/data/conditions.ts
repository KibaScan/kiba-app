// Kiba — M2 Static Condition & Allergen Data
// Species-filtered lists for HealthConditionsScreen chip grids.
// See D-097, D-098, D-106, D-119 for decision context.

import type { Species } from '../types/pet';

// ─── Types ───────────────────────────────────────────────

export interface ConditionDef {
  tag: string;    // DB value in pet_conditions.condition_tag (or __healthy__ sentinel)
  label: string;  // UI display label
  icon: string;   // Ionicons name
}

export interface AllergenDef {
  name: string;   // DB value in pet_allergens.allergen
  label: string;  // UI display label
}

// ─── Sentinel ────────────────────────────────────────────

/** Sentinel tag for "No known conditions" — never stored in DB. */
export const HEALTHY_TAG = '__healthy__';

// ─── Conditions ──────────────────────────────────────────

const SHARED_CONDITIONS: ConditionDef[] = [
  { tag: HEALTHY_TAG, label: 'No known conditions', icon: 'checkmark-circle-outline' },
  { tag: 'joint', label: 'Joint issues', icon: 'fitness-outline' },
  { tag: 'allergy', label: 'Food allergies', icon: 'alert-circle-outline' },
  { tag: 'gi_sensitive', label: 'Sensitive stomach', icon: 'medical-outline' },
  { tag: 'obesity', label: 'Overweight', icon: 'scale-outline' },
  { tag: 'underweight', label: 'Underweight', icon: 'trending-down-outline' },
  { tag: 'diabetes', label: 'Diabetes', icon: 'water-outline' },
  { tag: 'ckd', label: 'Kidney disease', icon: 'medkit-outline' },
  { tag: 'urinary', label: 'Urinary issues', icon: 'flask-outline' },
  { tag: 'cardiac', label: 'Heart disease', icon: 'heart-outline' },
  { tag: 'pancreatitis', label: 'Pancreatitis', icon: 'bandage-outline' },
  { tag: 'skin', label: 'Skin & coat issues', icon: 'leaf-outline' },
];

/** Dog-specific conditions (14 + No known conditions = 15 total). */
export const DOG_CONDITIONS: ConditionDef[] = [
  ...SHARED_CONDITIONS,
  { tag: 'hypothyroid', label: 'Hypothyroidism', icon: 'thermometer-outline' },
  { tag: 'liver', label: 'Liver disease', icon: 'pulse-outline' },
  { tag: 'seizures', label: 'Seizures / Epilepsy', icon: 'flash-outline' },
];

/** Cat-specific conditions (12 + No known conditions = 13 total). */
export const CAT_CONDITIONS: ConditionDef[] = [
  ...SHARED_CONDITIONS,
  { tag: 'hyperthyroid', label: 'Hyperthyroidism', icon: 'thermometer-outline' },
];

/** Returns the condition list for a given species. */
export function getConditionsForSpecies(species: Species): ConditionDef[] {
  return species === 'dog' ? DOG_CONDITIONS : CAT_CONDITIONS;
}

// ─── Allergens ───────────────────────────────────────────

/** Dog allergens — 13 standard entries (D-097, Mueller et al. 2016). */
export const DOG_ALLERGENS: AllergenDef[] = [
  { name: 'beef', label: 'Beef' },
  { name: 'chicken', label: 'Chicken' },
  { name: 'dairy', label: 'Dairy' },
  { name: 'wheat', label: 'Wheat' },
  { name: 'fish', label: 'Fish' },
  { name: 'lamb', label: 'Lamb' },
  { name: 'soy', label: 'Soy' },
  { name: 'egg', label: 'Egg' },
  { name: 'corn', label: 'Corn' },
  { name: 'pork', label: 'Pork' },
  { name: 'turkey', label: 'Turkey' },
  { name: 'rice', label: 'Rice' },
];

/** Cat allergens — 6 standard entries (D-097, Mueller et al. 2016). */
export const CAT_ALLERGENS: AllergenDef[] = [
  { name: 'beef', label: 'Beef' },
  { name: 'chicken', label: 'Chicken' },
  { name: 'dairy', label: 'Dairy' },
  { name: 'fish', label: 'Fish' },
  { name: 'lamb', label: 'Lamb' },
  { name: 'turkey', label: 'Turkey' },
];

/** Extended "Other" proteins — hardcoded list, NOT free text (D-097 safety). */
export const OTHER_ALLERGENS: AllergenDef[] = [
  { name: 'venison', label: 'Venison' },
  { name: 'rabbit', label: 'Rabbit' },
  { name: 'duck', label: 'Duck' },
  { name: 'bison', label: 'Bison' },
  { name: 'kangaroo', label: 'Kangaroo' },
  { name: 'quail', label: 'Quail' },
  { name: 'goat', label: 'Goat' },
  { name: 'pheasant', label: 'Pheasant' },
  { name: 'alligator', label: 'Alligator' },
  { name: 'salmon', label: 'Salmon' },
];

/** Returns the standard allergen list for a given species. */
export function getAllergensForSpecies(species: Species): AllergenDef[] {
  return species === 'dog' ? DOG_ALLERGENS : CAT_ALLERGENS;
}
