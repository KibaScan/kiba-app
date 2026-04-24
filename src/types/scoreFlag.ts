// Kiba — M9 Community Score Flag Types
// Mirrors score_flags table (migration 045, RLS pins inserts to status='open',
// admin_note=NULL, reviewed_at=NULL) + the aggregate RPC from migration 049.
// D-072 — community-reported data quality issues; admin reviews via Studio.

export type ScoreFlagReason =
  | 'score_wrong'
  | 'ingredient_missing'
  | 'recalled'
  | 'data_outdated'
  | 'recipe_concern'
  | 'other';

export type ScoreFlagStatus = 'open' | 'reviewed' | 'resolved' | 'rejected';

export interface ScoreFlag {
  id: string;
  user_id: string;
  pet_id: string;
  product_id: string;
  scan_id: string | null;
  reason: ScoreFlagReason;
  detail: string | null;
  status: ScoreFlagStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface SubmitScoreFlagInput {
  pet_id: string;
  product_id: string;
  scan_id?: string;
  reason: ScoreFlagReason;
  detail?: string;
}

export interface CommunityActivityCount {
  reason: ScoreFlagReason;
  count: number;
}

export class ScoreFlagOfflineError extends Error {
  constructor(message = 'Offline — flag submission requires a network connection.') {
    super(message);
    this.name = 'ScoreFlagOfflineError';
  }
}
