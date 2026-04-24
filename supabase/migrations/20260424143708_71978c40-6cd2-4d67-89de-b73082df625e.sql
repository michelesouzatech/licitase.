CREATE TABLE IF NOT EXISTS public.kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text,
  tipo text NOT NULL,
  bucket_name text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  conteudo_extraido text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "KB documents are blocked from app users" ON public.kb_documents;
CREATE POLICY "KB documents are blocked from app users"
ON public.kb_documents
FOR ALL
TO public
USING (false)
WITH CHECK (false);

DROP TRIGGER IF EXISTS set_kb_documents_updated_at ON public.kb_documents;
CREATE TRIGGER set_kb_documents_updated_at
BEFORE UPDATE ON public.kb_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_kb_documents_tipo_ativo
ON public.kb_documents (tipo, ativo);

INSERT INTO public.kb_documents (
  titulo,
  tipo,
  bucket_name,
  file_path,
  file_name,
  ativo
)
SELECT
  'Catálogo de Soluções SoftExpert',
  'knowledge_base',
  'conhecimento-basico',
  'catalogo-solucoes-softexpert.md',
  'catalogo-solucoes-softexpert.md',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kb_documents
  WHERE tipo = 'knowledge_base'
    AND bucket_name = 'conhecimento-basico'
    AND file_path = 'catalogo-solucoes-softexpert.md'
);