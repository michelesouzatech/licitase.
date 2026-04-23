DROP POLICY IF EXISTS "Anyone can create knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Anyone can update knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Anyone can delete knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Anyone can view knowledge documents" ON public.knowledge_documents;

DROP POLICY IF EXISTS "Anyone can create knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Anyone can update knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Anyone can delete knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Anyone can view knowledge chunks" ON public.knowledge_chunks;

DROP POLICY IF EXISTS "Anyone can list knowledge-base objects" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload knowledge-base objects" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update knowledge-base objects" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete knowledge-base objects" ON storage.objects;

ALTER TABLE public.knowledge_documents
ADD COLUMN user_id UUID;

UPDATE public.knowledge_documents
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;

ALTER TABLE public.knowledge_documents
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.knowledge_chunks
ADD COLUMN user_id UUID;

UPDATE public.knowledge_chunks kc
SET user_id = kd.user_id
FROM public.knowledge_documents kd
WHERE kd.id = kc.document_id
  AND kc.user_id IS NULL;

ALTER TABLE public.knowledge_chunks
ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX idx_knowledge_documents_user_id ON public.knowledge_documents(user_id);
CREATE INDEX idx_knowledge_chunks_user_id ON public.knowledge_chunks(user_id);

CREATE OR REPLACE FUNCTION public.assign_knowledge_document_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_knowledge_chunk_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT user_id INTO owner_id
  FROM public.knowledge_documents
  WHERE id = NEW.document_id;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Knowledge document not found';
  END IF;

  IF owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only add chunks to your own documents';
  END IF;

  NEW.user_id = owner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_knowledge_document_user_id ON public.knowledge_documents;
CREATE TRIGGER set_knowledge_document_user_id
BEFORE INSERT ON public.knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION public.assign_knowledge_document_user_id();

DROP TRIGGER IF EXISTS set_knowledge_chunk_user_id ON public.knowledge_chunks;
CREATE TRIGGER set_knowledge_chunk_user_id
BEFORE INSERT ON public.knowledge_chunks
FOR EACH ROW
EXECUTE FUNCTION public.assign_knowledge_chunk_user_id();

CREATE POLICY "Users can view their own knowledge documents"
ON public.knowledge_documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own knowledge documents"
ON public.knowledge_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge documents"
ON public.knowledge_documents
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge documents"
ON public.knowledge_documents
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own knowledge chunks"
ON public.knowledge_chunks
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own knowledge chunks"
ON public.knowledge_chunks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge chunks"
ON public.knowledge_chunks
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge chunks"
ON public.knowledge_chunks
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own knowledge-base objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own knowledge-base objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own knowledge-base objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own knowledge-base objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);