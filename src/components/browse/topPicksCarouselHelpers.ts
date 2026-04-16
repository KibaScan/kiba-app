import type { BrowseCategory } from '../../types/categoryBrowse';

/** Routes See All tap to the right destination — supplements skip Top Picks. */
export function resolveSeeAllDestination(
  category: BrowseCategory | null,
): 'CategoryTopPicks' | 'CategoryBrowse' {
  if (category === 'supplement') return 'CategoryBrowse';
  return 'CategoryTopPicks';
}
