// Kiba — M9 Community XP Types
// Mirrors get_user_xp_summary() RPC (migration 048) plus client-derived
// level/progress/next_threshold via levelForXP (src/utils/xpLevel.ts).

export interface XPSummary {
  total_xp: number;
  level: number;
  progress_pct: number;
  next_threshold: number;
  weekly_xp: number;
  streak_current_days: number;
  streak_longest_days: number;
  scans_count: number;
  discoveries_count: number;
  contributions_count: number;
}
