-- 049_score_flag_aggregate_rpc.sql
-- D-072 community safety flag aggregate counts for past 7 days.
-- SECURITY DEFINER because score_flags has user-scoped RLS — this aggregate
-- view sums across ALL users, which is intentional (anonymized count only).
-- No PII surfaced — returns reason + count only.
-- Used by the Community Activity tab on SafetyFlagsScreen so users see
-- "47 reports submitted this week" without exposing per-row PII.
-- SET search_path = public, pg_temp — injection-safe (mirrors migrations 046, 048).
--
-- Cache invalidation not needed: does not affect pet_product_scores inputs.

CREATE OR REPLACE FUNCTION get_score_flag_activity_counts()
RETURNS TABLE (reason TEXT, count INT)
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT reason, COUNT(*)::INT
  FROM score_flags
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY reason
  ORDER BY COUNT(*) DESC;
$$;

ALTER FUNCTION get_score_flag_activity_counts() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_score_flag_activity_counts() TO authenticated;
