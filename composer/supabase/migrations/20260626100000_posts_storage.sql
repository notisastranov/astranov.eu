-- Posts media storage bucket (video/image for Super Add)

INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "posts_public_read" ON storage.objects;
CREATE POLICY "posts_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "posts_auth_insert" ON storage.objects;
CREATE POLICY "posts_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "posts_auth_update" ON storage.objects;
CREATE POLICY "posts_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'posts' AND (storage.foldername(name))[1] = auth.uid()::text);