// Kiba — TypeScript Interfaces
// All core entities. Zero `any` types.

import type { IngredientSeverity } from './scoring';

// ─── Enums ──────────────────────────────────────────────

export enum Species {
  Dog = 'dog',
  Cat = 'cat',
}

export enum LifeStage {
  Puppy = 'puppy',
  Kitten = 'kitten',
  Junior = 'junior',
  Adult = 'adult',
  Mature = 'mature',
  Senior = 'senior',
  Geriatric = 'geriatric',
}

export enum Category {
  DailyFood = 'daily_food',
  Treat = 'treat',
  Supplement = 'supplement',
}

export enum Severity {
  None = 'none',
  Low = 'low',
  Moderate = 'moderate',
  High = 'high',
  Critical = 'critical',
}

export enum ConfidenceLevel {
  Exact = 'exact',
  Estimated = 'estimated',
  Unknown = 'unknown',
}

export enum SymptomType {
  Vomiting = 'vomiting',
  Diarrhea = 'diarrhea',
  Itching = 'itching',
  Lethargy = 'lethargy',
  Refusal = 'refusal',
}

export enum PreservativeType {
  Natural = 'natural',
  Synthetic = 'synthetic',
  Mixed = 'mixed',
  Unknown = 'unknown',
}

export type ProductSource = 'scraped' | 'community' | 'curated';
export type ServingFormat = 'bulk' | 'unit_count' | 'cans';
export type NutritionalDataSource = 'manual' | 'llm_extracted';

// ─── Product Entities ───────────────────────────────────

export interface Product {
  id: string;
  brand: string;
  name: string;
  category: Category;
  target_species: Species;
  source: ProductSource;

  // Formulation
  aafco_statement: string | null;
  life_stage_claim: string | null;
  preservative_type: PreservativeType | null;

  // Guaranteed Analysis — core macros
  ga_protein_pct: number | null;
  ga_fat_pct: number | null;
  ga_fiber_pct: number | null;
  ga_moisture_pct: number | null;
  ga_calcium_pct: number | null;
  ga_phosphorus_pct: number | null;

  // Guaranteed Analysis — calorie info
  ga_kcal_per_cup: number | null;
  ga_kcal_per_kg: number | null;
  kcal_per_unit: number | null;
  unit_weight_g: number | null;
  default_serving_format: ServingFormat | null;

  // Guaranteed Analysis — bonus/supplemental nutrients
  ga_taurine_pct: number | null;
  ga_l_carnitine_mg: number | null;
  ga_dha_pct: number | null;
  ga_omega3_pct: number | null;
  ga_omega6_pct: number | null;
  ga_zinc_mg_kg: number | null;
  ga_probiotics_cfu: string | null;

  // Data provenance
  nutritional_data_source: NutritionalDataSource | null;
  ingredients_raw: string | null;
  ingredients_hash: string | null;

  // Image (D-093 — gradient edge fade on scan result screen)
  image_url: string | null;

  // Flags
  is_recalled: boolean;
  is_grain_free: boolean;
  is_supplemental: boolean;
  is_vet_diet: boolean;
  score_confidence: string;
  needs_review: boolean;

  // Batch scoring
  base_score: number | null;
  base_score_computed_at: string | null;

  // Tracking
  last_verified_at: string | null;
  formula_change_log: Array<{
    detected_at: string;
    old_ingredients_preview: string;
    new_ingredients_preview: string;
  }> | null;
  affiliate_links: Record<string, string> | null;

  created_at: string;
  updated_at: string;
}

export interface ProductUpc {
  upc: string;
  product_id: string;
}

export interface IngredientDict {
  id: string;
  canonical_name: string;
  cluster_id: string | null;

  // D-098: allergen mapping
  allergen_group: string | null;
  allergen_group_possible: string[];

  // Severity per species — 4-level scale matching DB CHECK constraint
  dog_base_severity: IngredientSeverity;
  cat_base_severity: IngredientSeverity;

  // Scoring flags
  is_unnamed_species: boolean;
  is_legume: boolean;
  position_reduction_eligible: boolean;
  cat_carb_flag: boolean;

  // D-105: display content columns
  display_name: string | null;
  definition: string | null;
  tldr: string | null;
  detail_body: string | null;
  citations_display: string | null;
  position_context: string | null;

  created_at: string;
}

export interface ProductIngredientRow {
  product_id: string;
  ingredient_id: string;
  position: number;
}

// ─── Pet Entities ───────────────────────────────────────
// Canonical M2 types live in ./pet.ts — re-exported here for backwards compatibility

export type { Pet as PetProfile } from './pet';
export type { PetCondition, PetAllergen } from './pet';

// ─── Scan & Score Entities ──────────────────────────────

export interface LayerOneBreakdown {
  ingredient_quality_score: number;
  ingredient_quality_weight: number;
  nutritional_profile_score: number;
  nutritional_profile_weight: number;
  formulation_score: number;
  formulation_weight: number;
  base_score: number;
}

export interface LayerTwoBreakdown {
  species_rules_applied: string[];
  total_adjustment: number;
}

export interface LayerThreeBreakdown {
  allergy_flags: string[];
  life_stage_match: boolean;
  breed_modifiers: string[];
  total_adjustment: number;
}

export interface ScoreBreakdown {
  final_score: number;
  layer_one: LayerOneBreakdown;
  layer_two: LayerTwoBreakdown;
  layer_three: LayerThreeBreakdown;
  ga_available: boolean;
  dmb_applied: boolean;
  confidence: ConfidenceLevel;
}

export interface ScanRecord {
  id: string;
  user_id: string;
  pet_id: string;
  product_id: string;
  score_breakdown: ScoreBreakdown;
  scanned_at: string;
}

// ─── Pantry & Logging ───────────────────────────────────

export interface PantryItem {
  id: string;
  user_id: string;
  pet_id: string;
  product_id: string;
  serving_format: string | null;
  pack_size: string | null;
  added_at: string;
}

export interface SymptomLog {
  id: string;
  user_id: string;
  pet_id: string;
  product_id: string | null;
  symptom_type: SymptomType;
  severity: Severity;
  notes: string | null;
  logged_at: string;
}

export interface KibaIndexVote {
  id: string;
  user_id: string;
  pet_id: string;
  product_id: string;
  taste_score: number; // 1-5
  tummy_score: number; // 1-5
  voted_at: string;
}

// ─── App State Types ────────────────────────────────────

export interface OnboardingPetInput {
  name: string;
  species: Species;
}
