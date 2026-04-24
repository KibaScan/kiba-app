-- Migration 051: XP idempotency + discovery race lock + anon REVOKE hardening
--
-- Fixes three issues surfaced by the post-shipping review of 046:
--   1. DELETE → re-INSERT XP farming on scan_history / kiba_index_votes
--      (both tables are FOR ALL user-owned → DELETE permitted; INSERT-fired
--      trigger re-awards XP). Guard by checking user_xp_events (append-only,
--      SELECT-only RLS → source of truth for "already earned").
--   2. Discovery XP race under READ COMMITTED: two concurrent first-scans
--      of the same product can both pass the NOT EXISTS check and both be
--      awarded +50. Serialize with a transaction-scoped advisory lock.
--   3. Defense-in-depth: Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE
--      to anon, authenticated, service_role on every public function. The
--      explicit `GRANT EXECUTE TO authenticated` in 048/049 is redundant
--      AND the anon grant is present by default. Revoke from anon.
--
-- CREATE OR REPLACE FUNCTION preserves the existing trigger bindings (the
-- CREATE TRIGGER references the function by name, not by OID).
--
-- Cache invalidation not needed: does not affect pet_product_scores inputs.


-- ============== 1. process_scan_xp — idempotency + discovery advisory lock ==============
CREATE OR REPLACE FUNCTION process_scan_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today          DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_existing       user_xp_totals%ROWTYPE;
  v_gap_days       INT;
  v_is_discovery   BOOLEAN;
  v_already_earned BOOLEAN;
BEGIN
  -- Idempotency: a given user earns scan XP for a given product at most
  -- once, lifetime. Checks user_xp_events (append-only) rather than
  -- scan_history (user-deletable) so DELETE → re-INSERT does not re-award.
  v_already_earned := EXISTS (
    SELECT 1 FROM user_xp_events
    WHERE user_id    = NEW.user_id
      AND product_id = NEW.product_id
      AND event_type = 'scan'
  );

  IF NOT v_already_earned THEN
    -- Base scan XP
    INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id)
    VALUES (NEW.user_id, 'scan', 10, NEW.product_id);
    PERFORM upsert_user_xp_totals(NEW.user_id, 10, 'scan');

    -- Discovery bonus: first time ANY user has scanned this product.
    -- Advisory xact lock serializes concurrent first-scans of the same
    -- product so two users racing cannot both pass NOT EXISTS and both
    -- be awarded +50. Released automatically at transaction end.
    -- Check user_xp_events ('discovery' is the append-only truth) rather
    -- than scan_history so a deleted-and-reinserted scan cannot re-trigger.
    PERFORM pg_advisory_xact_lock(hashtext('kiba.discovery:' || NEW.product_id::TEXT));

    v_is_discovery := NOT EXISTS (
      SELECT 1 FROM user_xp_events
      WHERE product_id = NEW.product_id
        AND event_type = 'discovery'
    );

    IF v_is_discovery THEN
      INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id)
      VALUES (NEW.user_id, 'discovery', 50, NEW.product_id);
      PERFORM upsert_user_xp_totals(NEW.user_id, 50, 'discovery');
    END IF;
  END IF;

  -- Streak update runs on every insert. Same-day (gap=0) is a no-op;
  -- cross-day re-scan of a previously-earned product still extends the
  -- streak (that's legitimate user activity, not farming).
  SELECT * INTO v_existing FROM user_xp_totals WHERE user_id = NEW.user_id;

  IF v_existing.streak_last_scan_date IS NULL THEN
    UPDATE user_xp_totals SET
      streak_current_days   = 1,
      streak_longest_days   = GREATEST(streak_longest_days, 1),
      streak_last_scan_date = v_today
    WHERE user_id = NEW.user_id;
  ELSE
    v_gap_days := v_today - v_existing.streak_last_scan_date;
    IF v_gap_days < 0 THEN
      UPDATE user_xp_totals SET
        streak_current_days   = 1,
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;
    ELSIF v_gap_days = 0 THEN
      NULL;
    ELSIF v_gap_days <= 2 THEN
      UPDATE user_xp_totals SET
        streak_current_days   = streak_current_days + 1,
        streak_longest_days   = GREATEST(streak_longest_days, streak_current_days + 1),
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;
    ELSE
      UPDATE user_xp_totals SET
        streak_current_days   = 1,
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION process_scan_xp() OWNER TO postgres;


-- ============== 2. process_vote_xp — idempotency ==============
CREATE OR REPLACE FUNCTION process_vote_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verified-knowledge gate: user must have a prior scan of this product.
  -- AND idempotency: vote XP awarded at most once per (user, product) pair,
  -- even if the vote row is deleted and re-inserted.
  IF EXISTS (
    SELECT 1 FROM scan_history
    WHERE user_id    = NEW.user_id
      AND product_id = NEW.product_id
    LIMIT 1
  ) AND NOT EXISTS (
    SELECT 1 FROM user_xp_events
    WHERE user_id    = NEW.user_id
      AND product_id = NEW.product_id
      AND event_type = 'vote_verified'
  ) THEN
    INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id, vote_id)
    VALUES (NEW.user_id, 'vote_verified', 15, NEW.product_id, NEW.id);
    PERFORM upsert_user_xp_totals(NEW.user_id, 15, 'vote_verified');
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION process_vote_xp() OWNER TO postgres;


-- ============== 3. Defense-in-depth REVOKE on public RPCs ==============
-- Supabase's default setup grants EXECUTE on every public-schema routine
-- to anon, authenticated, service_role via ALTER DEFAULT PRIVILEGES. The
-- explicit `GRANT EXECUTE TO authenticated` in 048/049 is therefore
-- redundant for authenticated, and anon has uninvited access by default.
-- Revoke PUBLIC + anon; authenticated retains via its explicit grant.
REVOKE EXECUTE ON FUNCTION get_user_xp_summary()             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_score_flag_activity_counts()  FROM PUBLIC, anon;
