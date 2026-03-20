// Kiba — M5 Recall Siren Types
// Matches recall_log, recall_review_queue, recall_notifications tables (migration 016).

/** Matches recall_log table exactly (7 columns). */
export interface RecallEntry {
  id: string;
  product_id: string;
  recall_date: string | null;
  reason: string | null;
  fda_url: string | null;
  lot_numbers: string[] | null;
  detected_at: string;
}

/** Matches recall_review_queue table exactly (7 columns). */
export interface RecallReviewEntry {
  id: string;
  fda_entry_title: string;
  fda_entry_url: string | null;
  matched_product_id: string | null;
  match_confidence: 'medium' | 'low';
  reviewed: boolean;
  reviewed_at: string | null;
  created_at: string;
}

/** Matches recall_notifications table exactly (4 columns). */
export interface RecallNotification {
  id: string;
  user_id: string;
  product_id: string;
  notified_at: string;
}
