import type { Resultado, TabelaSecao } from "@/types/edital";
import { isTabela } from "@/types/edital";

function isStringOrTabela(v: unknown): v is string | TabelaSecao {
  return typeof v === "string" || isTabela(v);
}

export function assertIsResultado(data: unknown): Resultado {
  if (!data || typeof data !== "object") {
    throw new Error("Resposta da API inválida: não é um objeto");
  }

  const d = data as Record<string, unknown>;
  const requiredKeys: (keyof Resultado)[] = [
    "secao_1_objeto",
    "secao_2_resumo_executivo",
    "secao_3_cronograma",
    "secao_4_habilitacao",
    "secao_5_atestados",
    "secao_6_aderencia_matriz",
    "secao_7_evidencias",
    "secao_8_modulos",
    "secao_9_diferenciais",
    "secao_10_riscos",
    "secao_11_viabilidade",
    "secao_12_go_nogo",
  ];

  for (const key of requiredKeys) {
    if (d[key] === undefined || d[key] === null) {
      throw new Error(`Resposta da API inválida: campo obrigatório "${key}" ausente`);
    }
    if (!isStringOrTabela(d[key])) {
      throw new Error(`Resposta da API inválida: campo "${key}" com tipo inesperado`);
    }
  }

  return d as unknown as Resultado;
}
