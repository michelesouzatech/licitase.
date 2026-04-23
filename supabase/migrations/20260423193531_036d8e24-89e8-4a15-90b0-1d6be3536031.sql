CREATE OR REPLACE FUNCTION public.assign_knowledge_document_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_knowledge_chunk_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  owner_id UUID;
BEGIN
  SELECT user_id INTO owner_id
  FROM public.knowledge_documents
  WHERE id = NEW.document_id;

  NEW.user_id = owner_id;
  RETURN NEW;
END;
$function$;