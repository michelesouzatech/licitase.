// Edge function: receives already-extracted edital text, analyzes it, and returns the 12-section JSON result.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.25.76";

// Limit base64 payload size (~8MB base64 ≈ 6MB binary). Edge Functions accept up to 10MB.
const MAX_BASE64_LEN = 8_500_000;
const AI_TIMEOUT_MS = 18_000;
const MAX_EDITAL_TEXT_LEN = 90_000;
const SEARCH_TEXT_LEN = 8_000;

const requestSchema = z.object({
  fileBase64: z.string().min(1).max(MAX_BASE64_LEN).optional(),
  filePath: z.string().min(1).optional(),
  editalText: z.string().max(MAX_EDITAL_TEXT_LEN).optional(),
  bucket: z.string().min(1).optional(),
  fileName: z.string().min(1).max(300),
}).refine((d) => d.fileBase64 || d.filePath || d.editalText, { message: "fileBase64, filePath ou editalText é obrigatório" });

function buildMockResult(fileName: string, text: string, knowledgeContext = "") {
  const preview = text.slice(0, 280).replace(/\s+/g, " ");
  const hasKnowledge = Boolean(knowledgeContext.trim());
  const knowledgePreview = hasKnowledge
    ? `Foram encontrados trechos na base privada, mas a análise detalhada por IA falhou. Reprocessar para obter aderência validada.`
    : "A base privada SoftExpert não retornou trechos diretamente relacionados para este edital.";
  return {
    secao_1_objeto:
      `Objeto identificado preliminarmente a partir de ${fileName}. ` +
      `Trecho identificado: "${preview}..."`,
    secao_2_resumo_executivo:
      "Não foi possível gerar uma análise automatizada confiável neste momento. O texto do edital foi extraído, mas a etapa de IA não concluiu com sucesso.",
    secao_3_cronograma: {
      tipo: "tabela",
      colunas: ["Etapa", "Prazo/Data", "Data limite calculada", "Onde ocorre", "Fonte no edital"],
      linhas: [
        ["Publicação do edital", "A validar", "A validar", "A validar", "A validar no edital"],
        ["Envio de propostas", "A validar", "A validar", "Portal indicado no edital", "A validar no edital"],
        ["Pedido de esclarecimentos", "A validar", "A validar", "Portal indicado no edital", "A validar no edital"],
        ["Impugnação", "A validar", "A validar", "Portal indicado no edital", "A validar no edital"],
        ["Sessão pública/disputa", "A validar", "A validar", "Portal indicado no edital", "A validar no edital"],
      ],
    },
    secao_4_habilitacao: {
      tipo: "tabela",
      colunas: ["Item de habilitação", "Documento/evidência exigida", "Onde buscar", "Site/portal/órgão", "Observações"],
      linhas: [["A validar", "A validar diretamente no edital extraído", "Edital e anexos", "Portal indicado no edital", "O fallback não deve inferir requisitos de habilitação."]],
    },
    secao_5_atestados:
      "A validar diretamente no edital extraído. O fallback não deve inferir exigências de atestados.",
    secao_6_aderencia_matriz: {
      tipo: "tabela",
      colunas: ["Requisito", "Aderência SoftExpert", "Observação"],
      linhas: [
        ["Requisitos do edital", "A validar", "A análise por IA não foi concluída; nenhuma aderência deve ser assumida sem evidência da base privada."],
      ],
    },
    secao_7_evidencias:
      hasKnowledge
        ? "Há trechos recuperados da base privada, mas eles precisam ser reprocessados pela IA para virar evidência estruturada."
        : "Nenhuma evidência da base privada foi encontrada para este edital.",
    secao_8_modulos:
      "Não informado pelo fallback. Reprocessar para identificar módulos somente quando houver evidência na base privada.",
    secao_9_diferenciais:
      "Não informado pelo fallback. Diferenciais só devem aparecer quando estiverem documentados na base privada.",
    secao_10_riscos:
      "Risco principal: análise incompleta porque a etapa de IA falhou ou a base não trouxe evidências suficientes.",
    secao_11_viabilidade:
      "Indeterminada. Não recomendar GO/NOGO sem análise baseada em evidências.",
    secao_12_go_nogo:
      `INDETERMINADO — ${knowledgePreview}`,
  };
}

function extractJsonObject(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return cleaned;
  return cleaned.slice(start, end + 1);
}

async function analyzeWithLovableAi(fileName: string, editalText: string, knowledgeContext: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY não configurada");
  }

  const editalExcerpt = editalText.slice(0, 32000);
  const knowledgeExcerpt = knowledgeContext.slice(0, 10000);
  const dataConsulta = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const prompt = `Você é uma especialista em licitações B2B e soluções SoftExpert. Analise o edital abaixo e compare os requisitos com a base privada SoftExpert fornecida. Responda SOMENTE com JSON válido, sem markdown, exatamente com as chaves: secao_1_objeto, secao_2_resumo_executivo, secao_3_cronograma, secao_4_habilitacao, secao_5_atestados, secao_6_aderencia_matriz, secao_7_evidencias, secao_8_modulos, secao_9_diferenciais, secao_10_riscos, secao_11_viabilidade, secao_12_go_nogo. Para secao_3_cronograma, secao_4_habilitacao e secao_6_aderencia_matriz, use objeto {"tipo":"tabela","colunas":[],"linhas":[]}.

REGRAS CRÍTICAS DE FIDELIDADE:
- Não invente funcionalidades, módulos, integrações, certificações, cases, prazos, diferenciais ou aderências.
- Só marque aderência como "Total" quando houver evidência explícita na BASE PRIVADA SOFTEXPERT.
- Quando houver indício incompleto, marque "Parcial" e explique exatamente o que falta comprovar.
- Quando a base não comprovar, marque "Não evidenciado" ou "A validar".
- Em cada observação da matriz de aderência (secao_6_aderencia_matriz), descreva apenas a justificativa técnica/funcional da aderência. É TERMINANTEMENTE PROIBIDO mencionar, citar ou nomear qualquer arquivo, documento, material, catálogo, termo de referência, base, fonte ou origem da informação. NÃO escreva "conforme catálogo", "segundo o documento", "extraído de...", nem nomes próprios de documentos. Se não houver evidência, escreva apenas "sem evidência" ou "não evidenciado".
- Na secao_7_evidencias, cite apenas evidências e trechos úteis. É TERMINANTEMENTE PROIBIDO mencionar, citar, referenciar ou nomear qualquer arquivo, documento, material, catálogo, termo de referência, edital ou base de onde a evidência foi extraída. NÃO escreva frases como "extraído do catálogo", "conforme o termo de referência", "segundo o documento X", "as evidências foram extraídas de...", "descritivo das soluções SoftExpert", nem nomes próprios de documentos. NÃO liste todos os componentes/módulos do catálogo SoftExpert: cite SOMENTE os componentes, módulos ou funcionalidades que efetivamente atendem a uma demanda específica do edital analisado, e para cada um explique brevemente qual requisito do edital ele atende. Apresente apenas o conteúdo da evidência em si, sem indicar fonte/origem.
- Na secao_4_habilitacao, a resposta DEVE OBRIGATORIAMENTE ser um objeto {"tipo":"tabela","colunas":[...],"linhas":[[...]]} — NUNCA texto corrido. Cada item de habilitação (jurídica, fiscal, trabalhista, econômico-financeira, técnica, regularidade, etc.) deve ser UMA LINHA da tabela. Se nenhum item for identificado, retorne ao menos uma linha indicando "A validar no edital".
- Na secao_3_cronograma, a resposta DEVE OBRIGATORIAMENTE ser um objeto {"tipo":"tabela","colunas":[...],"linhas":[[...]]}. Liste OBRIGATORIAMENTE TODAS as etapas/prazos a seguir, mesmo que precisem ser calculados ou estimados a partir da legislação aplicável (Lei 14.133/2021, Lei 10.520/2002, decretos pertinentes) quando o edital não trouxer data explícita: (1) Publicação do edital, (2) Prazo final para pedidos de esclarecimentos, (3) Prazo final para impugnação do edital, (4) Resposta a esclarecimentos/impugnações, (5) Prazo final para envio/cadastro das propostas, (6) Abertura da sessão pública, (7) Disputa/lances, (8) Habilitação, (9) Prazo recursal / contrarrazões, (10) Adjudicação, (11) Homologação, (12) Convocação para assinatura do contrato, (13) Prazo final para assinatura do contrato, (14) Vigência do contrato. NENHUMA dessas linhas pode ser omitida — se o edital não trouxer data, calcule a partir da data da consulta (${dataConsulta}) usando os prazos legais e explique a base de cálculo na coluna "Fonte no edital". Use exatamente as colunas: ["Etapa","Prazo/Data","Data limite calculada","Onde ocorre","Fonte no edital"]. Em "Data limite calculada", informe a data exata (dd/mm/aaaa) de expiração de cada prazo. Em "Onde ocorre", informe o site/portal/sistema onde a etapa será realizada (ex.: ComprasNet, BEC, Licitações-e, Portal de Compras Públicas, sede do órgão).
- Na secao_4_habilitacao, apresente OBRIGATORIAMENTE uma tabela (objeto {"tipo":"tabela",...}) com os itens de habilitação em linhas. Use exatamente as colunas: ["Item de habilitação","Documento/evidência exigida","Onde buscar","Site/portal/órgão","Observações"]. Em "Onde buscar", indique se deve ser buscado em SICAF, portal de compras, certidões federais/estaduais/municipais, conselho profissional, junta comercial, balanço/contabilidade, edital/anexos ou outro local citado no edital.
- Se a BASE PRIVADA SOFTEXPERT estiver vazia ou genérica, deixe claro que a aderência não pôde ser comprovada.
- Não use conhecimento externo sobre a SoftExpert que não esteja na base fornecida.

Arquivo: ${fileName}
Data da consulta: ${dataConsulta}

BASE PRIVADA SOFTEXPERT:
${knowledgeExcerpt || "Nenhum trecho relevante encontrado na base privada."}

EDITAL:
${editalExcerpt}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("Tempo limite da IA excedido"), AI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Você produz análises técnicas de editais em JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Lovable AI respondeu ${response.status}: ${raw.slice(0, 300)}`);
  }

  const payload = JSON.parse(raw);
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Resposta da IA sem conteúdo analisável");
  }

  return JSON.parse(extractJsonObject(content));
}

function buildSearchQuery(text: string) {
  const words = text
    .slice(0, SEARCH_TEXT_LEN)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  return Array.from(new Set(words)).slice(0, 12).join(" ");
}

class StagedError extends Error {
  stage: "kb_query" | "storage_download" | "context_build";
  details?: unknown;

  constructor(stage: StagedError["stage"], message: string, details?: unknown) {
    super(message);
    this.name = "StagedError";
    this.stage = stage;
    this.details = details;
  }
}

async function loadKnowledgeContext(editalText: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new StagedError("kb_query", "Configuração da base de conhecimento indisponível");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const searchQuery = buildSearchQuery(editalText);
  console.log("Buscando chunks na base com query:", searchQuery.slice(0, 200));

  const matchedChunks: string[] = [];

  try {
    const { data: rpcChunks, error: rpcError } = await supabase.rpc("search_knowledge_chunks", {
      search_text: searchQuery || "softexpert",
      match_count: 25,
    });
    if (rpcError) {
      console.warn("Erro no search_knowledge_chunks, caindo no fallback:", rpcError);
    } else if (Array.isArray(rpcChunks)) {
      for (const c of rpcChunks) {
        const header = [c.title || c.file_name, c.solution_name, c.module_name]
          .filter(Boolean).join(" • ");
        matchedChunks.push(`### ${header}\n${c.content}`);
      }
    }
  } catch (e) {
    console.warn("Falha ao chamar RPC search_knowledge_chunks:", e);
  }

  // Fallback: pega chunks gerais mais recentes se a busca não retornar nada
  if (matchedChunks.length === 0) {
    console.log("Sem matches por busca; usando chunks recentes como contexto geral");
    const { data: fallbackChunks, error: fbError } = await supabase
      .from("knowledge_chunks")
      .select("content, solution_name, module_name, document_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (fbError) {
      console.error("Erro no fallback de knowledge_chunks:", fbError);
    } else if (fallbackChunks) {
      for (const c of fallbackChunks) {
        const header = [c.solution_name, c.module_name].filter(Boolean).join(" • ");
        matchedChunks.push(`### ${header}\n${c.content}`);
      }
    }
  }

  // Sempre concatena também a base resumida de kb_documents (se existir) para contexto institucional
  try {
    const { data: kbDocument } = await supabase
      .from("kb_documents")
      .select("conteudo_extraido")
      .eq("tipo", "knowledge_base")
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const baseText = String(kbDocument?.conteudo_extraido ?? "").trim();
    if (baseText) {
      matchedChunks.unshift(`### Base institucional SoftExpert\n${baseText}`);
    }
  } catch (e) {
    console.warn("Não foi possível carregar kb_documents complementar:", e);
  }

  const knowledgeContext = matchedChunks.join("\n\n---\n\n").slice(0, 60000);

  if (!knowledgeContext) {
    throw new StagedError("context_build", "Base de conhecimento SoftExpert está vazia");
  }

  console.log(`Contexto montado: ${matchedChunks.length} chunks, ${knowledgeContext.length} chars`);

  return { knowledgeContext, matchedChunks };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { fileBase64, filePath, editalText: providedEditalText, fileName } = parsed.data;

    let editalText = String(providedEditalText ?? "").trim();
    if (!editalText) {
      console.warn("Requisição sem editalText; extração de PDF foi desativada na Edge Function para evitar timeout de CPU", {
        hasFileBase64: Boolean(fileBase64),
        hasFilePath: Boolean(filePath),
      });
    }

    let knowledgeContext = "";
    let matchedChunks: string[] = [];
    try {
      const contextResult = await withTimeout(
        loadKnowledgeContext(editalText),
        10_000,
        "Tempo limite ao consultar a base de conhecimento",
      );
      knowledgeContext = contextResult.knowledgeContext;
      matchedChunks = contextResult.matchedChunks;
    } catch (e) {
      console.error("Erro ao carregar base; seguindo com análise sem contexto privado:", e);
      knowledgeContext = "";
      matchedChunks = [];
    }

    let resultado: any;
    try {
      resultado = await analyzeWithLovableAi(fileName, editalText, knowledgeContext);
    } catch (e) {
      console.error("Erro ao analisar com IA; usando fallback local:", e);
      resultado = buildMockResult(fileName, editalText, knowledgeContext);
    }

    // Persist result server-side (service role bypasses RLS)
    let licitacaoId: string | null = null;
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: inserted, error: insError } = await sb
        .from("licitacoes")
        .insert({ pdf_name: fileName, edital_text: editalText, resultado_json: resultado })
        .select("id")
        .single();
      if (insError) console.warn("Falha ao salvar licitacao:", insError);
      else licitacaoId = inserted?.id ?? null;
    } catch (e) {
      console.warn("Erro ao persistir licitacao:", e);
    }

    return new Response(
      JSON.stringify({
        editalText,
        resultado,
        licitacaoId,
        matchedChunksCount: matchedChunks.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    const stage = error instanceof StagedError ? error.stage : "unknown";
    const details = error instanceof StagedError ? error.details : undefined;
    console.error("analisar-edital error:", { stage, message: msg, details });
    return new Response(
      JSON.stringify({ error: msg, stage, details }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
