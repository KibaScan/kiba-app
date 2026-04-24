-- Migration 048: get_user_xp_summary() RPC
-- Read-only summary RPC for the currently-authenticated user.
-- SECURITY DEFINER owned by postgres for consistency with migration 046 triggers
-- and defense against future RLS tightening on user_xp_events /
-- user_xp_totals (SELECT-only for auth.uid()).
-- SET search_path = public, pg_temp — injection-safe (same pattern as 046).
--
-- Cache invalidation not needed: does not affect pet_product_scores inputs.

CREATE OR REPLACE FUNCTION get_user_xp_summary()
RETURNS TABLE (
  total_xp INT,
  scans_count INT,
  discoveries_count INT,
  contributions_count INT,
  streak_current_days INT,
  streak_longest_days INT,
  weekly_xp INT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(t.total_xp, 0),
    COALESCE(t.scans_count, 0),
    COALESCE(t.discoveries_count, 0),
    COALESCE(t.contributions_count, 0),
    COALESCE(t.streak_current_days, 0),
    COALESCE(t.streak_longest_days, 0),
    COALESCE((
      SELECT SUM(xp_delta)::INT FROM user_xp_events
      WHERE user_id = v_user
        AND created_at >= (date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    ), 0)
  FROM (SELECT NULL::INT) AS dummy
  LEFT JOIN user_xp_totals t ON t.user_id = v_user;
END;
$$;

ALTER FUNCTION get_user_xp_summary() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_user_xp_summary() TO authenticated;
