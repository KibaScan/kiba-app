// PetHub — Pure helpers extracted from PetHubScreen.tsx
// These are exported and tested in __tests__/screens/PetHubScreen.test.ts

import type { Pet } from '../../types/pet';

// ─── Exported Pure Helpers (testable) ─────────────────────

/**
 * Score Accuracy: name 20% + species 20% + breed 15% + DOB 15% + weight 15% + conditions 15%.
 * `healthReviewed` is true when `pet.health_reviewed_at` is non-null.
 */
export function calculateScoreAccuracy(pet: Pet, healthReviewed: boolean): number {
  let score = 0;
  if (pet.name) score += 20;
  if (pet.species) score += 20;
  if (pet.breed) score += 15;
  if (pet.date_of_birth) score += 15;
  if (pet.weight_current_lbs != null) score += 15;
  if (healthReviewed) score += 15;
  return score;
}

/**
 * Months since weight_updated_at. Returns null if no weight timestamp set.
 */
export function getStaleWeightMonths(
  weightUpdatedAt: string | null,
  now?: Date,
): number | null {
  if (!weightUpdatedAt) return null;
  const updated = new Date(weightUpdatedAt);
  if (isNaN(updated.getTime())) return null;
  const ref = now ?? new Date();
  const months =
    (ref.getFullYear() - updated.getFullYear()) * 12 +
    (ref.getMonth() - updated.getMonth());
  return Math.max(0, months);
}

/**
 * Stale weight prompt message. Singular/plural "month(s)".
 */
export function formatStaleWeightMessage(months: number): string {
  const unit = months === 1 ? 'month' : 'months';
  return `Weight last updated ${months} ${unit} ago \u2014 still accurate?`;
}

export function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ACTIVITY_LABELS: Record<string, Record<string, string>> = {
  dog: { low: 'Low', moderate: 'Moderate', high: 'High', working: 'Working' },
  cat: { low: 'Indoor', moderate: 'Indoor-Outdoor', high: 'Outdoor' },
};
