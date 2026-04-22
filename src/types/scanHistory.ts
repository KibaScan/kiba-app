// Scan history types — used by scanHistoryService, HomeScreen, and CompareProductPickerSheet.

export interface ScanHistoryItem {
  id: string;
  product_id: string;
  pet_id: string;
  final_score: number | null;
  scanned_at: string;
  product: {
    name: string;
    brand: string;
    image_url: string | null;
    category: 'daily_food' | 'treat' | 'supplement';
    is_supplemental: boolean;
    is_recalled: boolean;
    is_vet_diet: boolean;
  };
}
