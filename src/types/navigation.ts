// Kiba — Navigation Type Definitions
// Typed param lists for React Navigation 7.x stack navigators

// ─── Stack Param Lists ─────────────────────────────────

export type ScanStackParamList = {
  ScanMain: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  CommunityContribution: { scannedUpc: string };
  ProductConfirm: {
    scannedUpc: string;
    externalName: string | null;
    externalBrand: string | null;
    externalImageUrl: string | null;
  };
  IngredientCapture: {
    scannedUpc: string;
    productName: string | null;
    brand: string | null;
  };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  AppointmentDetail: { appointmentId: string };
  Compare: { productAId: string; productBId: string; petId: string };
  SafeSwitchDetail: { switchId: string };
};

export type CommunityStackParamList = {
  CommunityMain: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type PantryStackParamList = {
  PantryMain: undefined;
  EditPantryItem: { itemId: string };
  SafeSwitchSetup: { oldProductId: string; newProductId: string; petId: string };
  SafeSwitchDetail: { switchId: string };
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type MeStackParamList = {
  MeMain: undefined;
  PetProfile: { petId: string };
  SpeciesSelect: undefined;
  CreatePet: { species: 'dog' | 'cat' };
  EditPet: { petId: string };
  HealthConditions: { petId: string; fromCreate?: boolean };
  MedicationForm: {
    petId: string;
    petName: string;
    medication?: import('./pet').PetMedication;
    conditions: string[];
  };
  BCSReference: { petId: string };
  Appointments: undefined;
  CreateAppointment: undefined;
  AppointmentDetail: { appointmentId: string };
  NotificationPreferences: undefined;
  Settings: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

// ─── Paywall Trigger ─────────────────────────────────

export type PaywallTrigger =
  | 'scan_limit'
  | 'pet_limit'
  | 'safe_swap'
  | 'search'
  | 'compare'
  | 'vet_report'
  | 'elimination_diet'
  | 'appointment_limit';

// ─── Root & Tab Navigators ─────────────────────────────

export type RootStackParamList = {
  Terms: undefined;
  Onboarding: undefined;
  Main: undefined;
  Paywall: { trigger: PaywallTrigger; petName?: string };
};

export type TabParamList = {
  Home: undefined;
  Community: undefined;
  Scan: undefined;
  Pantry: undefined;
  Me: undefined;
};
