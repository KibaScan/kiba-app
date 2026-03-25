// Scoring Orchestrator — wires Layer 1a/1b/1c, Layer 2, Layer 3.
// Pure function. No Supabase, no side effects, no brand awareness (D-019).
// D-020: affiliate_links is architecturally excluded from scoring.

import type { Product, PetProfile } from '../types';
import { Category, LifeStage } from '../types';
import type {
  ProductIngredient,
  ScoredResult,
  CarbEstimate,
  PersonalizationDetail,
} from '../types/scoring';

import { scoreIngredients } from './ingredientQuality';
import { scoreNutritionalProfile } from './nutritionalProfile';
import type { NutritionalProfileInput } from './nutritionalProfile';
import { scoreFormulation } from './formulationScore';
import { applySpeciesRules } from './speciesRules';
import { applyPersonalization, buildAllergenOverrideMap } from './personalization';
import { SCORING_WEIGHTS } from '../utils/constants';
import { isUnder4Weeks } from '../utils/lifeStage';

// ─── Helpers ──────────────────────────────────────────

function resolveSpecies(product: Product): 'dog' | 'cat' {
  return product.target_species === 'cat' ? 'cat' : 'dog';
}

/**
 * Maps 7-tier life stage → AAFCO/NP threshold selection.
 * This is for nutritional profile scoring — distinct from getDerLifeStage() in lifeStage.ts.
 * - puppy/kitten → Growth & Reproduction thresholds
 * - junior/adult/mature → Adult Maintenance (growth complete)
 * - senior/geriatric → Adult Maintenance (AAFCO has no senior-specific thresholds)
 * - null → adult fallback (All Life Stages)
 */
function resolveLifeStage(pet: PetProfile | undefined): 'puppy' | 'kitten' | 'adult' | 'senior' {
  if (!pet || !pet.life_stage) return 'adult';
  switch (pet.life_stage) {
    case LifeStage.Puppy: return 'puppy';
    case LifeStage.Kitten: return 'kitten';
    case LifeStage.Senior:
    case LifeStage.Geriatric: return 'senior';
    case LifeStage.Junior:
    case LifeStage.Adult:
    case LifeStage.Mature:
    default: return 'adult';
  }
}

function hasGaData(product: Product): boolean {
  return !(
    product.ga_protein_pct === null &&
    product.ga_fat_pct === null &&
    product.ga_fiber_pct === null
  );
}

/**
 * Infer moisture from product_form when ga_moisture_pct is null.
 * Without this, wet food with missing moisture defaults to 10% (dry),
 * making DMB conversion a no-op and producing false AAFCO penalties.
 */
function inferMoisture(product: Product): number | null {
  if (product.ga_moisture_pct !== null) return product.ga_moisture_pct;
  switch (product.product_form) {
    case 'wet': return 78;
    case 'raw': return 70;
    case 'freeze_dried': return 7;
    case 'dehydrated': return 8;
    case 'dry': return 10;
    default: return null;
  }
}

// ─── D-104: Carb Estimation (display only) ───────────

function estimateCarbDisplay(
  product: Product,
  species: 'dog' | 'cat',
): CarbEstimate | null {
  // Need at least protein, fat, and fiber to estimate
  if (
    product.ga_protein_pct === null ||
    product.ga_fat_pct === null ||
    product.ga_fiber_pct === null
  ) {
    return {
      valueDmb: null,
      confidence: 'unknown',
      qualitativeLabel: null,
      species,
      ashUsedPct: null,
    };
  }

  const moisture = product.ga_moisture_pct ?? 10;

  // DMB conversion
  const toDmb = (af: number) => (af / (100 - moisture)) * 100;

  const proteinDmb = toDmb(product.ga_protein_pct);
  const fatDmb = toDmb(product.ga_fat_pct);
  const fiberDmb = toDmb(product.ga_fiber_pct);

  // Ash estimation (as-fed defaults, then DMB-convert)
  let ashAf: number;
  const hasCaP = product.ga_calcium_pct != null && product.ga_phosphorus_pct != null;

  if (hasCaP) {
    ashAf = (product.ga_calcium_pct! + product.ga_phosphorus_pct!) * 2.5;
  } else if (product.category === Category.Treat) {
    ashAf = 5.0;
  } else if (moisture > 12) {
    ashAf = 2.0;
  } else {
    ashAf = 7.0;
  }

  const ashDmb = toDmb(ashAf);
  const carbDmb = Math.max(0, 100 - (proteinDmb + fatDmb + fiberDmb + ashDmb));

  const confidence = hasCaP ? 'exact' as const : 'estimated' as const;

  // Species-specific qualitative labels (D-104)
  let qualitativeLabel: string;
  if (species === 'cat') {
    if (carbDmb <= 15) qualitativeLabel = 'Low';
    else if (carbDmb <= 25) qualitativeLabel = 'Moderate';
    else qualitativeLabel = 'High';
  } else {
    if (carbDmb <= 25) qualitativeLabel = 'Low';
    else if (carbDmb <= 40) qualitativeLabel = 'Moderate';
    else qualitativeLabel = 'High';
  }

  return {
    valueDmb: Math.round(carbDmb * 10) / 10,
    confidence,
    qualitativeLabel,
    species,
    ashUsedPct: Math.round(ashAf * 10) / 10,
  };
}

// ─── Main Orchestrator ────────────────────────────────

export function computeScore(
  product: Product,
  ingredients: ProductIngredient[],
  petProfile?: PetProfile,
  petAllergens?: string[],
  petConditions?: string[],
): ScoredResult {
  const species = resolveSpecies(product);
  const lifeStage = resolveLifeStage(petProfile);
  const isTreat = product.category === Category.Treat;
  const isSupplemental = product.is_supplemental === true;
  const category = isTreat ? 'treat' as const : 'daily_food' as const;

  // ─── Step 2: Layer 1a — Ingredient Quality (always runs)
  // D-129: If pet has allergens, build override map and score twice:
  // baseIQ (for waterfall display) and overrideIQ (for actual composite)
  const hasAllergens = petAllergens != null && petAllergens.length > 0;
  const allergenOverrideMap = hasAllergens
    ? buildAllergenOverrideMap(petAllergens, ingredients)
    : undefined;

  const baseIqResult = scoreIngredients(ingredients, species);
  const iqResult = allergenOverrideMap && allergenOverrideMap.size > 0
    ? scoreIngredients(ingredients, species, allergenOverrideMap)
    : baseIqResult;

  // ─── Step 3-4: Layer 1b — Nutritional Profile
  let npScore = 0;
  let isPartialScore = false;
  let llmExtracted = false;

  if (!isTreat && hasGaData(product)) {
    const npInput: NutritionalProfileInput = {
      gaProteinPct: product.ga_protein_pct,
      gaFatPct: product.ga_fat_pct,
      gaFiberPct: product.ga_fiber_pct,
      gaMoisturePct: inferMoisture(product),
      gaCalciumPct: product.ga_calcium_pct,
      gaPhosphorusPct: product.ga_phosphorus_pct,
      gaOmega3Pct: product.ga_omega3_pct,
      species,
      lifeStage,
      breedSize: petProfile?.breed_size ?? null,
      petConditions: petConditions ?? [],
      aafcoStatement: product.aafco_statement,
      lifeStageClaim: product.life_stage_claim,
      nutritionalDataSource: product.nutritional_data_source,
      category,
      isSupplemental,
    };
    const npResult = scoreNutritionalProfile(npInput);
    npScore = npResult.bucketScore;
    llmExtracted = npResult.llmExtracted;

    if (npResult.dataQuality === 'missing') {
      isPartialScore = true;
      npScore = 0;
    }
  } else if (!isTreat && !hasGaData(product)) {
    // D-017: GA missing → reweight to ~78/22
    isPartialScore = true;
  }

  // ─── Step 5: Layer 1c — Formulation (daily food only)
  let fcScore = 0;
  const fcFlags: string[] = [];
  if (!isTreat) {
    const fcResult = scoreFormulation(product, ingredients);
    fcScore = fcResult.formulationScore;
    fcFlags.push(...fcResult.flags);
  }

  // ─── Step 6: Category-adaptive weights (D-010)
  let weightedComposite: number;
  let iqWeight: number;

  if (isTreat) {
    const w = SCORING_WEIGHTS.treat;
    iqWeight = w.iq;
    weightedComposite = iqResult.ingredientScore;
  } else if (isPartialScore) {
    const w = SCORING_WEIGHTS.daily_food_partial;
    iqWeight = w.iq;
    weightedComposite = iqResult.ingredientScore * w.iq + fcScore * w.fc;
  } else if (isSupplemental) {
    const w = SCORING_WEIGHTS.supplemental;
    iqWeight = w.iq;
    weightedComposite = iqResult.ingredientScore * w.iq + npScore * w.np;
  } else {
    const w = SCORING_WEIGHTS.daily_food;
    iqWeight = w.iq;
    weightedComposite = iqResult.ingredientScore * w.iq + npScore * w.np + fcScore * w.fc;
  }

  // D-129: allergen delta — weighted difference between base and override IQ
  const allergenDelta = iqResult !== baseIqResult
    ? Math.round((baseIqResult.ingredientScore - iqResult.ingredientScore) * iqWeight * 10) / 10
    : 0;

  weightedComposite = Math.round(weightedComposite * 10) / 10;

  // ─── Step 7: Layer 2 — Species Rules
  const l2Result = applySpeciesRules(product, species, ingredients, weightedComposite);
  const speciesAdjustment = l2Result.adjustedScore - weightedComposite;

  // ─── Step 8: Layer 3 — Personalization
  let finalScore = l2Result.adjustedScore;
  let personalizations: PersonalizationDetail[] = [];

  if (petProfile) {
    const l3Result = applyPersonalization(
      l2Result.adjustedScore,
      product,
      ingredients,
      petProfile,
      petAllergens,
      petConditions,
    );
    finalScore = l3Result.finalScore;
    personalizations = l3Result.personalizations;
  }

  // ─── Step 9: Carb estimate (D-104 display only)
  const carbEstimate = estimateCarbDisplay(product, species);

  // ─── Step 10: Clamp
  finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

  // ─── Step 12: Merge flags (deduplicated)
  const allFlags = new Set<string>();
  for (const f of iqResult.flags) allFlags.add(f);
  for (const f of fcFlags) allFlags.add(f);

  // Nursing advisory: pet under 4 weeks should be primarily nursing
  if (petProfile && isUnder4Weeks(petProfile.date_of_birth)) {
    allFlags.add('nursing_advisory');
  }

  // ─── Step 13: Filter allergen warnings
  const allergenWarnings = personalizations.filter(p => p.type === 'allergen');

  return {
    finalScore,
    displayScore: finalScore,
    petName: petProfile?.name ?? null,

    layer1: {
      ingredientQuality: baseIqResult.ingredientScore, // D-129: base IQ for waterfall display
      nutritionalProfile: npScore,
      formulation: fcScore,
      weightedComposite: Math.round(weightedComposite * 10) / 10,
    },
    layer2: {
      speciesAdjustment: Math.round(speciesAdjustment * 10) / 10,
      appliedRules: l2Result.rules,
    },
    layer3: {
      personalizations,
      allergenWarnings,
    },

    ingredientPenalties: iqResult.penalties,
    ingredientResults: baseIqResult.groupedPenalties,

    flags: [...allFlags],

    allergenDelta,

    isPartialScore,
    isRecalled: product.is_recalled,
    llmExtracted,

    carbEstimate,
    category,
  };
}
