-- Migration 046: XP Triggers (SECURITY DEFINER, idempotent)
-- Adds database-layer trigger functions that award XP on user actions.
-- All functions MUST be SECURITY DEFINER owned by postgres because
-- user_xp_events and user_xp_totals have no INSERT/UPDATE RLS policy
-- (SELECT-only for auth.uid()). A function running as the invoking user
-- would hit the RLS wall and roll back the originating transaction.
-- Pattern matches 026_kiba_index.sql get_kiba_index_stats.
--
-- Verified SCAN_TABLE = scan_history (ResultScreen.tsx:317).
-- Note: the bypass guard at ResultScreen.tsx:313 (!result.bypass) means
-- vet diet, species mismatch, variety pack, and recalled products do NOT
-- fire this trigger — scan_history rows are never inserted for them.
--
-- Cache invalidation not needed: user_xp_* is orthogonal to
-- pet_product_scores scoring inputs.

-- ============== Helper: upsert totals (SECURITY DEFINER) ==============
CREATE OR REPLACE FUNCTION upsert_user_xp_totals(
  p_user_id UUID,
  p_xp_delta INT,
  p_event_type TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO user_xp_totals (
    user_id,
    total_xp,
    scans_count,
    discoveries_count,
    contributions_count,
    updated_at
  )
  VALUES (
    p_user_id,
    p_xp_delta,
    CASE WHEN p_event_type = 'scan'       THEN 1 ELSE 0 END,
    CASE WHEN p_event_type = 'discovery'  THEN 1 ELSE 0 END,
    CASE WHEN p_event_type IN ('vote_verified','missing_product_approved','recipe_approved')
         THEN 1 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp          = user_xp_totals.total_xp          + EXCLUDED.total_xp,
    scans_count       = user_xp_totals.scans_count       + EXCLUDED.scans_count,
    discoveries_count = user_xp_totals.discoveries_count + EXCLUDED.discoveries_count,
    contributions_count =
      user_xp_totals.contributions_count + EXCLUDED.contributions_count,
    updated_at        = NOW();
END;
$$;

-- ============== Trigger function: scan + streak + discovery ==============
-- Fires AFTER INSERT on scan_history.
-- Awards:
--   +10 XP for every scan (scan event)
--   +50 XP if this is the first scan of a product across ALL users (discovery)
-- Streak logic (calendar-day, UTC):
--   gap_days = today - streak_last_scan_date (integer day subtraction)
--   gap < 0   → reset to 1 (clock skew / backdated insert)
--   gap = 0   → same-day no-op
--   gap 1–2   → extend (gap=1 is next day; gap=2 is 1-day grace period)
--   gap >= 3  → reset to 1
CREATE OR REPLACE FUNCTION process_scan_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today         DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_existing      user_xp_totals%ROWTYPE;
  v_gap_days      INT;
  v_is_discovery  BOOLEAN;
BEGIN
  -- Award base scan XP
  INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id)
  VALUES (NEW.user_id, 'scan', 10, NEW.product_id);
  PERFORM upsert_user_xp_totals(NEW.user_id, 10, 'scan');

  -- Discovery bonus: first scan of this product by ANY user across the platform.
  -- Excludes the current row (id <> NEW.id) to avoid self-match.
  v_is_discovery := NOT EXISTS (
    SELECT 1 FROM scan_history
    WHERE product_id = NEW.product_id
      AND id <> NEW.id
  );
  IF v_is_discovery THEN
    INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id)
    VALUES (NEW.user_id, 'discovery', 50, NEW.product_id);
    PERFORM upsert_user_xp_totals(NEW.user_id, 50, 'discovery');
  END IF;

  -- Streak update (integer day arithmetic, no epoch conversion)
  SELECT * INTO v_existing FROM user_xp_totals WHERE user_id = NEW.user_id;

  IF v_existing.streak_last_scan_date IS NULL THEN
    -- First scan ever: initialize streak
    UPDATE user_xp_totals SET
      streak_current_days = 1,
      streak_longest_days = GREATEST(streak_longest_days, 1),
      streak_last_scan_date = v_today
    WHERE user_id = NEW.user_id;

  ELSE
    v_gap_days := v_today - v_existing.streak_last_scan_date;

    IF v_gap_days < 0 THEN
      -- Clock skew or backdated insert: reset rather than corrupt the streak
      UPDATE user_xp_totals SET
        streak_current_days   = 1,
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;

    ELSIF v_gap_days = 0 THEN
      -- Same day: no streak change
      NULL;

    ELSIF v_gap_days <= 2 THEN
      -- Next-day or 1-day-grace continuation
      UPDATE user_xp_totals SET
        streak_current_days   = streak_current_days + 1,
        streak_longest_days   = GREATEST(streak_longest_days, streak_current_days + 1),
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;

    ELSE
      -- Gap >= 3: streak broken, reset
      UPDATE user_xp_totals SET
        streak_current_days   = 1,
        streak_last_scan_date = v_today
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER scans_award_xp
  AFTER INSERT ON scan_history
  FOR EACH ROW EXECUTE FUNCTION process_scan_xp();

-- ============== Trigger function: kiba_index_votes (scan-verified only) ==============
-- Fires AFTER INSERT on kiba_index_votes.
-- Awards +15 XP only if the voting user has previously scanned the product
-- (verified knowledge, not random voting). No XP for unverified votes.
CREATE OR REPLACE FUNCTION process_vote_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM scan_history
    WHERE user_id   = NEW.user_id
      AND product_id = NEW.product_id
    LIMIT 1
  ) THEN
    INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id, vote_id)
    VALUES (NEW.user_id, 'vote_verified', 15, NEW.product_id, NEW.id);
    PERFORM upsert_user_xp_totals(NEW.user_id, 15, 'vote_verified');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kiba_index_votes_award_xp
  AFTER INSERT ON kiba_index_votes
  FOR EACH ROW EXECUTE FUNCTION process_vote_xp();

-- ============== Trigger function: recipe approval (idempotent) ==============
-- Fires AFTER UPDATE OF status ON community_recipes.
-- Awards +100 XP when status transitions to 'approved'.
-- Idempotency guard: checks user_xp_events for an existing 'recipe_approved'
-- event for this recipe_id before inserting. If the moderator un-approves
-- then re-approves, the second transition is blocked — the user gets +100 XP
-- exactly once per recipe.
CREATE OR REPLACE FUNCTION process_recipe_approval_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only fire when transitioning INTO 'approved'
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    -- Idempotency: only award once per recipe, regardless of re-approval
    IF NOT EXISTS (
      SELECT 1 FROM user_xp_events
      WHERE recipe_id  = NEW.id
        AND event_type = 'recipe_approved'
    ) THEN
      INSERT INTO user_xp_events (user_id, event_type, xp_delta, recipe_id)
      VALUES (NEW.user_id, 'recipe_approved', 100, NEW.id);
      PERFORM upsert_user_xp_totals(NEW.user_id, 100, 'recipe_approved');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_recipes_award_approval_xp
  AFTER UPDATE OF status ON community_recipes
  FOR EACH ROW EXECUTE FUNCTION process_recipe_approval_xp();

-- ============== Trigger function: missing-product approval (idempotent) ==============
-- Fires AFTER UPDATE OF needs_review ON products.
-- Awards +100 XP to products.contributed_by when the product transitions
-- from needs_review=true to needs_review=false (moderator-approved).
-- Idempotency guard: checks user_xp_events for an existing
-- 'missing_product_approved' event for this product_id before inserting.
-- A true→false→true→false oscillation awards only once.
CREATE OR REPLACE FUNCTION process_missing_product_approval_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contributor UUID;
BEGIN
  -- Only fire when transitioning FROM needs_review=true TO needs_review=false
  -- and the product has a known contributor
  IF NEW.needs_review = false
     AND OLD.needs_review = true
     AND NEW.contributed_by IS NOT NULL
  THEN
    v_contributor := NEW.contributed_by;

    -- Idempotency: only award once per product
    IF NOT EXISTS (
      SELECT 1 FROM user_xp_events
      WHERE product_id = NEW.id
        AND event_type = 'missing_product_approved'
    ) THEN
      INSERT INTO user_xp_events (user_id, event_type, xp_delta, product_id)
      VALUES (v_contributor, 'missing_product_approved', 100, NEW.id);
      PERFORM upsert_user_xp_totals(v_contributor, 100, 'missing_product_approved');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_award_missing_approval_xp
  AFTER UPDATE OF needs_review ON products
  FOR EACH ROW EXECUTE FUNCTION process_missing_product_approval_xp();

-- ============== Ownership: ensure SECURITY DEFINER bypasses RLS ==============
-- During supabase db push, functions are created owned by postgres already.
-- These ALTER statements are defensive no-ops that explicitly document intent.
ALTER FUNCTION upsert_user_xp_totals(UUID, INT, TEXT)   OWNER TO postgres;
ALTER FUNCTION process_scan_xp()                          OWNER TO postgres;
ALTER FUNCTION process_vote_xp()                          OWNER TO postgres;
ALTER FUNCTION process_recipe_approval_xp()               OWNER TO postgres;
ALTER FUNCTION process_missing_product_approval_xp()      OWNER TO postgres;
