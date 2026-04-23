-- Migration 041: Community Recipes (Kiba Kitchen user-submitted recipes)
-- New table for user-submitted homemade recipes with moderation workflow.
-- Cache invalidation not needed: does not affect pet_product_scores inputs.

CREATE TABLE community_recipes (
  id UUID PRIMARY KEY,  -- NO DEFAULT — client supplies (see spec §6.1)
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  species TEXT NOT NULL CHECK (species IN ('dog','cat','both')),
  life_stage TEXT NOT NULL CHECK (life_stage IN ('puppy','adult','senior','all')),
  ingredients JSONB NOT NULL,
  prep_steps JSONB NOT NULL,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','auto_rejected','pending_review','approved','rejected')),
  rejection_reason TEXT,
  is_killed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX community_recipes_status_idx ON community_recipes (status, reviewed_at DESC);
CREATE INDEX community_recipes_user_idx ON community_recipes (user_id, created_at DESC);

ALTER TABLE community_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own recipes" ON community_recipes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own + approved recipes" ON community_recipes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (status = 'approved' AND is_killed = false));

CREATE POLICY "Public read approved recipes" ON community_recipes
  FOR SELECT TO anon
  USING (status = 'approved' AND is_killed = false);
-- UPDATE: service role only (Studio moderation). No policy = denied.
