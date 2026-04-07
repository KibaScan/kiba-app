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

export type FeedingStyle = 'dry_only' | 'dry_and_wet' | 'wet_only' | 'custom';

// ─── Pet Entity ───────────────────────────────────────────

/** Matches `pets` table after migration 022. */
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
  health_reviewed_at: string | null;

  // D-160: Weight goal slider (-3 to +3)
  weight_goal_level: number | null;
  // D-161: Caloric accumulator for estimated weight tracking
  caloric_accumulator: number | null;
  accumulator_last_reset_at: string | null;
  accumulator_notification_sent: boolean | null;
  // D-162: BCS self-assessment (owner-reported, educational only)
  bcs_score: number | null;
  bcs_assessed_at: string | null;

  // Behavioral Feeding Base Setup
  feeding_style: FeedingStyle;
  wet_reserve_kcal: number;
  wet_reserve_source: string | null;

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

/** Structured condition detail — adds sub-type/severity on top of pet_conditions tag list. */
export interface PetConditionDetail {
  id: string;
  pet_id: string;
  condition: string;
  sub_type: string | null;
  severity: 'mild' | 'moderate' | 'severe';
  diagnosed_at: string | null;
  notes: string | null;
  created_at: string;
}

/** Medication tracking — display-only, does NOT influence scoring. */
export interface PetMedication {
  id: string;
  pet_id: string;
  medication_name: string;
  status: 'current' | 'past' | 'as_needed';
  dosage: string | null;
  started_at: string | null;
  ended_at: string | null;
  prescribed_for: string | null;
  reminder_times: string[];  // ["08:00", "18:00"] — max 4
  duration_days: number | null;  // null = ongoing
  notes: string | null;
  created_at: string;
}
