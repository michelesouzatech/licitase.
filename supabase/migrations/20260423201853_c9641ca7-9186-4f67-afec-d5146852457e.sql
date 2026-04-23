DROP POLICY IF EXISTS "Knowledge documents are publicly readable" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Knowledge chunks are publicly readable" ON public.knowledge_chunks;

CREATE OR REPLACE FUNCTION public.search_knowledge_chunks(
  search_text TEXT,
  match_count INTEGER DEFAULT 8,
  filter_solution TEXT DEFAULT NULL,
  filter_module TEXT DEFAULT NULL
)
RETURNS TABLE(
  chunk_id UUID,
  document_id UUID,
  file_name TEXT,
  title TEXT,
  solution_name TEXT,
  module_name TEXT,
  content TEXT,
  rank REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    kc.id AS chunk_id,
    kc.document_id,
    kd.file_name,
    kd.title,
    COALESCE(kc.solution_name, kd.solution_name) AS solution_name,
    COALESCE(kc.module_name, kd.module_name) AS module_name,
    kc.content,
    ts_rank(
      to_tsvector('portuguese', kc.content),
      plainto_tsquery('portuguese', search_text)
    ) AS rank
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE (
    search_text IS NULL
    OR btrim(search_text) = ''
    OR to_tsvector('portuguese', kc.content) @@ plainto_tsquery('portuguese', search_text)
  )
    AND (filter_solution IS NULL OR COALESCE(kc.solution_name, kd.solution_name) = filter_solution)
    AND (filter_module IS NULL OR COALESCE(kc.module_name, kd.module_name) = filter_module)
  ORDER BY rank DESC, kd.created_at DESC, kc.chunk_index ASC
  LIMIT GREATEST(match_count, 1);
$$;

REVOKE ALL ON FUNCTION public.search_knowledge_chunks(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_knowledge_chunks(TEXT, INTEGER, TEXT, TEXT) TO service_role;