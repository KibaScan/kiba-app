// Kiba — Toxic Database (Task 21 of M9 Community plan)
// Canonical type for the curated entries in `src/data/toxic_foods.json`.
// Single source of truth — both `validateRecipeSubmission` (Edge Function
// dependency) and `ToxicDatabaseScreen` import from here.

export type ToxicSeverity = 'toxic' | 'caution' | 'safe';

export type ToxicCategory = 'food' | 'plant' | 'medication' | 'household';

export interface ToxicReference {
  label: string;
  url: string;
}

export interface ToxicEntry {
  id: string;
  name: string;
  alt_names: string[];
  category: ToxicCategory;
  species_severity: { dog: ToxicSeverity; cat: ToxicSeverity };
  symptoms: string[];
  safe_threshold_note: string | null;
  references: ToxicReference[];
}
