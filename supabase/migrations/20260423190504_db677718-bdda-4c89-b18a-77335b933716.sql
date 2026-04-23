CREATE TABLE public.knowledge_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  title TEXT,
  solution_name TEXT,
  module_name TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  extracted_text TEXT,
  summary TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.knowledge_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  solution_name TEXT,
  module_name TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_knowledge_documents_solution ON public.knowledge_documents(solution_name);
CREATE INDEX idx_knowledge_documents_module ON public.knowledge_documents(module_name);
CREATE INDEX idx_knowledge_documents_status ON public.knowledge_documents(processing_status);
CREATE INDEX idx_knowledge_chunks_document_id ON public.knowledge_chunks(document_id);
CREATE INDEX idx_knowledge_chunks_solution ON public.knowledge_chunks(solution_name);
CREATE INDEX idx_knowledge_chunks_module ON public.knowledge_chunks(module_name);
CREATE INDEX idx_knowledge_chunks_tags ON public.knowledge_chunks USING GIN(tags);
CREATE INDEX idx_knowledge_chunks_fts ON public.knowledge_chunks USING GIN (to_tsvector('portuguese', content));

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view knowledge documents"
ON public.knowledge_documents
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create knowledge documents"
ON public.knowledge_documents
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update knowledge documents"
ON public.knowledge_documents
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete knowledge documents"
ON public.knowledge_documents
FOR DELETE
USING (true);

CREATE POLICY "Anyone can view knowledge chunks"
ON public.knowledge_chunks
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create knowledge chunks"
ON public.knowledge_chunks
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update knowledge chunks"
ON public.knowledge_chunks
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete knowledge chunks"
ON public.knowledge_chunks
FOR DELETE
USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_knowledge_documents_updated_at
BEFORE UPDATE ON public.knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can list knowledge-base objects"
ON storage.objects
FOR SELECT
USING (bucket_id = 'knowledge-base');

CREATE POLICY "Anyone can upload knowledge-base objects"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Anyone can update knowledge-base objects"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'knowledge-base')
WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Anyone can delete knowledge-base objects"
ON storage.objects
FOR DELETE
USING (bucket_id = 'knowledge-base');

CREATE OR REPLACE FUNCTION public.search_knowledge_chunks(
  search_text TEXT,
  match_count INTEGER DEFAULT 8,
  filter_solution TEXT DEFAULT NULL,
  filter_module TEXT DEFAULT NULL
)
RETURNS TABLE (
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