// Kiba — M5 Pantry Types
// Matches pantry_items + pantry_pet_assignments tables (migration 011).

// Union types matching SQL CHECK constraints
export type ServingMode = 'weight' | 'unit';
export type QuantityUnit = 'lbs' | 'oz' | 'kg' | 'g' | 'units';
export type ServingSizeUnit = 'cups' | 'scoops' | 'units';
export type FeedingFrequency = 'daily' | 'as_needed';
export type UnitLabel = 'servings';

// ─── DB Interfaces ──────────────────────────────────────

/** Matches pantry_items table exactly (13 columns). */
export interface PantryItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity_original: number;
  quantity_remaining: number;
  quantity_unit: QuantityUnit;
  serving_mode: ServingMode;
  unit_label: UnitLabel | null;
  added_at: string;
  is_active: boolean;
  last_deducted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Matches pantry_pet_assignments table exactly (11 columns). */
export interface PantryPetAssignment {
  id: string;
  pantry_item_id: string;
  pet_id: string;
  serving_size: number;
  serving_size_unit: ServingSizeUnit;
  feedings_per_day: number;
  feeding_frequency: FeedingFrequency;
  feeding_times: string[] | null;
  notifications_on: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Composite / Computed Interfaces ────────────────────

/** Extends PantryItem with nested product from Supabase select('*, products(*)'). */
export interface PantryItemWithProduct extends PantryItem {
  product: {
    name: string;
    brand: string;
    image_url: string | null;
    product_form: string | null;
    is_supplemental: boolean;
    is_recalled: boolean;
    is_vet_diet: boolean;
    target_species: string;
    category: string;
    base_score: number | null;
    ga_kcal_per_cup: number | null;
    ga_kcal_per_kg: number | null;
    kcal_per_unit: number | null;
    unit_weight_g: number | null;
    aafco_statement: string | null;
    life_stage_claim: string | null;
  };
}

export interface CalorieContext {
  daily_kcal: number;
  target_kcal: number;
  source: 'label' | 'estimated' | null;
}

export interface PantryCardData extends PantryItemWithProduct {
  assignments: PantryPetAssignment[];
  days_remaining: number | null;
  is_low_stock: boolean;
  is_empty: boolean;
  calorie_context: CalorieContext | null;
  /** D-156 resolved score: pet_product_scores → scan_history → base_score → null */
  resolved_score: number | null;
}

export interface DietCompletenessResult {
  status: 'complete' | 'amber_warning' | 'red_warning' | 'empty';
  message: string | null;
}

export interface AddToPantryInput {
  product_id: string;
  quantity_original: number;
  quantity_unit: QuantityUnit;
  serving_mode: ServingMode;
  unit_label?: UnitLabel;
  serving_size: number;
  serving_size_unit: ServingSizeUnit;
  feedings_per_day: number;
  feeding_frequency: FeedingFrequency;
  feeding_times?: string[];
}

export interface DepletionBreakdown {
  rateText: string;
  daysText: string | null;
}

export interface BudgetWarning {
  level: 'over' | 'significantly_over' | 'under';
  message: string;
  pct: number;
}

// ─── Error Class ────────────────────────────────────────

export class PantryOfflineError extends Error {
  constructor() {
    super('Connect to the internet to update your pantry.');
    this.name = 'PantryOfflineError';
  }
}
