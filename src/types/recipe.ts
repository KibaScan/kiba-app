// Kiba — M9 Community Recipe Types
// Mirrors community_recipes table (migration 041) and the submission flow
// described in spec §6.1 (client-supplied UUID for atomic image-upload + insert).

export type RecipeSpecies = 'dog' | 'cat' | 'both';
export type RecipeLifeStage = 'puppy' | 'adult' | 'senior' | 'all';
export type RecipeStatus =
  | 'pending'
  | 'auto_rejected'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface SubmitRecipeInput {
  title: string;
  subtitle?: string;
  species: RecipeSpecies;
  life_stage: RecipeLifeStage;
  ingredients: RecipeIngredient[];
  prep_steps: string[];
  /** Local image URI from ImagePicker / camera. Uploaded to Storage before insert. */
  cover_image_uri: string;
}

export interface CommunityRecipe {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  species: RecipeSpecies;
  life_stage: RecipeLifeStage;
  ingredients: RecipeIngredient[];
  prep_steps: string[];
  cover_image_url: string | null;
  status: RecipeStatus;
  rejection_reason: string | null;
  is_killed: boolean;
  created_at: string;
  reviewed_at: string | null;
}

export type SubmitRecipeResult =
  | { status: 'auto_rejected'; reason: string; recipe_id: string }
  | { status: 'pending_review'; recipe_id: string };

export class RecipeOfflineError extends Error {
  constructor(message = 'Offline — recipes require a network connection.') {
    super(message);
    this.name = 'RecipeOfflineError';
  }
}
