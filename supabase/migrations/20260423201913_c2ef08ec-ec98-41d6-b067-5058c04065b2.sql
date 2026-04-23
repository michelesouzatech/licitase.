CREATE POLICY "Knowledge documents are blocked from app users"
ON public.knowledge_documents
AS PERMISSIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

CREATE POLICY "Knowledge chunks are blocked from app users"
ON public.knowledge_chunks
AS PERMISSIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);