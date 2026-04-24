-- Migration 043: Blog Posts (Kiba editorial content, admin-authored via Studio)
-- Public read for published posts; all writes via service role only.
-- Cache invalidation not needed: does not affect pet_product_scores inputs.

CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  cover_image_url TEXT,
  body_markdown TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX blog_posts_published_idx ON blog_posts (published_at DESC) WHERE is_published = true;

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published blog posts" ON blog_posts
  FOR SELECT TO anon, authenticated USING (is_published = true);
-- Writes: service role only.
