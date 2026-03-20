// Kiba — TypeScript Interfaces (Scoring-Only Subset)
// Trimmed for Edge Function use. Full types live in src/types/.

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

  // Product form
  product_form: string | null;

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
  is_pulse: boolean;                    // D-137 DCM pulse detection
  is_pulse_protein: boolean;            // D-137 Rule 3 (pulse protein isolates)
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

// ─── Pet Re-export ──────────────────────────────────────

export type { Pet as PetProfile } from './pet';
export type { PetCondition, PetAllergen } from './pet';
