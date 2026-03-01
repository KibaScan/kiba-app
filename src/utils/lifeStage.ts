// Life Stage Utilities — Pure Functions
// Derives 7-tier life stage from DOB/species/breedSize.
// See PET_PROFILE_SPEC.md §2 for age boundary tables.

import type { LifeStage, BreedSize } from '../types/pet';

// ─── Dog Thresholds (months) ──────────────────────────────
// [puppy_end, junior_end, adult_end, mature_end, senior_end]
// Values are exclusive upper bounds: age < threshold → that stage

const DOG_THRESHOLDS: Record<BreedSize, [number, number, number, number, number]> = {
  small:  [12, 24, 84, 120, 156],   // 12mo, 2yr, 7yr, 10yr, 13yr
  medium: [12, 24, 84, 120, 156],   // same as small
  large:  [12, 24, 72, 96,  132],   // 12mo, 2yr, 6yr, 8yr, 11yr
  giant:  [18, 24, 60, 96,  120],   // 18mo, 2yr, 5yr, 8yr, 10yr
};

// Cat thresholds (months) — single table for all cats
// [kitten_end, junior_end, adult_end, mature_end, senior_end]
const CAT_THRESHOLDS: [number, number, number, number, number] = [12, 24, 84, 132, 168];
// 12mo, 2yr, 7yr, 11yr, 14yr

/**
 * Derives 7-tier life stage from date of birth, species, and optional breed size.
 * Returns null if dateOfBirth is null (age unknown).
 * Defaults to 'medium' if breedSize is null for dogs.
 */
export function deriveLifeStage(
  dateOfBirth: Date | null,
  species: 'dog' | 'cat',
  breedSize?: BreedSize | null,
): LifeStage | null {
  if (!dateOfBirth) return null;

  const now = new Date();
  const ageMonths = monthsBetween(dateOfBirth, now);

  if (species === 'cat') {
    return catLifeStage(ageMonths);
  }

  const size = breedSize ?? 'medium';
  return dogLifeStage(ageMonths, size);
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function dogLifeStage(ageMonths: number, size: BreedSize): LifeStage {
  const [puppyEnd, juniorEnd, adultEnd, matureEnd, seniorEnd] = DOG_THRESHOLDS[size];

  if (ageMonths < puppyEnd) return 'puppy';
  if (ageMonths < juniorEnd) return 'junior';
  if (ageMonths < adultEnd) return 'adult';
  if (ageMonths < matureEnd) return 'mature';
  if (ageMonths < seniorEnd) return 'senior';
  return 'geriatric';
}

function catLifeStage(ageMonths: number): LifeStage {
  const [kittenEnd, juniorEnd, adultEnd, matureEnd, seniorEnd] = CAT_THRESHOLDS;

  if (ageMonths < kittenEnd) return 'kitten';
  if (ageMonths < juniorEnd) return 'junior';
  if (ageMonths < adultEnd) return 'adult';
  if (ageMonths < matureEnd) return 'mature';
  if (ageMonths < seniorEnd) return 'senior';
  return 'geriatric';
}

/**
 * Derives breed size from weight for mixed-breed / unknown-breed dogs.
 * PET_PROFILE_SPEC.md §2: <25 lbs = small, 25–55 = medium, 55–90 = large, >90 = giant.
 * Returns 'medium' if weight is null. Cats don't use breed size for life stage.
 */
export function deriveBreedSize(weightLbs: number | null): BreedSize {
  if (weightLbs == null) return 'medium';
  if (weightLbs < 25) return 'small';
  if (weightLbs <= 55) return 'medium';
  if (weightLbs <= 90) return 'large';
  return 'giant';
}

/**
 * D-116: Synthesize a DOB from approximate age inputs.
 * Returns: today - (years * 12 + months) months, pinned to 1st of month.
 */
export function synthesizeDob(years: number, months: number): Date {
  const now = new Date();
  const totalMonths = years * 12 + months;
  const result = new Date(now.getFullYear(), now.getMonth() - totalMonths, 1);
  return result;
}

/**
 * Maps 7-tier life stage → 4-bucket DER metabolic classification.
 * Used by portion calculator — distinct from resolveLifeStage() in engine.ts (AAFCO thresholds).
 *
 * - junior/mature → adult (no metabolic difference)
 * - puppy/kitten → puppy (growth multipliers)
 * - senior/geriatric → pass through (geriatric cats need special handling in DER)
 */
export function getDerLifeStage(
  lifeStage: LifeStage,
): 'puppy' | 'adult' | 'senior' | 'geriatric' {
  if (lifeStage === 'junior' || lifeStage === 'mature') return 'adult';
  if (lifeStage === 'puppy' || lifeStage === 'kitten') return 'puppy';
  return lifeStage; // 'senior' | 'geriatric' pass through
}
