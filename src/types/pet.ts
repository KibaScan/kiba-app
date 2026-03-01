// Kiba — M2 Pet Profile Types
// Canonical types matching the updated `pets` table schema.
// See PET_PROFILE_SPEC.md for field semantics.

// ─── Union Types ──────────────────────────────────────────

/** 7-value life stage system (D-064). Auto-derived, never user-entered. */
export type LifeStage =
  | 'puppy'
  | 'kitten'
  | 'junior'
  | 'adult'
  | 'mature'
  | 'senior'
  | 'geriatric';

export type BreedSize = 'small' | 'medium' | 'large' | 'giant';

export type ActivityLevel = 'low' | 'moderate' | 'high' | 'working';

export type Sex = 'male' | 'female';

export type Species = 'dog' | 'cat';

// ─── Pet Entity ───────────────────────────────────────────

/** Matches `pets` table after migration 002. */
export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: Species;
  breed: string | null;
  weight_current_lbs: number | null;
  weight_goal_lbs: number | null;
  weight_updated_at: string | null;
  date_of_birth: string | null;
  dob_is_approximate: boolean;
  activity_level: ActivityLevel;
  is_neutered: boolean;
  sex: Sex | null;
  photo_url: string | null;
  life_stage: LifeStage | null;
  breed_size: BreedSize | null;

  created_at: string;
  updated_at: string;
}

// ─── Related Entities ─────────────────────────────────────

export interface PetCondition {
  id: string;
  pet_id: string;
  condition_tag: string;
  created_at: string;
}

export interface PetAllergen {
  id: string;
  pet_id: string;
  allergen: string;
  is_custom: boolean;
  created_at: string;
}
