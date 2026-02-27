// Kiba — Scoring Engine Types
// Type-safe contracts between all scoring layers.
// Zero `any` types. All layers independently testable.

// ─── Shared Types ───────────────────────────────────────

/** Severity levels matching DB CHECK constraint — 4 levels, not the 5-level Severity enum */
export type IngredientSeverity = 'danger' | 'caution' | 'neutral' | 'good';

/** Hydrated ingredient — input to all scoring layers that handle ingredients.
 *  Built by joining product_ingredients + ingredients_dict at scan time. */
export interface ProductIngredient {
  position: number;
  canonical_name: string;
  dog_base_severity: IngredientSeverity;
  cat_base_severity: IngredientSeverity;
  is_unnamed_species: boolean;
  is_legume: boolean;
  position_reduction_eligible: boolean;
  cluster_id: string | null;
  cat_carb_flag: boolean;
  allergen_group: string | null;           // D-098 cross-reactivity
  allergen_group_possible: string[];       // D-098 unnamed terms
  is_protein_fat_source: boolean;          // Layer 1c protein naming denominator
}

// ─── Breed & Modifier Types ─────────────────────────────

export type BreedSize = 'small' | 'medium' | 'large' | 'giant';

/** A scoring modifier applied by life stage or breed logic */
export interface Modifier {
  name: string;
  points: number;
  target: 'protein' | 'fat' | 'fiber' | 'carbs' | 'bucket';
  reason: string;
  citationSource: string;
}

// ─── Layer Output Contracts ─────────────────────────────

/** Individual penalty applied to an ingredient */
export interface Penalty {
  ingredientName: string;
  reason: string;
  rawPenalty: number;
  positionAdjustedPenalty: number;
  position: number;
  citationSource: string;
}

/** Layer 1a — Ingredient Quality bucket output */
export interface IngredientScoreResult {
  ingredientScore: number;        // 0-100
  penalties: Penalty[];
  flags: string[];                // non-scoring signals (e.g. 'ingredient_splitting_detected')
  unnamedSpeciesCount: number;
}

/** Layer 1b — Nutritional Profile bucket output */
export interface NutritionScoreResult {
  bucketScore: number;                  // 0-100
  subScores: {
    protein: number;
    fat: number;
    fiber: number;
    carbs: number;
  };
  modifiersApplied: Modifier[];
  dataQuality: 'full' | 'partial' | 'missing';
  missingFields: string[];
  llmExtracted: boolean;
}

/** Layer 1c — Formulation Completeness bucket output */
export interface FormulationScoreResult {
  formulationScore: number;      // 0-100 weighted composite
  breakdown: {
    aafcoScore: number;          // 0-100
    preservativeScore: number;   // 0-100
    proteinNamingScore: number;  // 0-100
  };
  flags: string[];
}

/** A species rule that was evaluated */
export interface AppliedRule {
  ruleId: string;
  label: string;
  adjustment: number;
  fired: boolean;
  citation?: string;
}

/** Layer 2 — Species Rules output */
export interface SpeciesRuleResult {
  adjustedScore: number;
  rules: AppliedRule[];
}

/** A single personalization adjustment or flag */
export interface PersonalizationDetail {
  type: 'allergen' | 'life_stage' | 'breed' | 'condition' | 'breed_contraindication';
  label: string;
  adjustment: number;
  petName: string;
  severity?: 'direct_match' | 'possible_match';
}

/** Layer 3 — Personalization output */
export interface PersonalizationResult {
  finalScore: number;
  personalizations: PersonalizationDetail[];
}

/** Orchestrator final output — composite of all layers */
export interface ScoredResult {}
