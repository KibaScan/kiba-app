-- xp_triggers.sql — SQL fixture-style tests for migration 046
-- Run as: psql $DATABASE_URL -f supabase/tests/xp_triggers.sql
--
-- Requirements:
--   • pgTAP NOT assumed — uses vanilla DO blocks with RAISE EXCEPTION.
--   • Each test is wrapped in BEGIN; ... ROLLBACK; so no state persists.
--   • Tests run as the `postgres` role (owner), which bypasses RLS.
--     This is intentional: we test trigger logic, not RLS policies.
--   • scan_history.score_breakdown is NOT NULL JSONB — every insert uses '{}'.
--   • FK chain: auth.users → pets / products must be inserted per-block.
--     auth.users rows are inserted into auth.users directly (postgres role).
--
-- Fixed UUIDs for readability:
--   USER_A  = '00000000-0000-0000-0000-000000000001'
--   USER_B  = '00000000-0000-0000-0000-000000000002'
--   PET_A   = '00000000-0000-0000-0000-000000000011'
--   PET_B   = '00000000-0000-0000-0000-000000000012'
--   PROD_1  = '00000000-0000-0000-0000-000000000101'
--   PROD_2  = '00000000-0000-0000-0000-000000000102'
--
-- Run each test block manually or pipe the whole file to psql.

\echo '=== XP Trigger Tests ==='

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared fixture helper (inlined per block — cannot use procedures across
-- ROLLBACK boundaries without a session-level function, so we repeat).
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- Test 1: First scan = +10 XP, streak = 1
-- =============================================================================
\echo 'Test 1: First scan awards +10 XP and initialises streak to 1'
BEGIN;

  -- Fixtures
  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO pets (id, user_id, name, species)
  VALUES ('00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000001',
          'Rex', 'dog')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (id, name, target_species, category, ingredients_hash)
  VALUES ('00000000-0000-0000-0000-000000000101',
          'Test Kibble', 'dog', 'dry_food', 'hash_1')
    ON CONFLICT (id) DO NOTHING;

  -- Action: first scan
  INSERT INTO scan_history (user_id, pet_id, product_id, final_score, score_breakdown)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000101',
          75, '{}');

  DO $$
  DECLARE
    v_totals user_xp_totals%ROWTYPE;
    v_events INT;
  BEGIN
    SELECT * INTO v_totals FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    -- At minimum: scan(+10) + discovery(+50) = 60 XP
    -- (this is the first scan of this product ever, so discovery fires too)
    -- We check >= 10 to avoid coupling this test to discovery details.
    -- Exact XP is validated in Test 5.
    IF v_totals.total_xp < 10 THEN
      RAISE EXCEPTION 'Test 1 FAILED: expected total_xp >= 10, got %', v_totals.total_xp;
    END IF;

    IF v_totals.streak_current_days <> 1 THEN
      RAISE EXCEPTION 'Test 1 FAILED: expected streak_current_days = 1, got %',
        v_totals.streak_current_days;
    END IF;

    IF v_totals.streak_last_scan_date <> (NOW() AT TIME ZONE 'UTC')::DATE THEN
      RAISE EXCEPTION 'Test 1 FAILED: streak_last_scan_date is %, expected today UTC',
        v_totals.streak_last_scan_date;
    END IF;

    SELECT COUNT(*) INTO v_events FROM user_xp_events
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
      AND event_type = 'scan';

    IF v_events <> 1 THEN
      RAISE EXCEPTION 'Test 1 FAILED: expected 1 scan event, got %', v_events;
    END IF;

    RAISE NOTICE 'Test 1 PASSED';
  END $$;

ROLLBACK;

-- =============================================================================
-- Test 2: Same-day second scan = +10 XP, streak still 1
-- =============================================================================
\echo 'Test 2: Same-day second scan adds +10 XP, streak remains 1'
BEGIN;

  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO pets (id, user_id, name, species)
  VALUES ('00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000001',
          'Rex', 'dog')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (id, name, target_species, category, ingredients_hash)
  VALUES
    ('00000000-0000-0000-0000-000000000101', 'Test Kibble', 'dog', 'dry_food', 'hash_1'),
    ('00000000-0000-0000-0000-000000000102', 'Test Treat',  'dog', 'treat',    'hash_2')
    ON CONFLICT (id) DO NOTHING;

  -- First scan today
  INSERT INTO scan_history (user_id, pet_id, product_id, final_score, score_breakdown)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000101',
          75, '{}');

  -- Second scan same day (different product to avoid discovery dedup confusion)
  INSERT INTO scan_history (user_id, pet_id, product_id, final_score, score_breakdown)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000102',
          80, '{}');

  DO $$
  DECLARE
    v_totals user_xp_totals%ROWTYPE;
    v_scan_events INT;
  BEGIN
    SELECT * INTO v_totals FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    SELECT COUNT(*) INTO v_scan_events FROM user_xp_events
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
      AND event_type = 'scan';

    IF v_scan_events <> 2 THEN
      RAISE EXCEPTION 'Test 2 FAILED: expected 2 scan events, got %', v_scan_events;
    END IF;

    IF v_totals.streak_current_days <> 1 THEN
      RAISE EXCEPTION 'Test 2 FAILED: streak should still be 1 on same day, got %',
        v_totals.streak_current_days;
    END IF;

    RAISE NOTICE 'Test 2 PASSED';
  END $$;

ROLLBACK;

-- =============================================================================
-- Test 3: Next-day scan = streak extends to 2
-- =============================================================================
\echo 'Test 3: Next-day scan extends streak to 2'
BEGIN;

  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO pets (id, user_id, name, species)
  VALUES ('00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000001',
          'Rex', 'dog')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (id, name, target_species, category, ingredients_hash)
  VALUES ('00000000-0000-0000-0000-000000000101', 'Test Kibble', 'dog', 'dry_food', 'hash_1')
    ON CONFLICT (id) DO NOTHING;

  -- Manually prime the totals row to simulate yesterday's scan
  INSERT INTO user_xp_totals (
    user_id, total_xp, scans_count, discoveries_count, contributions_count,
    streak_current_days, streak_longest_days, streak_last_scan_date
  ) VALUES (
    '00000000-0000-0000-0000-000000000001',
    60, 1, 1, 0,
    1, 1,
    (NOW() AT TIME ZONE 'UTC')::DATE - 1  -- yesterday
  );

  -- Scan today
  INSERT INTO scan_history (user_id, pet_id, product_id, final_score, score_breakdown)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000101',
          75, '{}');

  DO $$
  DECLARE
    v_totals user_xp_totals%ROWTYPE;
  BEGIN
    SELECT * INTO v_totals FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    IF v_totals.streak_current_days <> 2 THEN
      RAISE EXCEPTION 'Test 3 FAILED: expected streak_current_days = 2, got %',
        v_totals.streak_current_days;
    END IF;

    IF v_totals.streak_longest_days < 2 THEN
      RAISE EXCEPTION 'Test 3 FAILED: expected streak_longest_days >= 2, got %',
        v_totals.streak_longest_days;
    END IF;

    RAISE NOTICE 'Test 3 PASSED';
  END $$;

ROLLBACK;

-- =============================================================================
-- Test 4: Gap of 3+ days resets streak to 1
-- =============================================================================
\echo 'Test 4: 3-day gap resets streak to 1'
BEGIN;

  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO pets (id, user_id, name, species)
  VALUES ('00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000001',
          'Rex', 'dog')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (id, name, target_species, category, ingredients_hash)
  VALUES ('00000000-0000-0000-0000-000000000101', 'Test Kibble', 'dog', 'dry_food', 'hash_1')
    ON CONFLICT (id) DO NOTHING;

  -- Prime with a 7-day streak from 5 days ago (gap = 5, well above the 2-day grace)
  INSERT INTO user_xp_totals (
    user_id, total_xp, scans_count, discoveries_count, contributions_count,
    streak_current_days, streak_longest_days, streak_last_scan_date
  ) VALUES (
    '00000000-0000-0000-0000-000000000001',
    420, 7, 1, 0,
    7, 7,
    (NOW() AT TIME ZONE 'UTC')::DATE - 5  -- 5 days ago
  );

  -- Scan today (gap_days = 5 >= 3 → reset)
  INSERT INTO scan_history (user_id, pet_id, product_id, final_score, score_breakdown)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000101',
          75, '{}');

  DO $$
  DECLARE
    v_totals user_xp_totals%ROWTYPE;
  BEGIN
    SELECT * INTO v_totals FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    IF v_totals.streak_current_days <> 1 THEN
      RAISE EXCEPTION 'Test 4 FAILED: expected streak reset to 1, got %',
        v_totals.streak_current_days;
    END IF;

    -- Longest streak should be preserved (7), not overwritten
    IF v_totals.streak_longest_days < 7 THEN
      RAISE EXCEPTION 'Test 4 FAILED: longest streak should be preserved >= 7, got %',
        v_totals.streak_longest_days;
    END IF;

    RAISE NOTICE 'Test 4 PASSED';
  END $$;

ROLLBACK;

-- =============================================================================
-- Test 5: First scan of a UPC = discovery bonus. Second user's scan = no bonus.
-- =============================================================================
\echo 'Test 5: Discovery bonus fires for first global scan, not second'
BEGIN;

  -- Two users
  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid'),
    ('00000000-0000-0000-0000-000000000002', 'user_b@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  -- Two pets (one per user)
  INSERT INTO pets (id, user_id, name, species) VALUES
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Rex', 'dog'),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 'Luna', 'dog')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (id, name, target_species, category, ingredients_hash)
  VALUES ('00000000-0000-0000-0000-000000000101', 'Test Kibble', 'dog', 'dry_food', 'hash_1')
    ON CONFLICT (id) DO NOTHING;

  -- USER_A scans first → should get scan(+10) + discovery(+50) = +60
  INSERT INTO scan_history (user_id, pet_id, product_id, final_score, score_breakdown)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000101',
          75, '{}');

  -- USER_B scans same product → should get scan(+10) only, no discovery
  INSERT INTO scan_history (user_id, pet_id, product_id, final_score, score_breakdown)
  VALUES ('00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000012',
          '00000000-0000-0000-0000-000000000101',
          75, '{}');

  DO $$
  DECLARE
    v_xp_a    INT;
    v_xp_b    INT;
    v_disc_a  INT;
    v_disc_b  INT;
  BEGIN
    SELECT total_xp INTO v_xp_a FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    SELECT total_xp INTO v_xp_b FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000002';

    SELECT COUNT(*) INTO v_disc_a FROM user_xp_events
    WHERE user_id  = '00000000-0000-0000-0000-000000000001'
      AND event_type = 'discovery';

    SELECT COUNT(*) INTO v_disc_b FROM user_xp_events
    WHERE user_id  = '00000000-0000-0000-0000-000000000002'
      AND event_type = 'discovery';

    IF v_xp_a <> 60 THEN
      RAISE EXCEPTION 'Test 5 FAILED: USER_A expected 60 XP (scan+discovery), got %', v_xp_a;
    END IF;

    IF v_disc_a <> 1 THEN
      RAISE EXCEPTION 'Test 5 FAILED: USER_A expected 1 discovery event, got %', v_disc_a;
    END IF;

    IF v_xp_b <> 10 THEN
      RAISE EXCEPTION 'Test 5 FAILED: USER_B expected 10 XP (scan only), got %', v_xp_b;
    END IF;

    IF v_disc_b <> 0 THEN
      RAISE EXCEPTION 'Test 5 FAILED: USER_B expected 0 discovery events, got %', v_disc_b;
    END IF;

    RAISE NOTICE 'Test 5 PASSED';
  END $$;

ROLLBACK;

-- =============================================================================
-- Test 6: Vote WITHOUT prior scan = +0 XP (unverified vote)
-- =============================================================================
\echo 'Test 6: Vote without prior scan awards no XP'
BEGIN;

  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO pets (id, user_id, name, species)
  VALUES ('00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000001',
          'Rex', 'dog')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (id, name, target_species, category, ingredients_hash)
  VALUES ('00000000-0000-0000-0000-000000000101', 'Test Kibble', 'dog', 'dry_food', 'hash_1')
    ON CONFLICT (id) DO NOTHING;

  -- Vote WITHOUT any prior scan
  INSERT INTO kiba_index_votes (user_id, pet_id, product_id, taste_vote, tummy_vote)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000101',
          NULL, NULL);

  DO $$
  DECLARE
    v_vote_events INT;
    v_xp          INT;
  BEGIN
    SELECT COUNT(*) INTO v_vote_events FROM user_xp_events
    WHERE user_id  = '00000000-0000-0000-0000-000000000001'
      AND event_type = 'vote_verified';

    SELECT COALESCE(total_xp, 0) INTO v_xp FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    IF v_vote_events <> 0 THEN
      RAISE EXCEPTION 'Test 6 FAILED: expected 0 vote_verified events, got %', v_vote_events;
    END IF;

    IF v_xp <> 0 THEN
      RAISE EXCEPTION 'Test 6 FAILED: expected 0 XP for unverified vote, got %', v_xp;
    END IF;

    RAISE NOTICE 'Test 6 PASSED';
  END $$;

ROLLBACK;

-- =============================================================================
-- Test 7: Vote AFTER prior scan = +15 XP (verified vote)
-- =============================================================================
\echo 'Test 7: Vote after scan awards +15 XP'
BEGIN;

  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO pets (id, user_id, name, species)
  VALUES ('00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000001',
          'Rex', 'dog')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (id, name, target_species, category, ingredients_hash)
  VALUES ('00000000-0000-0000-0000-000000000101', 'Test Kibble', 'dog', 'dry_food', 'hash_1')
    ON CONFLICT (id) DO NOTHING;

  -- Scan first (earns 60 XP: 10 scan + 50 discovery)
  INSERT INTO scan_history (user_id, pet_id, product_id, final_score, score_breakdown)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000101',
          75, '{}');

  -- Now vote
  INSERT INTO kiba_index_votes (user_id, pet_id, product_id, taste_vote, tummy_vote)
  VALUES ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000101',
          'loved', NULL);

  DO $$
  DECLARE
    v_vote_events INT;
    v_total_xp    INT;
  BEGIN
    SELECT COUNT(*) INTO v_vote_events FROM user_xp_events
    WHERE user_id  = '00000000-0000-0000-0000-000000000001'
      AND event_type = 'vote_verified';

    SELECT total_xp INTO v_total_xp FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    IF v_vote_events <> 1 THEN
      RAISE EXCEPTION 'Test 7 FAILED: expected 1 vote_verified event, got %', v_vote_events;
    END IF;

    -- 60 (scan+discovery) + 15 (verified vote) = 75
    IF v_total_xp <> 75 THEN
      RAISE EXCEPTION 'Test 7 FAILED: expected 75 total XP, got %', v_total_xp;
    END IF;

    RAISE NOTICE 'Test 7 PASSED';
  END $$;

ROLLBACK;

-- =============================================================================
-- Test 8: Recipe approve → re-approve → +100 XP only once (idempotent)
-- =============================================================================
\echo 'Test 8: Recipe re-approval awards XP only once'
BEGIN;

  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  -- Insert a community recipe in pending state
  INSERT INTO community_recipes (
    id, user_id, title, species, life_stage, ingredients, prep_steps, status
  ) VALUES (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    'Test Recipe', 'dog', 'adult', '[]'::jsonb, '[]'::jsonb, 'pending'
  );

  -- First approval: pending → approved
  UPDATE community_recipes
  SET status = 'approved'
  WHERE id = '00000000-0000-0000-0000-000000000201';

  -- Un-approve: approved → pending (simulates moderator reverting)
  UPDATE community_recipes
  SET status = 'pending'
  WHERE id = '00000000-0000-0000-0000-000000000201';

  -- Re-approve: pending → approved again
  UPDATE community_recipes
  SET status = 'approved'
  WHERE id = '00000000-0000-0000-0000-000000000201';

  DO $$
  DECLARE
    v_recipe_events INT;
    v_total_xp      INT;
  BEGIN
    SELECT COUNT(*) INTO v_recipe_events FROM user_xp_events
    WHERE user_id  = '00000000-0000-0000-0000-000000000001'
      AND event_type = 'recipe_approved';

    SELECT total_xp INTO v_total_xp FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    IF v_recipe_events <> 1 THEN
      RAISE EXCEPTION
        'Test 8 FAILED: expected 1 recipe_approved event (idempotent), got %', v_recipe_events;
    END IF;

    IF v_total_xp <> 100 THEN
      RAISE EXCEPTION
        'Test 8 FAILED: expected 100 XP after re-approval (not 200), got %', v_total_xp;
    END IF;

    RAISE NOTICE 'Test 8 PASSED';
  END $$;

ROLLBACK;

-- =============================================================================
-- Test 9: Product needs_review false→true→false = +100 XP only once (idempotent)
-- =============================================================================
\echo 'Test 9: Missing product re-approval awards XP only once'
BEGIN;

  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'user_a@test.invalid')
    ON CONFLICT (id) DO NOTHING;

  -- Insert a community-contributed product pending moderation
  INSERT INTO products (
    id, name, target_species, category, ingredients_hash,
    needs_review, contributed_by
  ) VALUES (
    '00000000-0000-0000-0000-000000000101',
    'Community Kibble', 'dog', 'dry_food', 'hash_contrib',
    true,
    '00000000-0000-0000-0000-000000000001'
  );

  -- First approval: needs_review true → false (fires trigger, awards +100)
  UPDATE products
  SET needs_review = false
  WHERE id = '00000000-0000-0000-0000-000000000101';

  -- Flag back for re-review: needs_review false → true
  UPDATE products
  SET needs_review = true
  WHERE id = '00000000-0000-0000-0000-000000000101';

  -- Re-approve: needs_review true → false (idempotency guard should block)
  UPDATE products
  SET needs_review = false
  WHERE id = '00000000-0000-0000-0000-000000000101';

  DO $$
  DECLARE
    v_approval_events INT;
    v_total_xp        INT;
  BEGIN
    SELECT COUNT(*) INTO v_approval_events FROM user_xp_events
    WHERE user_id  = '00000000-0000-0000-0000-000000000001'
      AND event_type = 'missing_product_approved';

    SELECT total_xp INTO v_total_xp FROM user_xp_totals
    WHERE user_id = '00000000-0000-0000-0000-000000000001';

    IF v_approval_events <> 1 THEN
      RAISE EXCEPTION
        'Test 9 FAILED: expected 1 missing_product_approved event, got %', v_approval_events;
    END IF;

    IF v_total_xp <> 100 THEN
      RAISE EXCEPTION
        'Test 9 FAILED: expected 100 XP after oscillation (not 200), got %', v_total_xp;
    END IF;

    RAISE NOTICE 'Test 9 PASSED';
  END $$;

ROLLBACK;

\echo '=== All XP Trigger Tests Complete ==='
