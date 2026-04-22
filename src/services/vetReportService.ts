// Kiba — M6 Vet Report Data Assembly Service
// Assembles all data needed for the Vet Report PDF from Supabase + local stores.
// Offline guard fires first. All queries run in parallel where possible.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import { getPetConditions, getPetAllergens, getMedications, getConditionDetails } from './petService';
import { getHealthRecords } from './appointmentService';
import { getUpcomingAppointments } from './appointmentService';
import { computePetDer, getWetFoodKcal } from '../utils/pantryHelpers';
import { useTreatBatteryStore, getTodayStr } from '../stores/useTreatBatteryStore';
import { getOwnerDietaryCards, detectConflicts } from '../data/ownerDietaryCards';

import type { Pet } from '../types/pet';
import type { Product } from '../types';
import type { PantryCardData, PantryPetAssignment } from '../types/pantry';
import type {
  VetReportData,
  VetReportDietItem,
  CombinedNutrition,
  AafcoCheck,
  SupplementNutrient,
  VetReportFlag,
  ConditionNote,
  WeightTrackingData,
  TreatSummary,
} from '../types/vetReport';

// ─── Constants ──────────────────────────────────────────

const GOAL_LABELS: Record<number, string> = {
  [-3]: 'Aggressive Loss', [-2]: 'Moderate Loss', [-1]: 'Mild Loss',
  0: 'Maintain', 1: 'Mild Gain', 2: 'Moderate Gain', 3: 'Aggressive Gain',
};

const FORM_LABELS: Record<string, string> = {
  dry: 'Dry', wet: 'Wet', raw: 'Raw', freeze_dried: 'Freeze-Dried',
  dehydrated: 'Dehydrated', air_dried: 'Air-Dried',
};

// AAFCO adult minimums (DMB %)
const AAFCO_DOG_ADULT = { protein: 18.0, fat: 5.5, calcium: 0.5, phosphorus: 0.4 };
const AAFCO_CAT_ADULT = { protein: 26.0, fat: 9.0, calcium: 0.6, phosphorus: 0.5 };

const KCAL_PER_LB = 3500; // rough cal→weight conversion

// Condition tag → human-readable label
const CONDITION_LABELS: Record<string, string> = {
  ckd: 'Kidney Disease', cardiac: 'Heart Disease', pancreatitis: 'Pancreatitis',
  diabetes: 'Diabetes', urinary: 'Urinary Issues', obesity: 'Overweight',
  underweight: 'Underweight', gi_sensitive: 'Sensitive Stomach', skin: 'Skin & Coat',
  hypothyroid: 'Hypothyroidism', hyperthyroid: 'Hyperthyroidism', joint: 'Joint Issues',
  allergy: 'Food Allergies', liver: 'Liver Disease', seizures: 'Seizures',
};

// ─── Main Assembly ──────────────────────────────────────

export async function assembleVetReportData(
  petId: string,
  pantryCards: PantryCardData[],
): Promise<VetReportData> {
  // Offline guard — fires before any async work
  if (!(await isOnline())) {
    throw new Error('Connect to the internet to generate a vet report.');
  }

  // ─── Parallel queries ─────────────────────────────────
  const [
    petResult,
    conditionsResult,
    conditionDetailsResult,
    allergensResult,
    medicationsResult,
    healthRecordsResult,
    sessionResult,
  ] = await Promise.all([
    supabase.from('pets').select('*').eq('id', petId).single(),
    getPetConditions(petId),
    getConditionDetails(petId),
    getPetAllergens(petId),
    getMedications(petId),
    getHealthRecords(petId),
    supabase.auth.getSession(),
  ]);

  if (petResult.error || !petResult.data) {
    throw new Error('Failed to load pet profile for report.');
  }

  const pet = petResult.data as Pet;
  const conditionTags = conditionsResult.map(c => c.condition_tag);
  const allergenNames = allergensResult.map(a => a.allergen);
  const userId = sessionResult.data?.session?.user?.id;

  // Upcoming appointments (needs userId)
  const upcomingAppointments = userId
    ? await getUpcomingAppointments(userId, petId)
    : [];

  // Fetch ingredients for per-product detail (first 10 per product)
  const productIds = pantryCards.map(c => c.product_id).filter(Boolean);
  const ingredientMap = await fetchIngredientNames(productIds);

  // ─── Build diet items from pantry cards ───────────────
  const dietItems = buildDietItems(pantryCards, petId, allergenNames, ingredientMap);

  // ─── Computed values ──────────────────────────────────
  const combinedNutrition = computeCombinedNutrition(dietItems, pet.species);
  const supplementNutrients = computeSupplementNutrients(pantryCards);
  const flags = generateFlags(dietItems, pantryCards, combinedNutrition, pet);
  const conditionNotes = generateConditionNotes(conditionTags, combinedNutrition, dietItems, pet);
  const treatSummary = computeTreatSummary(petId, pantryCards);
  const adjustedDER = computePetDer(pet, true, pet.weight_goal_level) ?? 0;
  
  const baseKcal = dietItems.reduce((sum, d) => sum + d.dailyKcal, 0);
  const treatKcal = treatSummary?.avgDailyKcal ?? 0;
  
  // Under behavioral feeding, rotational items are 0 dailyKcal, so their allotment comes from wet_reserve_kcal
  const wetReserve = pet.feeding_style === 'dry_and_wet' ? (pet.wet_reserve_kcal ?? 0) : 0;
  const totalDailyKcal = baseKcal + treatKcal + wetReserve;
  
  const caloricBalance = totalDailyKcal - adjustedDER;
  const weightTracking = buildWeightTracking(pet);
  const ownerDietaryCards = getOwnerDietaryCards(conditionTags, allergenNames.length, pet.species);
  const conditionConflicts = detectConflicts(conditionTags, pet.species);

  // Split health records by type
  const vaccinations = healthRecordsResult.filter(r => r.record_type === 'vaccination');
  const dewormings = healthRecordsResult.filter(r => r.record_type === 'deworming');

  return {
    pet,
    conditionTags,
    conditionDetails: conditionDetailsResult,
    allergens: allergenNames,
    medications: medicationsResult,
    dietItems,
    combinedNutrition,
    supplementNutrients,
    flags,
    conditionNotes,
    healthRecords: { vaccinations, dewormings },
    upcomingAppointments,
    treatSummary,
    weightTracking,
    adjustedDER,
    caloricBalance,
    wetReserveKcal: pet.wet_reserve_kcal ?? null,
    ownerDietaryCards,
    conditionConflicts,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Ingredient Fetch ───────────────────────────────────

async function fetchIngredientNames(
  productIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (productIds.length === 0) return map;

  const { data, error } = await supabase
    .from('product_ingredients')
    .select('product_id, position, ingredients_dict(canonical_name)')
    .in('product_id', productIds)
    .order('position', { ascending: true });

  if (error || !data) return map;

  for (const row of (data as unknown as { product_id: string; position: number; ingredients_dict: { canonical_name: string } | null }[])) {
    if (!row.ingredients_dict) continue;
    const existing = map.get(row.product_id) ?? [];
    if (existing.length < 10) {
      existing.push(row.ingredients_dict.canonical_name);
    }
    map.set(row.product_id, existing);
  }

  return map;
}

// ─── Diet Items Builder ─────────────────────────────────

export function buildDietItems(
  cards: PantryCardData[],
  petId: string,
  allergens: string[],
  ingredientMap: Map<string, string[]>,
): VetReportDietItem[] {
  return cards.map(card => {
    const product = card.product;
    const assignment = card.assignments.find(a => a.pet_id === petId);
    const dailyKcal = card.calorie_context?.daily_kcal ?? 0;
    const ingredients = ingredientMap.get(card.product_id) ?? [];

    // Cross-reference allergens against ingredient names
    const allergenFlags = allergens.filter(allergen =>
      ingredients.some(ing =>
        ing.toLowerCase().includes(allergen.toLowerCase()),
      ),
    );

    // Build serving display
    const servingDisplay = assignment
      ? formatServing(assignment, product as unknown as import('../types/index').Product)
      : 'As needed';

    // Determine form label
    const formLabel = getFormLabel(product, card);

    return {
      productName: product.name,
      brand: product.brand,
      form: formLabel,
      servingDisplay,
      dailyKcal: assignment?.feeding_role === 'rotational' ? 0 : dailyKcal,
      category: product.category,
      isSupplemental: product.is_supplemental,
      isRecalled: product.is_recalled,
      aafcoStatement: product.aafco_statement ?? null,
      gaProtein: (product as unknown as Product).ga_protein_pct ?? null,
      gaFat: (product as unknown as Product).ga_fat_pct ?? null,
      gaFiber: (product as unknown as Product).ga_fiber_pct ?? null,
      gaMoisture: (product as unknown as Product).ga_moisture_pct ?? null,
      gaCalcium: (product as unknown as Product).ga_calcium_pct ?? null,
      gaPhosphorus: (product as unknown as Product).ga_phosphorus_pct ?? null,
      gaKcalPerKg: product.ga_kcal_per_kg ?? null,
      ingredients,
      allergenFlags,
    };
  });
}

export function formatServing(assignment: PantryPetAssignment, product?: import('../types/index').Product): string {
  if (assignment.feeding_role === 'rotational') {
    const unitLabel = assignment.serving_size_unit || 'unit';
    if (!product) return `Rotational (~kcal per ${unitLabel})`;
    
    const kcalRes = getWetFoodKcal(product);
    const kcalStr = kcalRes ? `${kcalRes.kcal} kcal` : '~kcal';
    return `Rotational (${kcalStr} per ${unitLabel})`;
  }

  const size = assignment.serving_size;
  const unit = assignment.serving_size_unit;
  const freq = assignment.feedings_per_day;
  const sizeStr = size % 1 === 0 ? String(size) : size.toFixed(1);
  if (freq === 1) return `${sizeStr} ${unit}/day`;
  return `${sizeStr} ${unit} × ${freq}/day`;
}

export function getFormLabel(
  product: PantryCardData['product'],
  card: PantryCardData,
): string {
  if (product.category === 'treat') return 'Treat';
  if (product.category === 'supplement') return 'Supp';
  if (product.is_supplemental) return 'Top';
  const form = product.product_form;
  return form ? (FORM_LABELS[form] ?? form) : 'Food';
}

// ─── Combined Nutrition ─────────────────────────────────

export function computeCombinedNutrition(
  items: VetReportDietItem[],
  species: 'dog' | 'cat',
): CombinedNutrition {
  // Include daily_food and supplemental — exclude treats and pure supplements
  const eligible = items.filter(
    i => i.category !== 'treat' && i.category !== 'supplement' && i.dailyKcal > 0,
  );

  if (eligible.length === 0) {
    return emptyCombinedNutrition(species);
  }

  const totalKcal = eligible.reduce((s, i) => s + i.dailyKcal, 0);

  // Calorie-weighted average for each macro
  const weightedAvg = (getter: (i: VetReportDietItem) => number | null): number | null => {
    let sum = 0;
    let kcalSum = 0;
    for (const item of eligible) {
      const val = getter(item);
      if (val == null) continue;
      sum += val * item.dailyKcal;
      kcalSum += item.dailyKcal;
    }
    return kcalSum > 0 ? Math.round((sum / kcalSum) * 100) / 100 : null;
  };

  const proteinAsFed = weightedAvg(i => i.gaProtein);
  const fatAsFed = weightedAvg(i => i.gaFat);
  const fiberAsFed = weightedAvg(i => i.gaFiber);
  const moistureAsFed = weightedAvg(i => i.gaMoisture);
  const calciumAsFed = weightedAvg(i => i.gaCalcium);
  const phosphorusAsFed = weightedAvg(i => i.gaPhosphorus);
  const kcalPerKg = weightedAvg(i => i.gaKcalPerKg);

  // DMB conversion
  const toDmb = (asFed: number | null, moisture: number | null): number | null => {
    if (asFed == null || moisture == null) return null;
    const dm = 100 - moisture;
    return dm > 0 ? Math.round((asFed / dm) * 100 * 100) / 100 : null;
  };

  const proteinDmb = toDmb(proteinAsFed, moistureAsFed);
  const fatDmb = toDmb(fatAsFed, moistureAsFed);
  const fiberDmb = toDmb(fiberAsFed, moistureAsFed);
  const calciumDmb = toDmb(calciumAsFed, moistureAsFed);
  const phosphorusDmb = toDmb(phosphorusAsFed, moistureAsFed);
  const kcalPerKgDmb = toDmb(kcalPerKg, moistureAsFed);

  // AAFCO checks
  const thresholds = species === 'dog' ? AAFCO_DOG_ADULT : AAFCO_CAT_ADULT;
  const aafcoChecks: AafcoCheck[] = [
    {
      nutrient: 'Protein',
      dmbValue: proteinDmb,
      threshold: thresholds.protein,
      passes: proteinDmb != null ? proteinDmb >= thresholds.protein : false,
      label: `≥${thresholds.protein}%`,
    },
    {
      nutrient: 'Fat',
      dmbValue: fatDmb,
      threshold: thresholds.fat,
      passes: fatDmb != null ? fatDmb >= thresholds.fat : false,
      label: `≥${thresholds.fat}%`,
    },
    {
      nutrient: 'Calcium',
      dmbValue: calciumDmb,
      threshold: thresholds.calcium,
      passes: calciumDmb != null ? calciumDmb >= thresholds.calcium : false,
      label: `≥${thresholds.calcium}%`,
    },
    {
      nutrient: 'Phosphorus',
      dmbValue: phosphorusDmb,
      threshold: thresholds.phosphorus,
      passes: phosphorusDmb != null ? phosphorusDmb >= thresholds.phosphorus : false,
      label: `≥${thresholds.phosphorus}%`,
    },
  ];

  return {
    proteinAsFed, proteinDmb,
    fatAsFed, fatDmb,
    fiberAsFed, fiberDmb,
    moistureAsFed,
    calciumAsFed, calciumDmb,
    phosphorusAsFed, phosphorusDmb,
    kcalPerKg, kcalPerKgDmb,
    aafcoChecks,
  };
}

function emptyCombinedNutrition(species: 'dog' | 'cat'): CombinedNutrition {
  const thresholds = species === 'dog' ? AAFCO_DOG_ADULT : AAFCO_CAT_ADULT;
  return {
    proteinAsFed: null, proteinDmb: null,
    fatAsFed: null, fatDmb: null,
    fiberAsFed: null, fiberDmb: null,
    moistureAsFed: null,
    calciumAsFed: null, calciumDmb: null,
    phosphorusAsFed: null, phosphorusDmb: null,
    kcalPerKg: null, kcalPerKgDmb: null,
    aafcoChecks: [
      { nutrient: 'Protein', dmbValue: null, threshold: thresholds.protein, passes: false, label: `≥${thresholds.protein}%` },
      { nutrient: 'Fat', dmbValue: null, threshold: thresholds.fat, passes: false, label: `≥${thresholds.fat}%` },
    ],
  };
}

// ─── Supplemental Nutrients ─────────────────────────────

export function computeSupplementNutrients(cards: PantryCardData[]): SupplementNutrient[] {
  const nutrients: SupplementNutrient[] = [];

  // Helper: scan all products for a GA field, take highest value
  const scanPct = (
    field: keyof Product,
    name: string,
  ) => {
    let best: number | null = null;
    const sources: string[] = [];
    for (const card of cards) {
      const product = card.product as unknown as Product;
      const val = product[field] as number | null;
      if (val != null && val > 0) {
        sources.push(product.name);
        if (best == null || val > best) best = val;
      }
    }
    if (best != null) {
      nutrients.push({ name, value: `${best}%`, unit: '%', sources });
    }
  };

  const scanMg = (
    field: keyof Product,
    name: string,
    unit: string,
  ) => {
    let best: number | null = null;
    const sources: string[] = [];
    for (const card of cards) {
      const product = card.product as unknown as Product;
      const val = product[field] as number | null;
      if (val != null && val > 0) {
        sources.push(product.name);
        if (best == null || val > best) best = val;
      }
    }
    if (best != null) {
      nutrients.push({ name, value: String(best), unit, sources });
    }
  };

  const scanPresence = (
    field: keyof Product,
    name: string,
  ) => {
    const sources: string[] = [];
    for (const card of cards) {
      const product = card.product as unknown as Product;
      const val = product[field];
      if (val != null && val !== '' && val !== '0') {
        sources.push(product.name);
      }
    }
    if (sources.length > 0) {
      nutrients.push({ name, value: 'Present', unit: '', sources });
    }
  };

  scanPct('ga_omega3_pct', 'Omega-3');
  scanPct('ga_dha_pct', 'DHA');
  // EPA intentionally excluded — ga_epa_pct not on Product type
  scanPct('ga_omega6_pct', 'Omega-6');
  scanPct('ga_taurine_pct', 'Taurine');
  scanMg('ga_l_carnitine_mg', 'L-Carnitine', 'mg/kg');
  scanMg('ga_zinc_mg_kg', 'Zinc', 'mg/kg');
  scanPresence('ga_probiotics_cfu', 'Probiotics');

  return nutrients;
}

// ─── Flags ──────────────────────────────────────────────

export function generateFlags(
  dietItems: VetReportDietItem[],
  cards: PantryCardData[],
  nutrition: CombinedNutrition,
  pet: Pet,
): VetReportFlag[] {
  const flags: VetReportFlag[] = [];
  let priority = 0;

  // P1: Recall
  const recalledProducts = dietItems.filter(d => d.isRecalled);
  if (recalledProducts.length > 0) {
    flags.push({
      priority: ++priority,
      type: 'recall',
      icon: '⚠',
      label: 'RECALL',
      message: `${recalledProducts.map(p => p.productName).join(', ')} ${recalledProducts.length === 1 ? 'has' : 'have'} been recalled by the FDA.`,
    });
  }

  // P2: Allergen
  const allergenProducts = dietItems.filter(d => d.allergenFlags.length > 0);
  if (allergenProducts.length > 0) {
    const allAllergens = [...new Set(allergenProducts.flatMap(d => d.allergenFlags))];
    flags.push({
      priority: ++priority,
      type: 'allergen',
      icon: '⚠',
      label: 'ALLERGEN',
      message: `Known allergens detected: ${allAllergens.join(', ')} in ${allergenProducts.map(p => p.productName).join(', ')}.`,
    });
  }

  // P3: AAFCO
  const failingChecks = nutrition.aafcoChecks.filter(c => !c.passes && c.dmbValue != null);
  if (failingChecks.length > 0) {
    flags.push({
      priority: ++priority,
      type: 'aafco',
      icon: '⚠',
      label: 'AAFCO',
      message: `Combined diet does not meet AAFCO adult minimums for: ${failingChecks.map(c => `${c.nutrient} (${c.dmbValue?.toFixed(1)}% DMB vs ${c.label})`).join(', ')}.`,
    });
  }

  // P4: Supplemental-only diet
  const nonTreatNonSupp = dietItems.filter(
    d => d.category !== 'treat' && d.category !== 'supplement',
  );
  const allSupplemental = nonTreatNonSupp.length > 0 && nonTreatNonSupp.every(d => d.isSupplemental);
  if (allSupplemental) {
    flags.push({
      priority: ++priority,
      type: 'supplemental_only',
      icon: '⚠',
      label: 'DIET',
      message: 'All tracked foods are supplemental/toppers. No complete-and-balanced diet detected.',
    });
  }

  // P5: Caloric (>20% over or under DER)
  // Computed at assembly level — just capture the flag here

  // P6: Treat percentage
  const treatItems = dietItems.filter(d => d.category === 'treat');
  const totalKcal = dietItems.reduce((s, d) => s + d.dailyKcal, 0);
  const treatKcal = treatItems.reduce((s, d) => s + d.dailyKcal, 0);
  if (totalKcal > 0 && treatKcal / totalKcal > 0.1) {
    flags.push({
      priority: ++priority,
      type: 'treat',
      icon: '⚠',
      label: 'TREATS',
      message: `Treats represent ${Math.round((treatKcal / totalKcal) * 100)}% of daily calories (guideline: <10%).`,
    });
  }

  // P7: DCM advisory (grain-free with peas/lentils in top positions)
  if (pet.species === 'dog') {
    const grainFreeProducts = cards.filter(c => (c.product as unknown as Product).is_grain_free);
    if (grainFreeProducts.length > 0) {
      flags.push({
        priority: ++priority,
        type: 'dcm',
        icon: 'ℹ',
        label: 'DCM',
        message: `${grainFreeProducts.length} grain-free product${grainFreeProducts.length > 1 ? 's' : ''} in diet. The FDA has investigated a link between grain-free diets and DCM in dogs — causality not established.`,
      });
    }
  }

  // P8: No recalls (positive)
  if (recalledProducts.length === 0 && dietItems.length > 0) {
    flags.push({
      priority: ++priority,
      type: 'no_recall',
      icon: 'ℹ',
      label: 'RECALLS',
      message: 'No tracked products are on the FDA recall list.',
    });
  }

  return flags;
}

// ─── Condition Management Notes ─────────────────────────

export function generateConditionNotes(
  conditionTags: string[],
  nutrition: CombinedNutrition,
  dietItems: VetReportDietItem[],
  pet: Pet,
): ConditionNote[] {
  const notes: ConditionNote[] = [];

  for (const tag of conditionTags) {
    const observations: string[] = [];

    switch (tag) {
      case 'ckd':
        if (nutrition.phosphorusDmb != null) {
          observations.push(`Combined phosphorus is ${nutrition.phosphorusDmb.toFixed(2)}% DMB.`);
        }
        if (nutrition.proteinDmb != null) {
          observations.push(`Combined protein is ${nutrition.proteinDmb.toFixed(1)}% DMB.`);
        }
        if (nutrition.moistureAsFed != null && nutrition.moistureAsFed < 50) {
          observations.push(`Combined moisture is ${nutrition.moistureAsFed.toFixed(0)}% — higher moisture supports hydration in CKD management.`);
        }
        break;

      case 'cardiac':
        if (nutrition.proteinDmb != null) {
          observations.push(`Combined protein is ${nutrition.proteinDmb.toFixed(1)}% DMB.`);
        }
        // Check for taurine/L-carnitine in diet
        {
          const hasTaurine = dietItems.some(d =>
            d.ingredients.some(i => i.toLowerCase().includes('taurine')),
          );
          if (!hasTaurine) {
            observations.push('No taurine detected in ingredient lists. Supplementation may be discussed.');
          }
        }
        break;

      case 'pancreatitis':
        if (nutrition.fatDmb != null) {
          const status = pet.species === 'dog'
            ? (nutrition.fatDmb > 12 ? 'above the 12% DMB threshold' : 'within the 12% DMB threshold')
            : 'not restricted for cats (feline pancreatitis is not triggered by dietary fat)';
          observations.push(`Combined fat is ${nutrition.fatDmb.toFixed(1)}% DMB — ${status}.`);
        }
        break;

      case 'diabetes':
        if (nutrition.fiberDmb != null && pet.species === 'dog') {
          observations.push(`Combined fiber is ${nutrition.fiberDmb.toFixed(1)}% DMB${nutrition.fiberDmb >= 5 ? ' (meets >5% target)' : ' (below >5% target)'}.`);
        }
        if (pet.species === 'cat' && nutrition.moistureAsFed != null) {
          const hasDry = dietItems.some(d => d.form === 'Dry');
          if (hasDry) {
            observations.push('Dry kibble in diet — low-carb wet food supports glycemic control in feline diabetes.');
          }
        }
        break;

      case 'obesity':
        if (nutrition.fatDmb != null) {
          observations.push(`Combined fat is ${nutrition.fatDmb.toFixed(1)}% DMB${nutrition.fatDmb < 14 ? ' (within <14% target)' : ''}.`);
        }
        if (nutrition.fiberDmb != null) {
          observations.push(`Combined fiber is ${nutrition.fiberDmb.toFixed(1)}% DMB${nutrition.fiberDmb >= 5 ? ' (meets >5% target)' : ''}.`);
        }
        break;

      case 'underweight':
        if (nutrition.kcalPerKgDmb != null) {
          observations.push(`Combined caloric density is ${Math.round(nutrition.kcalPerKgDmb)} kcal/kg DMB.`);
        }
        break;

      case 'gi_sensitive':
        if (nutrition.fatDmb != null && nutrition.fatDmb > 18) {
          observations.push(`Combined fat is ${nutrition.fatDmb.toFixed(1)}% DMB — exceeds the 18% threshold for GI sensitivity.`);
        }
        if (nutrition.fiberDmb != null) {
          observations.push(`Combined fiber is ${nutrition.fiberDmb.toFixed(1)}% DMB.`);
        }
        break;

      case 'skin':
        // Check for omega-3 in diet
        observations.push('Omega-3 (EPA/DHA) is beneficial for skin barrier repair and inflammation reduction.');
        break;

      case 'joint':
        observations.push('Marine-sourced omega-3 (EPA/DHA) is associated with reduced joint inflammation.');
        break;

      case 'urinary':
        if (nutrition.moistureAsFed != null) {
          observations.push(`Combined moisture is ${nutrition.moistureAsFed.toFixed(0)}% — higher moisture promotes urine dilution.`);
        }
        break;

      case 'hypothyroid':
        if (nutrition.fatDmb != null && nutrition.fatDmb > 16) {
          observations.push(`Combined fat is ${nutrition.fatDmb.toFixed(1)}% DMB — exceeds the 16% DMB threshold for hypothyroidism.`);
        }
        break;

      default:
        // No specific observations for liver, seizures, hyperthyroid, etc.
        break;
    }

    if (observations.length > 0) {
      notes.push({
        condition: tag,
        conditionLabel: CONDITION_LABELS[tag] ?? tag,
        observations,
      });
    }
  }

  return notes;
}

// ─── Treat Summary ──────────────────────────────────────

export function computeTreatSummary(
  petId: string,
  cards: PantryCardData[],
): TreatSummary | null {
  // Battery first — today's tracked treat consumption
  const battery = useTreatBatteryStore.getState();
  const today = getTodayStr();

  if (battery.lastResetDate === today) {
    const consumption = battery.consumedByPet[petId];
    if (consumption && consumption.count > 0) {
      return {
        avgDailyCount: consumption.count,
        avgDailyKcal: consumption.kcal > 0 ? consumption.kcal : null,
        source: 'battery',
        kcalIsEstimated: consumption.kcal === 0 && consumption.count > 0,
      };
    }
  }

  // Pantry fallback — sum of treat-category items' daily kcal
  const treatCards = cards.filter(c => c.product.category === 'treat');
  if (treatCards.length > 0) {
    let totalKcal = 0;
    let hasKcal = false;
    for (const card of treatCards) {
      const kcal = card.calorie_context?.daily_kcal ?? 0;
      if (kcal > 0) {
        totalKcal += kcal;
        hasKcal = true;
      }
    }
    return {
      avgDailyCount: treatCards.length,
      avgDailyKcal: hasKcal ? totalKcal : null,
      source: 'pantry',
      kcalIsEstimated: !hasKcal,
    };
  }

  // No data
  return null;
}

// ─── Weight Tracking ────────────────────────────────────

export function buildWeightTracking(pet: Pet): WeightTrackingData {
  const goalLevel = pet.weight_goal_level ?? 0;
  const driftLbs = pet.caloric_accumulator != null && pet.caloric_accumulator !== 0
    ? Math.round((pet.caloric_accumulator / KCAL_PER_LB) * 10) / 10
    : null;

  return {
    currentLbs: pet.weight_current_lbs ?? 0,
    bcsScore: pet.bcs_score ?? null,
    bcsDate: pet.bcs_assessed_at ?? null,
    goalLevel,
    goalLabel: GOAL_LABELS[goalLevel] ?? 'Maintain',
    estimatedDriftLbs: driftLbs,
    lastWeighed: pet.weight_updated_at ?? null,
  };
}
