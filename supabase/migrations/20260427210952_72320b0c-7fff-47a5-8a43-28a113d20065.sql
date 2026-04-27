REVOKE EXECUTE ON FUNCTION public.search_knowledge_chunks(text, integer, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_knowledge_document_user_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_knowledge_chunk_user_id() FROM anon, authenticated;