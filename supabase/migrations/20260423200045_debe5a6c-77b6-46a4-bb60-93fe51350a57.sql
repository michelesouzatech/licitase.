DROP POLICY IF EXISTS "Anyone can create knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Anyone can update knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Anyone can delete knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Anyone can create knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Anyone can update knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Anyone can delete knowledge chunks" ON public.knowledge_chunks;

DROP POLICY IF EXISTS "Anyone can view knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Anyone can view knowledge chunks" ON public.knowledge_chunks;

CREATE POLICY "Knowledge documents are publicly readable"
ON public.knowledge_documents
FOR SELECT
TO public
USING (true);

CREATE POLICY "Knowledge chunks are publicly readable"
ON public.knowledge_chunks
FOR SELECT
TO public
USING (true);