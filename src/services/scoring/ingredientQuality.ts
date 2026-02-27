// Layer 1a — Ingredient Quality Scoring
// Pure function. No Supabase, no side effects, no brand awareness.
// Products start at 100. All penalties are deductions. Floor at 0.

import type { ProductIngredient, IngredientScoreResult, Penalty, IngredientSeverity } from '../../types/scoring';

const SEVERITY_PENALTY: Record<IngredientSeverity, number> = {
  danger: 15,
  caution: 8,
  neutral: 0,
  good: 0,
};

const UNNAMED_SPECIES_PENALTY = 2; // D-012: −2 per unnamed fat/protein

function getPositionMultiplier(position: number): number {
  if (position <= 5) return 1.0;
  if (position <= 10) return 0.7;
  return 0.4;
}

function getSeverityReason(severity: 'danger' | 'caution'): string {
  return severity === 'danger'
    ? 'High-severity ingredient concern'
    : 'Moderate-severity ingredient concern';
}

function getSeverityCitation(severity: 'danger' | 'caution'): string {
  return severity === 'danger'
    ? 'AAFCO-2023; Merck Veterinary Manual'
    : 'AAFCO-2023';
}

export function scoreIngredients(
  ingredients: ProductIngredient[],
  species: 'dog' | 'cat',
): IngredientScoreResult {
  let score = 100;
  const penalties: Penalty[] = [];
  const flags: string[] = [];
  let unnamedSpeciesCount = 0;

  // ─── Severity + position penalties ──────────────────────
  for (const ingredient of ingredients) {
    const severity = species === 'dog'
      ? ingredient.dog_base_severity
      : ingredient.cat_base_severity;

    const rawPenalty = SEVERITY_PENALTY[severity] ?? 0;

    if (rawPenalty > 0) {
      // D-018: check position_reduction_eligible BEFORE applying discount
      const multiplier = ingredient.position_reduction_eligible
        ? getPositionMultiplier(ingredient.position)
        : 1.0;

      const positionAdjustedPenalty = rawPenalty * multiplier;

      penalties.push({
        ingredientName: ingredient.canonical_name,
        reason: getSeverityReason(severity as 'danger' | 'caution'),
        rawPenalty,
        positionAdjustedPenalty,
        position: ingredient.position,
        citationSource: getSeverityCitation(severity as 'danger' | 'caution'),
      });

      score -= positionAdjustedPenalty;
    }

    // D-012: unnamed species penalty — position-independent
    if (ingredient.is_unnamed_species) {
      unnamedSpeciesCount++;

      penalties.push({
        ingredientName: ingredient.canonical_name,
        reason: 'Unnamed species source — variable supply chain, allergy risk',
        rawPenalty: UNNAMED_SPECIES_PENALTY,
        positionAdjustedPenalty: UNNAMED_SPECIES_PENALTY,
        position: ingredient.position,
        citationSource: 'AAFCO Definitions 9.3/9.14 (2023)',
      });

      score -= UNNAMED_SPECIES_PENALTY;
    }
  }

  // ─── D-015: Ingredient splitting detection (flag only) ──
  const clusterCounts = new Map<string, number>();
  for (const ingredient of ingredients) {
    if (ingredient.cluster_id !== null) {
      clusterCounts.set(
        ingredient.cluster_id,
        (clusterCounts.get(ingredient.cluster_id) ?? 0) + 1,
      );
    }
  }
  for (const count of clusterCounts.values()) {
    if (count >= 2) {
      flags.push('ingredient_splitting_detected');
      break; // one flag is enough regardless of how many clusters split
    }
  }

  return {
    ingredientScore: Math.max(0, score),
    penalties,
    flags,
    unnamedSpeciesCount,
  };
}
