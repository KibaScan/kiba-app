-- M8: Kiba Index schema updates
-- 1. Support partial submissions for Kiba Index (drop NOT NULL constraints)
-- 2. Add secure aggregation RPC function

ALTER TABLE kiba_index_votes
  ALTER COLUMN taste_vote DROP NOT NULL,
  ALTER COLUMN tummy_vote DROP NOT NULL;

-- Aggregation function (Security Definer to bypass RLS and read community votes)
CREATE OR REPLACE FUNCTION get_kiba_index_stats(p_product_id UUID, p_species TEXT)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_votes', COUNT(v.id),
    'taste', json_build_object(
      'total', COALESCE(SUM(CASE WHEN v.taste_vote IS NOT NULL THEN 1 ELSE 0 END), 0),
      'loved', COALESCE(SUM(CASE WHEN v.taste_vote = 'loved' THEN 1 ELSE 0 END), 0),
      'picky', COALESCE(SUM(CASE WHEN v.taste_vote = 'picky' THEN 1 ELSE 0 END), 0),
      'refused', COALESCE(SUM(CASE WHEN v.taste_vote = 'refused' THEN 1 ELSE 0 END), 0)
    ),
    'tummy', json_build_object(
      'total', COALESCE(SUM(CASE WHEN v.tummy_vote IS NOT NULL THEN 1 ELSE 0 END), 0),
      'perfect', COALESCE(SUM(CASE WHEN v.tummy_vote = 'perfect' THEN 1 ELSE 0 END), 0),
      'soft_stool', COALESCE(SUM(CASE WHEN v.tummy_vote = 'soft_stool' THEN 1 ELSE 0 END), 0),
      'upset', COALESCE(SUM(CASE WHEN v.tummy_vote = 'upset' THEN 1 ELSE 0 END), 0)
    )
  )
  INTO v_result
  FROM kiba_index_votes v
  JOIN pets p ON v.pet_id = p.id
  WHERE v.product_id = p_product_id AND p.species = p_species;

  -- PostgreSQL returns null for aggregate functions over zero rows.
  -- COALESCE handles individual columns; this block handles the whole-object fallback.
  IF (v_result->>'total_votes')::int = 0 THEN
    v_result := json_build_object(
      'total_votes', 0,
      'taste', json_build_object('total', 0, 'loved', 0, 'picky', 0, 'refused', 0),
      'tummy', json_build_object('total', 0, 'perfect', 0, 'soft_stool', 0, 'upset', 0)
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
