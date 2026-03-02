// Kiba — Pure condition/allergen chip logic
// Extracted from HealthConditionsScreen for unit testing.
// Handles: Perfectly Healthy mutual exclusion, obesity/underweight disabled state,
// allergy→allergen visibility, save payload mapping.

import { HEALTHY_TAG } from '../data/conditions';

// ─── Types ───────────────────────────────────────────────

export interface SelectedAllergen {
  name: string;
  isCustom: boolean;
}

// ─── Condition Logic ─────────────────────────────────────

/**
 * Toggle a condition tag in the current selection.
 * Handles:
 * - "Perfectly Healthy" clears all other conditions
 * - Any condition clears "Perfectly Healthy"
 * - Obesity/underweight disabled-state guard (D-106): rejects toggle if disabled
 * - Regular toggle for everything else
 */
export function toggleCondition(
  current: string[],
  tag: string,
): string[] {
  // D-106: Reject toggling a disabled condition (logic-layer enforcement)
  if (isConditionDisabled(tag, current)) return current;

  // Tapping "Perfectly Healthy"
  if (tag === HEALTHY_TAG) {
    // If already selected, deselect it (back to empty)
    if (current.includes(HEALTHY_TAG)) return [];
    // Otherwise, clear everything and select only healthy
    return [HEALTHY_TAG];
  }

  // Tapping any condition chip
  let next = current.filter((t) => t !== HEALTHY_TAG); // remove healthy if present

  if (next.includes(tag)) {
    // Deselect this condition
    next = next.filter((t) => t !== tag);
  } else {
    // Select this condition
    next = [...next, tag];
  }

  return next;
}

/**
 * Returns true if a condition tag should be disabled.
 * Obesity disables underweight and vice versa (D-106).
 */
export function isConditionDisabled(
  tag: string,
  selectedConditions: string[],
): boolean {
  if (tag === 'underweight' && selectedConditions.includes('obesity')) return true;
  if (tag === 'obesity' && selectedConditions.includes('underweight')) return true;
  return false;
}

/**
 * Returns true if the allergen section should be visible.
 */
export function isAllergenSectionVisible(selectedConditions: string[]): boolean {
  return selectedConditions.includes('allergy');
}

// ─── Allergen Logic ──────────────────────────────────────

/**
 * Toggle a standard allergen in the current selection.
 */
export function toggleAllergen(
  current: SelectedAllergen[],
  name: string,
  isCustom: boolean,
): SelectedAllergen[] {
  const exists = current.some((a) => a.name === name);
  if (exists) {
    return current.filter((a) => a.name !== name);
  }
  return [...current, { name, isCustom }];
}

/**
 * Remove a specific allergen by name.
 */
export function removeAllergen(
  current: SelectedAllergen[],
  name: string,
): SelectedAllergen[] {
  return current.filter((a) => a.name !== name);
}

// ─── Save Payload ────────────────────────────────────────

/**
 * Map selected conditions to the array for savePetConditions().
 * Filters out the __healthy__ sentinel — empty array = "Perfectly Healthy" in DB.
 */
export function conditionsToSavePayload(selectedConditions: string[]): string[] {
  return selectedConditions.filter((t) => t !== HEALTHY_TAG);
}

/**
 * Map selected allergens to the array for savePetAllergens().
 */
export function allergensToSavePayload(
  selectedAllergens: SelectedAllergen[],
): { name: string; isCustom: boolean }[] {
  return selectedAllergens.map((a) => ({ name: a.name, isCustom: a.isCustom }));
}

// ─── Profile Completeness ────────────────────────────────

/**
 * Check if a pet profile has all fields needed for full score personalization.
 * Fields: name, species, breed, date_of_birth, weight, conditions (any save = done).
 */
export function isProfileComplete(pet: {
  name: string;
  species: string;
  breed: string | null;
  date_of_birth: string | null;
  weight_current_lbs: number | null;
}): boolean {
  return !!(
    pet.name &&
    pet.species &&
    pet.breed &&
    pet.date_of_birth &&
    pet.weight_current_lbs != null
  );
}
