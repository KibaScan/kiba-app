-- Migration 040: Bookmarks (per-pet product watchlist)
-- D-169: Per-pet bookmark list, hard cap 20 enforced client-side.

BEGIN;

CREATE TABLE bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pet_id, product_id)
);

CREATE INDEX idx_bookmarks_pet_created ON bookmarks (pet_id, created_at DESC);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookmarks_owner ON bookmarks
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
