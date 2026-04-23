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

function buildMockResult(fileName: string, text: string) {
  const preview = text.slice(0, 280).replace(/\s+/g, " ");
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
        ["Gestão de processos (BPM)", "Total", "Módulo nativo"],
        ["Gestão de riscos", "Total", "Módulo nativo"],
        ["Gestão documental", "Total", "Módulo nativo"],
        ["Auditoria", "Parcial", "Customização leve"],
        ["Integração SSO", "Total", "SAML/OAuth"],
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
      "GO — recomendação de participação. Atribuir squad de pré-venda dedicada e revisar matriz " +
      "de aderência detalhadamente antes da proposta final.",
  };
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
