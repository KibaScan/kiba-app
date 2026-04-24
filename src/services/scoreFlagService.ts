// Kiba — M9 Community Score Flag Service
// User-reported data quality issues (D-072). score_flags table: migration 045
// (RLS pins inserts to status='open', admin_note=NULL, reviewed_at=NULL).
// Aggregate counts via SECURITY DEFINER RPC: migration 049.
//
// Writes throw ScoreFlagOfflineError offline (pantryService convention).
// Reads return [] gracefully on offline / no-auth-user / DB error — mirrors
// blogService, recipeService, appointmentService per src/services/CLAUDE.md.
// A "couldn't load" UX, if needed, belongs at the hook/component layer.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import {
  ScoreFlagOfflineError,
  type ScoreFlag,
  type SubmitScoreFlagInput,
  type CommunityActivityCount,
} from '../types/scoreFlag';

const TABLE = 'score_flags';
const COLUMNS = 'id, user_id, pet_id, product_id, scan_id, reason, detail, status, admin_note, created_at, reviewed_at';

// ─── Internal ───────────────────────────────────────────

async function requireOnline(): Promise<void> {
  if (!(await isOnline())) throw new ScoreFlagOfflineError();
}

// ─── Write Functions ────────────────────────────────────

/**
 * Insert a new score flag for the current user. Returns the inserted row.
 * Migration 045 RLS WITH CHECK pins status='open', admin_note=NULL,
 * reviewed_at=NULL — we rely on column defaults rather than setting them.
 */
export async function submitFlag(input: SubmitScoreFlagInput): Promise<ScoreFlag> {
  await requireOnline();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Not authenticated — cannot submit score flag.');

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      pet_id: input.pet_id,
      product_id: input.product_id,
      scan_id: input.scan_id ?? null,
      reason: input.reason,
      detail: input.detail ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert score flag: ${error?.message ?? 'unknown error'}`);
  }

  return data as ScoreFlag;
}

// ─── Read Functions ─────────────────────────────────────

/**
 * Fetch the current user's flags, newest first. Returns [] on offline,
 * when there is no auth user, or on DB error (codebase convention — see
 * src/services/CLAUDE.md). "Couldn't load" UX belongs at hook/component.
 */
export async function fetchMyFlags(): Promise<ScoreFlag[]> {
  if (!(await isOnline())) return [];

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return [];

  // Index score_flags_user_idx is (user_id, created_at DESC) — match it so
  // PostgREST scans the index.
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[fetchMyFlags] FAILED:', error.message);
    return [];
  }

  return (data ?? []) as ScoreFlag[];
}

/**
 * Aggregate flag-reason counts over the past 7 days, across all users.
 * Backed by SECURITY DEFINER RPC (migration 049) — no PII surfaced, only
 * reason + count. Used by the Community Activity tab on SafetyFlagsScreen.
 * Returns [] on offline or RPC error (codebase convention).
 */
export async function fetchCommunityActivityCounts(): Promise<CommunityActivityCount[]> {
  if (!(await isOnline())) return [];

  const { data, error } = await supabase.rpc('get_score_flag_activity_counts');

  if (error) {
    console.warn('[fetchCommunityActivityCounts] FAILED:', error.message);
    return [];
  }

  return (data ?? []) as CommunityActivityCount[];
}
