// Layer 1c — Formulation Completeness Scoring
// Pure function. No Supabase, no side effects, no brand awareness.
// Three sub-checks: AAFCO statement, preservative quality, protein naming.

import type { Product } from '../types';
import type { ProductIngredient, FormulationScoreResult } from '../types/scoring';

// ─── Sub-check: AAFCO Statement (50%) ─────────────────

function scoreAafco(statement: string | null): { score: number; flag: string | null } {
  if (!statement || statement.trim() === '') {
    return { score: 30, flag: 'aafco_statement_not_available' };
  }

  const lower = statement.toLowerCase();

  if (lower.includes('all life stages')) {
    return { score: 100, flag: null };
  }
  if (lower.includes('growth') || lower.includes('reproduction')) {
    return { score: 100, flag: null };
  }
  if (lower.includes('adult') || lower.includes('maintenance')) {
    return { score: 90, flag: null };
  }
  // Common AAFCO phrasing: "complete and balanced", "formulated to meet"
  if (lower.includes('complete and balanced') || lower.includes('formulated to meet')) {
    return { score: 90, flag: null };
  }
  // Supplemental feeding statement
  if (lower.includes('supplemental') || lower.includes('intermittent')) {
    return { score: 70, flag: null };
  }
  // Animal feeding tests / AAFCO feeding trial
  if (lower.includes('feeding test') || lower.includes('feeding trial')) {
    return { score: 100, flag: null };
  }

  return { score: 50, flag: 'aafco_statement_unrecognized' };
}

// ─── Sub-check: Preservative Quality (25%) ────────────

function scorePreservative(type: string | null): { score: number; flag: string | null } {
  switch (type) {
    case 'natural':
      return { score: 100, flag: null };
    case 'mixed':
      return { score: 65, flag: null };
    case 'synthetic':
      return { score: 25, flag: null };
    case 'unknown':
    case null:
      return { score: 45, flag: 'preservative_type_unknown' };
    default:
      return { score: 45, flag: 'preservative_type_unknown' };
  }
}

// ─── Sub-check: Protein Naming Specificity (25%) ──────

function scoreProteinNaming(ingredients?: ProductIngredient[]): number {
  if (!ingredients || ingredients.length === 0) {
    return 50;
  }

  const proteinFatSources = ingredients.filter(i => i.is_protein_fat_source);

  if (proteinFatSources.length === 0) {
    return 50;
  }

  const unnamedCount = proteinFatSources.filter(i => i.is_unnamed_species).length;
  const ratio = unnamedCount / proteinFatSources.length;

  return Math.round(100 * (1 - ratio));
}

// ─── Main Function ────────────────────────────────────

export function scoreFormulation(
  product: Product,
  ingredients?: ProductIngredient[],
): FormulationScoreResult {
  const flags: string[] = [];

  const aafco = scoreAafco(product.aafco_statement);
  if (aafco.flag) flags.push(aafco.flag);

  const preservative = scorePreservative(product.preservative_type);
  if (preservative.flag) flags.push(preservative.flag);

  const proteinNamingScore = scoreProteinNaming(ingredients);

  const formulationScore = Math.round(
    aafco.score * 0.50 + preservative.score * 0.25 + proteinNamingScore * 0.25
  );

  return {
    formulationScore,
    breakdown: {
      aafcoScore: aafco.score,
      preservativeScore: preservative.score,
      proteinNamingScore,
    },
    flags,
  };
}
