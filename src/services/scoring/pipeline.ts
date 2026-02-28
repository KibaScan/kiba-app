// Scoring Pipeline — fetches ingredient data from Supabase, hydrates, runs scoring engine.
// This is the bridge between the database and the pure scoring engine.
// No React/UI imports. No brand awareness (D-019). No affiliate logic (D-020).

import { supabase } from '../supabase';
import { computeScore } from './engine';
import type { Product, PetProfile, IngredientDict } from '../../types';
import type { ProductIngredient, ScoredResult } from '../../types/scoring';

// ─── Supabase Row Shape ──────────────────────────────────

interface ProductIngredientRow {
  position: number;
  ingredient_id: string;
  ingredients_dict: IngredientDict | null;
}

// ─── Pipeline Result ────────────────────────────────────

export interface PipelineResult {
  scoredResult: ScoredResult;
  ingredients: ProductIngredient[];
}

// ─── Hydration ───────────────────────────────────────────

function hydrateIngredient(
  row: ProductIngredientRow,
): ProductIngredient | null {
  const dict = row.ingredients_dict;
  if (!dict) return null;

  return {
    position: row.position,
    canonical_name: dict.canonical_name,
    display_name: dict.display_name,
    dog_base_severity: dict.dog_base_severity,
    cat_base_severity: dict.cat_base_severity,
    is_unnamed_species: dict.is_unnamed_species,
    is_legume: dict.is_legume,
    position_reduction_eligible: dict.position_reduction_eligible,
    cluster_id: dict.cluster_id,
    cat_carb_flag: dict.cat_carb_flag,
    allergen_group: dict.allergen_group,
    allergen_group_possible: dict.allergen_group_possible ?? [],
    // TODO: Add is_protein_fat_source column to ingredients_dict schema.
    // For M1, defaults to false — formulation protein naming returns 50 (default).
    // Impact: 25% of 15% bucket = 3.75% of total score. Acceptable M1 limitation.
    is_protein_fat_source: false,
    // D-105 display content (UI only — scoring engine never reads these)
    definition: dict.definition,
    tldr: dict.tldr,
    detail_body: dict.detail_body,
    citations_display: dict.citations_display,
  };
}

// ─── Empty Result Factory ────────────────────────────────

function makeEmptyResult(
  product: Product,
  petProfile: PetProfile | null,
  flags: string[],
): PipelineResult {
  return {
    scoredResult: {
      finalScore: 0,
      displayScore: 0,
      petName: petProfile?.name ?? null,
      layer1: {
        ingredientQuality: 0,
        nutritionalProfile: 0,
        formulation: 0,
        weightedComposite: 0,
      },
      layer2: {
        speciesAdjustment: 0,
        appliedRules: [],
      },
      layer3: {
        personalizations: [],
        allergenWarnings: [],
      },
      flags,
      isPartialScore: true,
      isRecalled: product.is_recalled,
      llmExtracted: false,
      carbEstimate: null,
      category: product.category === 'treat' ? 'treat' : 'daily_food',
    },
    ingredients: [],
  };
}

// ─── Main Pipeline ───────────────────────────────────────

export async function scoreProduct(
  product: Product,
  petProfile: PetProfile | null,
  petAllergens?: string[],
  petConditions?: string[],
): Promise<PipelineResult> {
  // Step 1: Fetch product_ingredients with ingredients_dict join
  const { data, error } = await supabase
    .from('product_ingredients')
    .select('position, ingredient_id, ingredients_dict(*)')
    .eq('product_id', product.id)
    .order('position', { ascending: true });

  if (error) {
    console.error(
      `[pipeline] product_ingredients query failed for product ${product.id}:`,
      error.message,
    );
    return makeEmptyResult(product, petProfile, ['no_ingredient_data']);
  }

  if (!data || data.length === 0) {
    console.error(
      `[pipeline] No ingredients found for product ${product.id}`,
    );
    return makeEmptyResult(product, petProfile, ['no_ingredient_data']);
  }

  // Step 2: Hydrate into ProductIngredient[]
  const rows = data as unknown as ProductIngredientRow[];
  const flags: string[] = [];
  const hydrated: ProductIngredient[] = [];

  for (const row of rows) {
    const ingredient = hydrateIngredient(row);
    if (ingredient) {
      hydrated.push(ingredient);
    } else {
      console.error(
        `[pipeline] Failed to hydrate ingredient_id ${row.ingredient_id} at position ${row.position} for product ${product.id}`,
      );
    }
  }

  // All ingredients failed hydration
  if (hydrated.length === 0) {
    return makeEmptyResult(product, petProfile, ['no_ingredient_data']);
  }

  // Some ingredients failed hydration — score with what we have
  if (hydrated.length < rows.length) {
    flags.push('partial_ingredient_data');
  }

  // Step 3: Run scoring engine
  const result = computeScore(
    product,
    hydrated,
    petProfile ?? undefined,
    petAllergens,
    petConditions,
  );

  // Merge pipeline-level flags into engine result
  const scoredResult = flags.length > 0
    ? { ...result, flags: [...new Set([...result.flags, ...flags])] }
    : result;

  return { scoredResult, ingredients: hydrated };
}
