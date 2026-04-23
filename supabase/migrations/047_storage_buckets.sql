-- 047_storage_buckets.sql

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload to own recipe folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users delete own recipe images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Public read recipe images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'recipe-images');

CREATE POLICY "Public read blog images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'blog-images');
-- blog-images writes: service role only (no policy).
