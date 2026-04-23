// Edge function: receives a PDF (base64), extracts text, calls (mocked) analysis API,
// returns the 12-section JSON result.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.25.76";
// @ts-ignore - npm specifier in Deno
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const requestSchema = z.object({
  fileBase64: z.string().min(1),
  fileName: z.string().min(1),
});

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return (text as string).trim();
}

function buildMockResult(fileName: string, text: string, knowledgeContext = "") {
  const preview = text.slice(0, 280).replace(/\s+/g, " ");
  const knowledgePreview = knowledgeContext
    ? ` Contexto SoftExpert considerado: ${knowledgeContext.slice(0, 420).replace(/\s+/g, " ")}`
    : " A base privada SoftExpert não retornou trechos diretamente relacionados para este edital.";
  return {
    secao_1_objeto:
      `Contratação de solução de software para gestão integrada, conforme descrito em ${fileName}. ` +
      `Trecho identificado: "${preview}..."`,
    secao_2_resumo_executivo:
      "Edital voltado à aquisição de plataforma corporativa com foco em automação de processos, " +
      "governança e conformidade. Modalidade pregão eletrônico, critério menor preço por lote.",
    secao_3_cronograma: {
      tipo: "tabela",
      colunas: ["Etapa", "Prazo"],
      linhas: [
        ["Publicação do edital", "D+0"],
        ["Impugnações", "D+3"],
        ["Sessão pública", "D+10"],
        ["Homologação", "D+25"],
        ["Assinatura do contrato", "D+35"],
      ],
    },
    secao_4_habilitacao:
      "Habilitação jurídica, fiscal, trabalhista e econômico-financeira. " +
      "Capital social mínimo de 10% do valor estimado. Certidões negativas atualizadas.",
    secao_5_atestados:
      "Atestado(s) de capacidade técnica comprovando fornecimento de solução similar em volume " +
      "mínimo de 50% do quantitativo licitado, emitido por pessoa jurídica de direito público ou privado.",
    secao_6_aderencia_matriz: {
      tipo: "tabela",
      colunas: ["Requisito", "Aderência SoftExpert", "Observação"],
      linhas: [
        ["Solução SaaS", "Total", "Oferta SoftExpert em nuvem"],
        ["Gestão estratégica de pessoas/desempenho", "Parcial", "Validar módulos e escopo funcional na base técnica"],
        ["Integrações corporativas", "Parcial", "Confirmar conectores, APIs e SSO exigidos"],
        ["Implantação e sustentação", "Total", "Apoiar proposta com metodologia e evidências da base"],
        ["Segurança e conformidade", "Parcial", "Revisar requisitos específicos do edital"],
      ],
    },
    secao_7_evidencias:
      "Documentação técnica, manuais, vídeos demonstrativos e ambiente de POC disponível mediante " +
      "solicitação. Cases públicos no portal SoftExpert.",
    secao_8_modulos:
      "BPM, GRC, Documentos, Auditoria, Riscos, Indicadores de Desempenho, Workflow.",
    secao_9_diferenciais:
      "Plataforma única integrada, baixo TCO, mais de 30 anos de mercado, suporte local, " +
      "metodologia própria de implantação e centro de excelência em Joinville/SC.",
    secao_10_riscos:
      "Prazo de implantação agressivo; exigência de atestado com quantitativo elevado; " +
      "possíveis customizações no módulo de auditoria.",
    secao_11_viabilidade:
      "Viável. Margem estimada saudável considerando reaproveitamento de implantações similares " +
      "e parceiros locais.",
    secao_12_go_nogo:
      "GO CONDICIONAL — recomendação preliminar de participação, condicionada à validação técnica detalhada " +
      "dos requisitos de gestão de desempenho, integrações, segurança e implantação." + knowledgePreview,
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

  const editalExcerpt = editalText.slice(0, 70000);
  const knowledgeExcerpt = knowledgeContext.slice(0, 18000);
  const prompt = `Você é uma especialista em licitações B2B e soluções SoftExpert. Analise o edital abaixo e compare os requisitos com a base privada SoftExpert fornecida. Responda SOMENTE com JSON válido, sem markdown, exatamente com as chaves: secao_1_objeto, secao_2_resumo_executivo, secao_3_cronograma, secao_4_habilitacao, secao_5_atestados, secao_6_aderencia_matriz, secao_7_evidencias, secao_8_modulos, secao_9_diferenciais, secao_10_riscos, secao_11_viabilidade, secao_12_go_nogo. Para secao_3_cronograma e secao_6_aderencia_matriz, use objeto {"tipo":"tabela","colunas":[],"linhas":[]} quando houver dados tabulares. Seja fiel ao edital, não invente capacidades: quando a base não comprovar aderência, marque como Parcial ou A validar.

Arquivo: ${fileName}

BASE PRIVADA SOFTEXPERT:
${knowledgeExcerpt || "Nenhum trecho relevante encontrado na base privada."}

EDITAL:
${editalExcerpt}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você produz análises técnicas de editais em JSON válido." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

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
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  return Array.from(new Set(words)).slice(0, 12).join(" ");
}

async function loadKnowledgeContext(req: Request, editalText: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey || !editalText.trim()) {
    return { knowledgeContext: "", matchedChunks: [] as string[] };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const searchText = buildSearchQuery(editalText);

  if (!searchText) {
    return { knowledgeContext: "", matchedChunks: [] as string[] };
  }

  const { data, error } = await supabase.rpc("search_knowledge_chunks", {
    search_text: searchText,
    match_count: 6,
    filter_solution: null,
    filter_module: null,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return { knowledgeContext: "", matchedChunks: [] as string[] };
  }

  const matchedChunks = data
    .map((item: any) => {
      const title = item.title ?? item.file_name ?? "Documento";
      const solution = item.solution_name ? ` | Solução: ${item.solution_name}` : "";
      const module = item.module_name ? ` | Módulo: ${item.module_name}` : "";
      return `- ${title}${solution}${module}\n${String(item.content ?? "").trim()}`;
    })
    .filter(Boolean);

  return {
    knowledgeContext: matchedChunks.join("\n\n"),
    matchedChunks,
  };
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

    const { fileBase64, fileName } = parsed.data;

    let editalText = "";
    try {
      const bytes = base64ToUint8Array(fileBase64);
      editalText = await extractPdfText(bytes);
    } catch (e) {
      console.error("Erro ao extrair PDF:", e);
      editalText = "";
    }

    const { knowledgeContext, matchedChunks } = await loadKnowledgeContext(req, editalText);

    let resultado: unknown;
    try {
      const apiResp = await fetch("https://n8mlsl-3000.csb.app/licitacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edital_text: editalText,
          file_name: fileName,
          knowledge_context: knowledgeContext || undefined,
        }),
      });
      const raw = await apiResp.text();
      if (!apiResp.ok) {
        throw new Error(`Webhook respondeu ${apiResp.status}: ${raw.slice(0, 300)}`);
      }
      try {
        resultado = JSON.parse(raw);
      } catch {
        throw new Error(`Resposta do webhook não é JSON válido: ${raw.slice(0, 300)}`);
      }
      // Se vier embrulhado em array (n8n costuma retornar [{...}])
      if (Array.isArray(resultado) && resultado.length > 0) {
        resultado = (resultado[0] as any).output ?? (resultado[0] as any).json ?? resultado[0];
      } else if (resultado && typeof resultado === "object" && (resultado as any).output) {
        resultado = (resultado as any).output;
      }
    } catch (e) {
      console.error("Erro ao chamar webhook:", e);
      const msg = e instanceof Error ? e.message : "Erro ao chamar webhook";
      return new Response(
        JSON.stringify({ error: msg, editalText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ editalText, resultado, knowledgeContext, matchedChunksCount: matchedChunks.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("analisar-edital error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
