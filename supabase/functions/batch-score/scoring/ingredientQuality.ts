// Layer 1a — Ingredient Quality Scoring
// Pure function. No Supabase, no side effects, no brand awareness.
// Products start at 100. All penalties are deductions. Floor at 0.

import type { ProductIngredient, IngredientScoreResult, IngredientPenaltyResult, Penalty, IngredientSeverity } from '../types/scoring.ts';

const SEVERITY_ORDER: Record<IngredientSeverity, number> = {
  good: 0,
  neutral: 1,
  caution: 2,
  danger: 3,
};

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
  allergenOverrides?: Map<string, IngredientSeverity>,
): IngredientScoreResult {
  let score = 100;
  const penalties: Penalty[] = [];
  const flags: string[] = [];
  let unnamedSpeciesCount = 0;

  // ─── Severity + position penalties ──────────────────────
  for (const ingredient of ingredients) {
    const baseSeverity = species === 'dog'
      ? ingredient.dog_base_severity
      : ingredient.cat_base_severity;

    // D-129: allergen override — use max(baseSeverity, override) so allergens
    // only increase concern, never reduce it (danger stays danger)
    const override = allergenOverrides?.get(ingredient.canonical_name);
    const severity = override && SEVERITY_ORDER[override] > SEVERITY_ORDER[baseSeverity]
      ? override
      : baseSeverity;

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

  // ─── Group penalties by ingredient ────────────────────────
  const grouped = new Map<string, {
    position: number;
    displayName: string;
    reasons: Array<{ reason: string; rawPoints: number; weightedPoints: number; citationSource: string }>;
    maxRawPenalty: number;
  }>();

  for (const penalty of penalties) {
    const existing = grouped.get(penalty.ingredientName);
    if (existing) {
      existing.reasons.push({
        reason: penalty.reason,
        rawPoints: penalty.rawPenalty,
        weightedPoints: penalty.positionAdjustedPenalty,
        citationSource: penalty.citationSource,
      });
      if (penalty.rawPenalty > existing.maxRawPenalty) {
        existing.maxRawPenalty = penalty.rawPenalty;
      }
    } else {
      const ing = ingredients.find(i => i.canonical_name === penalty.ingredientName);
      grouped.set(penalty.ingredientName, {
        position: penalty.position,
        displayName: ing?.display_name ?? penalty.ingredientName,
        reasons: [{
          reason: penalty.reason,
          rawPoints: penalty.rawPenalty,
          weightedPoints: penalty.positionAdjustedPenalty,
          citationSource: penalty.citationSource,
        }],
        maxRawPenalty: penalty.rawPenalty,
      });
    }
  }

  const groupedPenalties: IngredientPenaltyResult[] = [];
  for (const [canonicalName, data] of grouped) {
    groupedPenalties.push({
      ingredientName: data.displayName,
      canonicalName,
      severity: data.maxRawPenalty >= 15 ? 'danger' : 'caution',
      position: data.position,
      reasons: data.reasons,
      totalWeightedPoints: data.reasons.reduce((sum, r) => sum + r.weightedPoints, 0),
    });
  }

  return {
    ingredientScore: Math.max(0, score),
    penalties,
    groupedPenalties,
    flags,
    unnamedSpeciesCount,
  };
}
