// Kiba — Navigation Type Definitions
// Typed param lists for React Navigation 7.x stack navigators

import { Product } from './index';

// ─── Stack Param Lists ─────────────────────────────────

export type ScanStackParamList = {
  ScanMain: undefined;
  Result: { product: Product; petId: string };
  CommunityContribution: { scannedUpc: string };
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Result: { product: Product; petId: string };
};

export type SearchStackParamList = {
  SearchMain: undefined;
  Result: { product: Product; petId: string };
};

export type PantryStackParamList = {
  PantryMain: undefined;
  Result: { product: Product; petId: string };
};

export type MeStackParamList = {
  MeMain: undefined;
  PetProfile: { petId: string };
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
