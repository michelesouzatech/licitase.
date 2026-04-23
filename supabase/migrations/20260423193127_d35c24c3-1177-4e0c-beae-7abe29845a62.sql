ALTER TABLE public.knowledge_documents ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.knowledge_chunks ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can view their own knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can create their own knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can update their own knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can delete their own knowledge documents" ON public.knowledge_documents;

CREATE POLICY "Anyone can view knowledge documents"
ON public.knowledge_documents
FOR SELECT
TO public
USING (true);

CREATE POLICY "Anyone can create knowledge documents"
ON public.knowledge_documents
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can update knowledge documents"
ON public.knowledge_documents
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete knowledge documents"
ON public.knowledge_documents
FOR DELETE
TO public
USING (true);

DROP POLICY IF EXISTS "Users can view their own knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users can create their own knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users can update their own knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users can delete their own knowledge chunks" ON public.knowledge_chunks;

CREATE POLICY "Anyone can view knowledge chunks"
ON public.knowledge_chunks
FOR SELECT
TO public
USING (true);

CREATE POLICY "Anyone can create knowledge chunks"
ON public.knowledge_chunks
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can update knowledge chunks"
ON public.knowledge_chunks
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete knowledge chunks"
ON public.knowledge_chunks
FOR DELETE
TO public
USING (true);