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
  display_name?: string | null;            // D-105 consumer-facing name (UI only, not used in scoring)
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

/** Carb estimation for D-104 display — does NOT re-enter scoring */
export interface CarbEstimate {
  valueDmb: number | null;
  confidence: 'exact' | 'estimated' | 'unknown';
  qualitativeLabel: string | null;  // 'Low' | 'Moderate' | 'High'
  species: 'dog' | 'cat';
}

/** Orchestrator final output — composite of all layers */
export interface ScoredResult {
  // Core score
  finalScore: number;               // 0-100, clamped
  displayScore: number;             // same as finalScore — for D-094 "[X]% match" rendering
  petName: string | null;           // null if no petProfile

  // Layer breakdowns (for waterfall UI per D-094)
  layer1: {
    ingredientQuality: number;
    nutritionalProfile: number;     // 0 if treat or missing GA
    formulation: number;            // 0 if treat
    weightedComposite: number;      // after 55/30/15 or 100/0/0 or 78/22
  };
  layer2: {
    speciesAdjustment: number;
    appliedRules: AppliedRule[];
  };
  layer3: {
    personalizations: PersonalizationDetail[];
    allergenWarnings: PersonalizationDetail[];
  };

  // Flags for UI (merged from all layers)
  flags: string[];

  // Data quality signals
  isPartialScore: boolean;
  isRecalled: boolean;
  llmExtracted: boolean;

  // Carb estimation (D-104 — display only)
  carbEstimate: CarbEstimate | null;

  // Category
  category: 'daily_food' | 'treat';
}
