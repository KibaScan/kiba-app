// Kiba — M9 Community XP Service
// Read-only summary backed by get_user_xp_summary() RPC (migration 048).
// Level + progress + next_threshold are derived client-side via levelForXP.
// No offline guard: this is a read; per pantryService convention reads either
// surface live data or null/empty. The summary RPC requires auth so callers
// already gate visibility — we just propagate any error up.

import { supabase } from './supabase';
import { levelForXP } from '../utils/xpLevel';
import type { XPSummary } from '../types/xp';

interface XPSummaryRow {
  total_xp: number;
  scans_count: number;
  discoveries_count: number;
  contributions_count: number;
  streak_current_days: number;
  streak_longest_days: number;
  weekly_xp: number;
}

const EMPTY_ROW: XPSummaryRow = {
  total_xp: 0,
  scans_count: 0,
  discoveries_count: 0,
  contributions_count: 0,
  streak_current_days: 0,
  streak_longest_days: 0,
  weekly_xp: 0,
};

export async function fetchXPSummary(): Promise<XPSummary> {
  const { data, error } = await supabase.rpc('get_user_xp_summary');
  if (error) throw error;

  // The RPC RETURNS TABLE so PostgREST hands back an array. New users have
  // a LEFT JOIN miss → the SQL still emits a single all-zero row, but we
  // also fall back here so a hypothetical empty array doesn't crash callers.
  const row: XPSummaryRow = (data as XPSummaryRow[] | null)?.[0] ?? EMPTY_ROW;

  const lvl = levelForXP(row.total_xp);

  return {
    total_xp: row.total_xp,
    level: lvl.level,
    progress_pct: lvl.progress,
    next_threshold: lvl.nextThreshold,
    weekly_xp: row.weekly_xp,
    streak_current_days: row.streak_current_days,
    streak_longest_days: row.streak_longest_days,
    scans_count: row.scans_count,
    discoveries_count: row.discoveries_count,
    contributions_count: row.contributions_count,
  };
}
