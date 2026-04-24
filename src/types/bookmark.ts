// Kiba — M9 Bookmarks Types
// Matches bookmarks table (migration 040). Mirrors src/types/pantry.ts pattern.

export interface Bookmark {
  id: string;
  user_id: string;
  pet_id: string;
  product_id: string;
  created_at: string;
}

/**
 * Composite view for rendering: bookmark + joined product info + live match score.
 * Mirrors PantryCardData pattern.
 */
export interface BookmarkCardData {
  bookmark: Bookmark;
  product: {
    id: string;
    brand: string;
    name: string;
    category: 'daily_food' | 'treat';
    image_url: string | null;
    is_recalled: boolean;
    is_vet_diet: boolean;
    is_variety_pack: boolean;
    is_supplemental: boolean;
    target_species: 'dog' | 'cat';
  };
  /** Live score from pet_product_scores cache; null if unscored/bypass */
  final_score: number | null;
}

export const MAX_BOOKMARKS_PER_PET = 20;

export class BookmarkOfflineError extends Error {
  constructor() {
    super('You are offline. Bookmarks cannot be modified.');
    this.name = 'BookmarkOfflineError';
  }
}

export class BookmarksFullError extends Error {
  constructor() {
    super(`Bookmark limit reached (${MAX_BOOKMARKS_PER_PET}). Remove one to save another.`);
    this.name = 'BookmarksFullError';
  }
}
