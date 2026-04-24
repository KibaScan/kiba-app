// Kiba — Pantry Screen Helpers (pure, testable)
// Extracted from PantryScreen.tsx — zero behavior change.
// D-157: Mixed-feeding nudge logic. D-125: Recall alert (caller responsibility).

import { Colors } from './constants';
import type { PantryCardData, DietCompletenessResult } from '../types/pantry';

// ─── Types ──────────────────────────────────────────────

export type FilterChip = 'all' | 'dry' | 'wet' | 'treats' | 'supplemental' | 'recalled' | 'running_low';
export type SortOption = 'default' | 'name' | 'score' | 'days_remaining';

// ─── Helpers ────────────────────────────────────────────

export function filterItems(items: PantryCardData[], filter: FilterChip): PantryCardData[] {
  switch (filter) {
    case 'all': return items;
    case 'dry': return items.filter(i => i.product.product_form === 'dry');
    case 'wet': return items.filter(i => i.product.product_form === 'wet');
    case 'treats': return items.filter(i => i.product.category === 'treat');
    case 'supplemental': return items.filter(i => i.product.is_supplemental);
    case 'recalled': return items.filter(i => i.product.is_recalled);
    case 'running_low': return items.filter(i => i.is_low_stock && !i.is_empty);
  }
}

export function sortItems(items: PantryCardData[], sort: SortOption): PantryCardData[] {
  if (sort === 'default') return items;
  const sorted = [...items];
  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.product.name.localeCompare(b.product.name));
    case 'score':
      return sorted.sort((a, b) => (b.resolved_score ?? -1) - (a.resolved_score ?? -1));
    case 'days_remaining':
      return sorted.sort((a, b) => (a.days_remaining ?? Infinity) - (b.days_remaining ?? Infinity));
  }
}

export function shouldShowD157Nudge(
  removedItem: PantryCardData,
  remainingItems: PantryCardData[],
  petId: string,
): boolean {
  if (removedItem.product.category !== 'daily_food') return false;
  const removedAssignment = removedItem.assignments.find(a => a.pet_id === petId);
  if (!removedAssignment || removedAssignment.feeding_frequency !== 'daily') return false;
  return remainingItems.some(
    item => item.product.category === 'daily_food'
      && item.assignments.some(a => a.pet_id === petId && a.feeding_frequency === 'daily'),
  );
}

export function getDietBannerConfig(
  dietStatus: DietCompletenessResult | null,
): { show: boolean; color: string; message: string; dismissible: boolean } | null {
  if (!dietStatus) return null;
  if (dietStatus.status === 'complete' || dietStatus.status === 'empty') return null;
  if (dietStatus.status === 'info') {
    return { show: true, color: Colors.textSecondary, message: dietStatus.message ?? '', dismissible: true };
  }
  if (dietStatus.status === 'amber_warning') {
    return { show: true, color: Colors.severityAmber, message: dietStatus.message ?? '', dismissible: false };
  }
  if (dietStatus.status === 'red_warning') {
    return { show: true, color: Colors.severityRed, message: dietStatus.message ?? '', dismissible: false };
  }
  return null;
}
