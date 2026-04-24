-- Migration 052: get_kiba_index_candidates() community-aggregation RPC
--
-- Fixes the Kiba Index highlights bug surfaced by the post-shipping review
-- of `communityService.fetchKibaIndexHighlights`. The client-side service
-- queried `kiba_index_votes` directly to build its candidate set. That
-- table has per-user RLS (`001_initial_schema.sql:308 — FOR ALL USING
-- auth.uid() = user_id`) which filters reads to the current user's votes
-- only — so the "community top picky eaters / sensitive tummies" feed
-- degrades to "products I've voted on." Users with 0 votes see empty.
--
-- Fix: SECURITY DEFINER RPC that aggregates across all users, returning
-- DISTINCT candidate products for the requested species. The caller
-- continues to use `get_kiba_index_stats` (also SECURITY DEFINER) to
-- fetch per-product stats — unchanged.
--
-- Cache invalidation not needed: does not affect pet_product_scores inputs.

CREATE OR REPLACE FUNCTION get_kiba_index_candidates(p_species TEXT, p_limit INT DEFAULT 200)
RETURNS TABLE (product_id UUID, brand TEXT, name TEXT)
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT v.product_id, p.brand, p.name
  FROM kiba_index_votes v
  JOIN pets     pt ON pt.id = v.pet_id
  JOIN products p  ON p.id  = v.product_id
  WHERE pt.species = p_species
  LIMIT p_limit;
$$;

ALTER FUNCTION get_kiba_index_candidates(TEXT, INT) OWNER TO postgres;

-- Supabase default GRANT is to anon + authenticated + service_role. We want
-- authenticated only (anonymous users are server-side rare; no anon use
-- case for this). Revoke from PUBLIC + anon; authenticated retains via
-- explicit grant below.
REVOKE EXECUTE ON FUNCTION get_kiba_index_candidates(TEXT, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_kiba_index_candidates(TEXT, INT) TO authenticated;
