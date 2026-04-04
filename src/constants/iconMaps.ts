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

// ─── Type-safe key types ─────────────────────────────────
export type CategoryKey = keyof typeof CATEGORY_ICONS;
