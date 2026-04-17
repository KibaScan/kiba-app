// Category browse types for HomeScreen search overhaul

/** The four top-level categories shown on HomeScreen */
export type BrowseCategory = 'daily_food' | 'toppers_mixers' | 'treat' | 'supplement';

/** Sub-filter definition for chip row */
export interface SubFilterDef {
  key: string;
  label: string;
}

/** A single browse result row */
export interface BrowseProduct {
  product_id: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
  final_score: number | null; // null for supplements + vet diets (unscored)
  is_supplemental: boolean;
  is_vet_diet: boolean;
}

/** Paginated browse response */
export interface BrowsePage {
  products: BrowseProduct[];
  nextCursor: string | null;
}

/** Expanded BrowseProduct for Top Picks screen — insight-source fields joined in */
export interface TopPickEntry extends BrowseProduct {
  ga_protein_pct: number | null;
  ga_fat_pct: number | null;
  ga_moisture_pct: number | null;
  ga_protein_dmb_pct: number | null;  // migration 020 — pre-computed when available
  ga_fat_dmb_pct: number | null;
  preservative_type: 'natural' | 'synthetic' | 'mixed' | 'unknown' | null;
  aafco_statement: string | null;
  life_stage_claim: string | null;
  /** Top 10 ingredients with allergen_group — from product_ingredients + ingredients_dict */
  top_ingredients: Array<{ position: number; canonical_name: string; allergen_group: string | null }>;
}

/** A single insight bullet rendered on Hero or Rank Row. Priority key drives ordering + cap. */
export type InsightKind =
  | 'allergen_safe'
  | 'life_stage'
  | 'macro_fat'
  | 'macro_protein'
  | 'preservative'
  | 'quality_tier';

export interface InsightBullet {
  kind: InsightKind;
  /** Display text — already interpolated, already UPVM-compliant */
  text: string;
}

/** Counts returned by get_browse_counts RPC */
export interface BrowseCounts {
  daily_food: number;
  toppers_mixers: number;
  treat: number;
  supplement: number;
  daily_dry: number;
  daily_wet: number;
  daily_freeze_dried: number;
  daily_vet_diet: number;
  daily_other: number;
}

// ─── Sub-filter definitions per category ───────────────────

export const DAILY_FOOD_FILTERS: SubFilterDef[] = [
  { key: 'dry', label: 'Dry' },
  { key: 'wet', label: 'Wet' },
  { key: 'freeze_dried', label: 'Freeze-Dried' },
  { key: 'vet_diet', label: 'Vet Diet' },
  { key: 'other', label: 'Other' },
];

export const TOPPERS_FILTERS: SubFilterDef[] = [
  { key: 'wet', label: 'Wet' },
  { key: 'freeze_dried', label: 'Freeze-Dried' },
  { key: 'dry', label: 'Dry' },
];

export const TREAT_FILTERS: SubFilterDef[] = [
  { key: 'crunchy_biscuits', label: 'Crunchy & Biscuits' },
  { key: 'jerky_chews', label: 'Jerky & Chews' },
  { key: 'freeze_dried', label: 'Freeze-Dried' },
  { key: 'lickables', label: 'Lickables & Purees' },
  { key: 'dental', label: 'Dental' },
];

export const SUPPLEMENT_FILTERS: SubFilterDef[] = [
  { key: 'joint_hip', label: 'Joint & Hip' },
  { key: 'skin_coat', label: 'Skin & Coat' },
  { key: 'digestive', label: 'Digestive' },
  { key: 'calming', label: 'Calming' },
];

export const SUB_FILTERS: Record<BrowseCategory, SubFilterDef[]> = {
  daily_food: DAILY_FOOD_FILTERS,
  toppers_mixers: TOPPERS_FILTERS,
  treat: TREAT_FILTERS,
  supplement: SUPPLEMENT_FILTERS,
};
