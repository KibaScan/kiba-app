// Pure helpers for CategoryTopPicksScreen — title + label resolution.
// Extracted for unit testability (keep screen file lean).

import { SUB_FILTERS } from '../types/categoryBrowse';
import type { BrowseCategory } from '../types/categoryBrowse';

export function getCategoryTitle(category: BrowseCategory): string {
  switch (category) {
    case 'daily_food': return 'Daily Food';
    case 'toppers_mixers': return 'Toppers & Mixers';
    case 'treat': return 'Treats';
    case 'supplement': return 'Supplements';
  }
}

export function getFilterLabel(
  category: BrowseCategory,
  subFilterKey: string | null,
): string | null {
  if (!subFilterKey) return null;
  const def = SUB_FILTERS[category].find((f) => f.key === subFilterKey);
  return def?.label ?? null;
}

export function getTopPicksTitle(
  category: BrowseCategory,
  subFilterKey: string | null,
  petName: string,
): string {
  const filterLabel = getFilterLabel(category, subFilterKey);
  if (!filterLabel) {
    return `Top ${getCategoryTitle(category)} for ${petName}`;
  }
  if (category === 'daily_food') {
    return `Top ${filterLabel} Food for ${petName}`;
  }
  if (category === 'toppers_mixers') {
    return `Top ${filterLabel} Toppers for ${petName}`;
  }
  // treats / supplements — sub-filter already reads as a full noun phrase
  return `Top ${filterLabel} for ${petName}`;
}
