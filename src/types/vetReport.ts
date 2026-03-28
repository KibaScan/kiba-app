// Kiba — M6 Vet Report Types
// All interfaces for the vet report data assembly pipeline.
// See M6_VET_REPORT_SPEC_v2.md for field semantics.

import type { Pet, PetConditionDetail, PetMedication } from './pet';
import type { Appointment, PetHealthRecord } from './appointment';

// ─── Top-Level Report Data ──────────────────────────────

export interface VetReportData {
  pet: Pet;
  conditionTags: string[];               // from pet_conditions table (condition_tag field)
  conditionDetails: PetConditionDetail[]; // from pet_condition_details (sub-type/severity)
  allergens: string[];
  medications: PetMedication[];
  dietItems: VetReportDietItem[];
  combinedNutrition: CombinedNutrition;
  supplementNutrients: SupplementNutrient[];
  flags: VetReportFlag[];
  conditionNotes: ConditionNote[];
  healthRecords: { vaccinations: PetHealthRecord[]; dewormings: PetHealthRecord[] };
  upcomingAppointments: Appointment[];
  treatSummary: TreatSummary | null;
  weightTracking: WeightTrackingData;
  adjustedDER: number;
  caloricBalance: number;               // actual intake - adjusted DER
  ownerDietaryCards: OwnerDietaryCard[];
  conditionConflicts: ConflictNote[];
  generatedAt: string;
}

// ─── Diet Items ─────────────────────────────────────────

export interface VetReportDietItem {
  productName: string;
  brand: string;
  form: string;           // 'Dry' | 'Wet' | 'Top' | 'Supp' | 'Treat'
  servingDisplay: string;  // "1.5 cups × 2/day"
  dailyKcal: number;
  category: string;
  isSupplemental: boolean;
  isRecalled: boolean;
  aafcoStatement: string | null;
  gaProtein: number | null;
  gaFat: number | null;
  gaFiber: number | null;
  gaMoisture: number | null;
  gaCalcium: number | null;
  gaPhosphorus: number | null;
  gaKcalPerKg: number | null;
  ingredients: string[];   // first 10 canonical names
  allergenFlags: string[]; // allergens found in this product
}

// ─── Combined Nutritional Profile ───────────────────────

export interface CombinedNutrition {
  proteinAsFed: number | null;
  proteinDmb: number | null;
  fatAsFed: number | null;
  fatDmb: number | null;
  fiberAsFed: number | null;
  fiberDmb: number | null;
  moistureAsFed: number | null;
  calciumAsFed: number | null;
  calciumDmb: number | null;
  phosphorusAsFed: number | null;
  phosphorusDmb: number | null;
  kcalPerKg: number | null;
  kcalPerKgDmb: number | null;
  aafcoChecks: AafcoCheck[];
}

export interface AafcoCheck {
  nutrient: string;
  dmbValue: number | null;
  threshold: number;
  passes: boolean;
  label: string;     // "≥18.0%"
}

// ─── Supplemental Nutrients ─────────────────────────────
// EPA intentionally excluded — ga_epa_pct does not exist on Product type.

export interface SupplementNutrient {
  name: string;      // "Omega-3", "DHA", "Omega-6", "Taurine", "L-Carnitine", "Zinc", "Probiotics"
  value: string;     // "0.8%" or "present"
  unit: string;      // "%" or "mg/kg" or ""
  sources: string[]; // product names providing this nutrient
}

// ─── Flags ──────────────────────────────────────────────

export type FlagType =
  | 'recall'
  | 'allergen'
  | 'aafco'
  | 'supplemental_only'
  | 'caloric'
  | 'treat'
  | 'dcm'
  | 'no_recall';

export interface VetReportFlag {
  priority: number;
  type: FlagType;
  icon: string;      // "⚠" or "ℹ"
  label: string;     // "ALLERGEN"
  message: string;
}

// ─── Condition Notes ────────────────────────────────────

export interface ConditionNote {
  condition: string;
  conditionLabel: string;
  observations: string[];
}

// ─── Weight Tracking ────────────────────────────────────

export interface WeightTrackingData {
  currentLbs: number;
  bcsScore: number | null;
  bcsDate: string | null;
  goalLevel: number;
  goalLabel: string;
  estimatedDriftLbs: number | null;  // = caloric_accumulator / 3500
  lastWeighed: string | null;
}

// ─── Treat Summary ──────────────────────────────────────

export interface TreatSummary {
  avgDailyCount: number;
  avgDailyKcal: number | null;        // null when count is known but kcal is not
  source: 'battery' | 'pantry';       // which fallback was used
  kcalIsEstimated: boolean;           // true when kcal data is incomplete
}

// ─── Owner Dietary Reference Cards ──────────────────────

export interface OwnerDietaryCard {
  conditionKey: string;     // uses scoring tags: 'ckd', 'cardiac', 'gi_sensitive', etc.
  conditionLabel: string;
  goal: string;
  lookFor: string;
  avoid: string;
  caloricNote: string | null;
  note: string | null;
  citation: string;
  speciesCallout: string | null;
}

// ─── Condition Conflict Detection ───────────────────────

export interface ConflictNote {
  conditions: [string, string];
  note: string;
}
