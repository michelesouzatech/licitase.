-- Make conhecimento-basico bucket private (access only via service_role in edge functions)
UPDATE storage.buckets SET public = false WHERE id = 'conhecimento-basico';

-- Remove dead policies that reference a non-existent bucket 'knowledge-base'
DROP POLICY IF EXISTS "Users can view their own knowledge-base objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own knowledge-base objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own knowledge-base objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own knowledge-base objects" ON storage.objects;

-- Deny-all policies for app users on both real buckets.
-- All legitimate access happens via service_role inside edge functions, which bypasses RLS.
CREATE POLICY "Deny all public access to conhecimento-basico"
ON storage.objects
FOR ALL
TO public
USING (bucket_id <> 'conhecimento-basico')
WITH CHECK (bucket_id <> 'conhecimento-basico');

CREATE POLICY "Deny all public access to editais"
ON storage.objects
FOR ALL
TO public
USING (bucket_id <> 'editais')
WITH CHECK (bucket_id <> 'editais');