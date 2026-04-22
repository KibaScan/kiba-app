import { ImageSourcePropType } from 'react-native';

// ─── Category Icons (HomeScreen main categories) ────────
// Outline = inactive, Filled = active (line-to-solid transition)
export const CATEGORY_ICONS: Record<string, ImageSourcePropType> = {
  daily_food: require('../../assets/Icons/categories/daily-food.png'),
  toppers_mixers: require('../../assets/Icons/categories/toppers-mixers.png'),
  treat: require('../../assets/Icons/categories/treats.png'),
  supplement: require('../../assets/Icons/categories/supplements.png'),
} as const;

export const CATEGORY_ICONS_FILLED: Record<string, ImageSourcePropType> = {
  daily_food: require('../../assets/Icons/categories/daily-food-filled.png'),
  toppers_mixers: require('../../assets/Icons/categories/toppers-mixers-filled.png'),
  treat: require('../../assets/Icons/categories/treats-filled.png'),
  supplement: require('../../assets/Icons/categories/supplements-filled.png'),
} as const;

// ─── Health Condition Icons (keyed by pet_conditions.condition_tag) ────
// V1 thin-stroke PNGs — pending V2 bold re-gen per docs/specs/custom-icon-spec.md.
// Keys match src/data/conditions.ts `tag` values (NOT the spec file's long-form
// labels — spec describes an aspirational map, code uses DB-truth short forms).
// Conditions without a matching asset (`allergy`, `hyperthyroid`) fall through to
// the Ionicon in conditions.ts at render time.
export const CONDITION_ICONS: Record<string, ImageSourcePropType> = {
  joint: require('../../assets/Icons/conditions/joint-issues.png'),
  gi_sensitive: require('../../assets/Icons/conditions/stomach-icon-24.png'),
  obesity: require('../../assets/Icons/conditions/overweight.png'),
  diabetes: require('../../assets/Icons/conditions/diabetes.png'),
  ckd: require('../../assets/Icons/conditions/kidney-disease.png'),
  urinary: require('../../assets/Icons/conditions/urinary-issues.png'),
  pancreatitis: require('../../assets/Icons/conditions/pancreatitis.png'),
  skin: require('../../assets/Icons/conditions/skin-coat-issues.png'),
  hypothyroid: require('../../assets/Icons/conditions/hypothyroidism.png'),
  liver: require('../../assets/Icons/conditions/liver-disease.png'),
  seizures: require('../../assets/Icons/conditions/seizures-epilepsy.png'),
} as const;

// ─── Type-safe key types ─────────────────────────────────
type CategoryKey = keyof typeof CATEGORY_ICONS;
type ConditionKey = keyof typeof CONDITION_ICONS;
