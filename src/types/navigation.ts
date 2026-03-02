// Kiba — Navigation Type Definitions
// Typed param lists for React Navigation 7.x stack navigators

// ─── Stack Param Lists ─────────────────────────────────

export type ScanStackParamList = {
  ScanMain: undefined;
  Result: { productId: string; petId: string | null };
  CommunityContribution: { scannedUpc: string };
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Result: { productId: string; petId: string | null };
};

export type SearchStackParamList = {
  SearchMain: undefined;
  Result: { productId: string; petId: string | null };
};

export type PantryStackParamList = {
  PantryMain: undefined;
  Result: { productId: string; petId: string | null };
};

export type MeStackParamList = {
  MeMain: undefined;
  PetProfile: { petId: string };
  SpeciesSelect: undefined;
  CreatePet: { species: 'dog' | 'cat' };
  EditPet: { petId: string };
  HealthConditions: { petId: string; fromCreate?: boolean };
};

// ─── Root & Tab Navigators ─────────────────────────────

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Scan: undefined;
  Pantry: undefined;
  Me: undefined;
};
