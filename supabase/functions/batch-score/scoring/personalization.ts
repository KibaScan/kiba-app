// Layer 3 — Personalization
// Pure function. No Supabase, no side effects, no brand awareness (D-019).
// Optional layer — returns score unchanged when petProfile is null.
// All labels follow D-094 suitability framing and D-095 UPVM compliance.

import type { Product, PetProfile } from '../types';
import type { ProductIngredient, PersonalizationDetail, PersonalizationResult, IngredientSeverity } from '../types/scoring';
import { toDisplayName } from '../utils/formatters';
import { isUnder4Weeks } from '../utils/lifeStage';

// ─── D-129: Allergen Override Map ─────────────────────────

/**
 * Builds a runtime severity override map for allergen-matching ingredients.
 * Pure function — no side effects, no mutations to ingredients.
 *
 * For each ingredient: if allergen_group or allergen_group_possible matches
 * a pet allergen, the ingredient gets overridden to 'caution'.
 * The override is a floor — ingredientQuality.ts uses max(base, override)
 * so 'danger' ingredients stay 'danger'.
 */
export function buildAllergenOverrideMap(
  petAllergens: string[],
  ingredients: ProductIngredient[],
): Map<string, IngredientSeverity> {
  const overrides = new Map<string, IngredientSeverity>();
  if (petAllergens.length === 0) return overrides;

  const allergenSet = new Set(petAllergens);

  for (const ingredient of ingredients) {
    // Direct match: allergen_group = pet's allergen
    if (ingredient.allergen_group && allergenSet.has(ingredient.allergen_group)) {
      overrides.set(ingredient.canonical_name, 'danger');
      continue;
    }

    // Possible match: allergen_group_possible overlaps pet's allergens
    if (ingredient.allergen_group_possible.length > 0) {
      for (const possible of ingredient.allergen_group_possible) {
        if (allergenSet.has(possible)) {
          overrides.set(ingredient.canonical_name, 'caution');
          break;
        }
      }
    }
  }

  return overrides;
}

// ─── Life Stage Matching ───────────────────────────────

const ALL_LIFE_STAGES_KEYWORDS = ['all life stages'];
const GROWTH_KEYWORDS = ['puppy', 'kitten', 'growth'];
const ADULT_KEYWORDS = ['adult', 'maintenance'];

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
          label: `Contains ${toDisplayName(ingredient.canonical_name)} — ${ingredient.allergen_group} is a known allergen for ${petName}`,
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
              label: `Contains ${toDisplayName(ingredient.canonical_name)} — may include ${possibleAllergen}. Verify with manufacturer.`,
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

  // ─── 2. Life Stage Matching (category-scaled) ───────
  // Moved from NP bucket to Layer 3 so penalty applies equally to treats,
  // supplementals, and daily food — not diluted by category-adaptive weights.
  // Citation: AAFCO Official Publication, Nutritional Adequacy —
  // Growth & Reproduction vs Adult Maintenance profiles
  // Suppressed for pets under 4 weeks — nursing advisory takes precedence.

  const under4Weeks = isUnder4Weeks(petProfile.date_of_birth);

  if (!under4Weeks && product.life_stage_claim && petProfile.life_stage) {
    const claim = product.life_stage_claim.toLowerCase();
    const petStage = petProfile.life_stage;
    const isGrowthPet = petStage === 'puppy' || petStage === 'kitten';
    const isAdultPet =
      petStage === 'junior' || petStage === 'adult' ||
      petStage === 'mature' || petStage === 'senior' ||
      petStage === 'geriatric';
    const isAllLifeStages = ALL_LIFE_STAGES_KEYWORDS.some(k => claim.includes(k));

    if (!isAllLifeStages) {
      const isAdultClaim = ADULT_KEYWORDS.some(k => claim.includes(k));
      const isGrowthClaim = GROWTH_KEYWORDS.some(k => claim.includes(k));

      // Case 1: Puppy/kitten eating explicitly adult food — category-scaled penalty
      if (isGrowthPet && isAdultClaim) {
        const isTreat = product.category === 'treat';
        const isSupplemental = product.is_supplemental === true;
        const penalty = isTreat ? -5 : isSupplemental ? -10 : -15;
        const petLabel = petStage === 'puppy' ? 'puppy' : 'kitten';

        adjustment += penalty;
        personalizations.push({
          type: 'life_stage',
          label: `Adult food for a ${petLabel} — does not meet growth nutritional requirements (AAFCO)`,
          adjustment: penalty,
          petName,
        });
      }

      // Case 2: Adult+ eating growth/puppy/kitten food — flat penalty all categories
      if (isAdultPet && isGrowthClaim) {
        adjustment -= 5;
        personalizations.push({
          type: 'life_stage',
          label: 'Growth formula fed to an adult — excess calcium and phosphorus levels may stress kidneys over time',
          adjustment: -5,
          petName,
        });
      }
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
