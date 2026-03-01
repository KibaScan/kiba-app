// Layer 3 — Personalization
// Pure function. No Supabase, no side effects, no brand awareness (D-019).
// Optional layer — returns score unchanged when petProfile is null.
// All labels follow D-094 suitability framing and D-095 UPVM compliance.

import type { Product } from '../../types';
import type { PetProfile } from '../../types';
import type { ProductIngredient, PersonalizationDetail, PersonalizationResult } from '../../types/scoring';

// ─── Life Stage Matching ───────────────────────────────

const ALL_LIFE_STAGES_KEYWORDS = ['all life stages'];
const GROWTH_KEYWORDS = ['puppy', 'kitten', 'growth'];
const ADULT_KEYWORDS = ['adult', 'maintenance'];

function lifeStageCovers(claim: string, petLifeStage: string): boolean {
  const lower = claim.toLowerCase();

  if (ALL_LIFE_STAGES_KEYWORDS.some(k => lower.includes(k))) {
    return true;
  }

  const isGrowthPet = petLifeStage === 'puppy' || petLifeStage === 'kitten';
  // junior/adult/mature/senior/geriatric are all post-growth — Adult Maintenance covers them
  const isAdultPet =
    petLifeStage === 'junior' ||
    petLifeStage === 'adult' ||
    petLifeStage === 'mature' ||
    petLifeStage === 'senior' ||
    petLifeStage === 'geriatric';

  if (isGrowthPet && GROWTH_KEYWORDS.some(k => lower.includes(k))) {
    return true;
  }

  if (isAdultPet && ADULT_KEYWORDS.some(k => lower.includes(k))) {
    return true;
  }

  // Growth claim also covers adults (more restrictive formulation)
  if (isAdultPet && GROWTH_KEYWORDS.some(k => lower.includes(k))) {
    return true;
  }

  return false;
}

// ─── Main Function ─────────────────────────────────────

export function applyPersonalization(
  score: number,
  product: Product,
  ingredients: ProductIngredient[],
  petProfile: PetProfile | null,
  petAllergens?: string[],
  petConditions?: string[],
): PersonalizationResult {
  if (!petProfile) {
    return { finalScore: score, personalizations: [] };
  }

  const personalizations: PersonalizationDetail[] = [];
  let adjustment = 0;
  const petName = petProfile.name;

  // ─── 1. Allergen Cross-Reference (D-097 + D-098) ────

  if (petAllergens && petAllergens.length > 0) {
    for (const ingredient of ingredients) {
      // Direct match: ingredient's allergen_group matches pet's allergen
      if (
        ingredient.allergen_group &&
        petAllergens.includes(ingredient.allergen_group)
      ) {
        personalizations.push({
          type: 'allergen',
          label: `Contains ${ingredient.canonical_name} — ${ingredient.allergen_group} is a known allergen for ${petName}`,
          adjustment: 0,
          petName,
          severity: 'direct_match',
        });
      }

      // Possible match: ingredient's allergen_group_possible overlaps pet's allergens
      if (ingredient.allergen_group_possible.length > 0) {
        for (const possibleAllergen of ingredient.allergen_group_possible) {
          if (petAllergens.includes(possibleAllergen)) {
            personalizations.push({
              type: 'allergen',
              label: `Contains ${ingredient.canonical_name} — may include ${possibleAllergen}. Verify with manufacturer.`,
              adjustment: 0,
              petName,
              severity: 'possible_match',
            });
            break; // one flag per ingredient for possible matches
          }
        }
      }
    }
  }

  // ─── 2. Life Stage Matching ──────────────────────────

  if (product.life_stage_claim && petProfile.life_stage) {
    if (!lifeStageCovers(product.life_stage_claim, petProfile.life_stage)) {
      adjustment -= 10;
      personalizations.push({
        type: 'life_stage',
        label: `${petName}'s Life Stage Compatibility`,
        adjustment: -10,
        petName,
      });
    }
  }

  // ─── 3. Breed-Specific Modifiers ─────────────────────

  // M1: stub — breed modifier framework in place, data applied in M2+
  // When available: look up breed in src/content/breedModifiers/,
  // apply modifier capped at ±10 total (§6c).
  // 'no_modifier' breeds explicitly registered to prevent false penalties.
  personalizations.push({
    type: 'breed',
    label: `${petName}'s Breed & Age Adjustments`,
    adjustment: 0,
    petName,
  });

  // ─── 4. Health Conditions (D-097) ────────────────────

  // M1: framework only — flag conditions present, no score impact.
  // Full condition scoring multipliers come in M2.
  if (petConditions && petConditions.length > 0) {
    personalizations.push({
      type: 'condition',
      label: `${petName}'s Health Profile`,
      adjustment: 0,
      petName,
    });
  }

  const finalScore = Math.max(0, Math.min(100, score + adjustment));

  return { finalScore, personalizations };
}
