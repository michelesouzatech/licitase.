-- 1) Tighten RLS on public.licitacoes: drop public policies, no client access
DROP POLICY IF EXISTS "Anyone can insert licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Anyone can view licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Anyone can update licitacoes" ON public.licitacoes;

-- Ensure RLS stays enabled (service role bypasses RLS automatically)
ALTER TABLE public.licitacoes ENABLE ROW LEVEL SECURITY;

-- Explicit deny-all policy for clarity (service role bypasses this)
CREATE POLICY "Licitacoes are blocked from app users"
ON public.licitacoes
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- 2) Drop overly permissive storage upload policy
DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;