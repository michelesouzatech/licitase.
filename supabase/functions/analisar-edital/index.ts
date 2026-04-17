// Edge function: receives a PDF (base64), extracts text, calls (mocked) analysis API,
// returns the 12-section JSON result.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// @ts-ignore - npm specifier in Deno
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { fileBase64, fileName } = body as { fileBase64?: string; fileName?: string };

    if (!fileBase64 || !fileName) {
      return new Response(
        JSON.stringify({ error: "fileBase64 e fileName são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let editalText = "";
    try {
      const bytes = base64ToUint8Array(fileBase64);
      editalText = await extractPdfText(bytes);
    } catch (e) {
      console.error("Erro ao extrair PDF:", e);
      editalText = "";
    }

    // TODO: substituir pelo endpoint real quando disponível
    // const apiResp = await fetch("https://api.yourcompany.com/licitacao", { ... })
    const resultado = buildMockResult(fileName, editalText || "(texto não extraído)");

    return new Response(
      JSON.stringify({ editalText, resultado }),
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
