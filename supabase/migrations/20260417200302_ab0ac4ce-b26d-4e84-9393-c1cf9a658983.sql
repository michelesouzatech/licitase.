CREATE TABLE public.licitacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdf_name TEXT NOT NULL,
  edital_text TEXT,
  resultado_json JSONB,
  data_consulta TIMESTAMPTZ NOT NULL DEFAULT now(),
  ganhou BOOLEAN,
  observacao TEXT DEFAULT ''
);

ALTER TABLE public.licitacoes ENABLE ROW LEVEL SECURITY;

-- Public app: anyone can insert and read
CREATE POLICY "Anyone can insert licitacoes"
ON public.licitacoes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view licitacoes"
ON public.licitacoes FOR SELECT
USING (true);

CREATE POLICY "Anyone can update licitacoes"
ON public.licitacoes FOR UPDATE
USING (true);

CREATE INDEX idx_licitacoes_data_consulta ON public.licitacoes(data_consulta DESC);