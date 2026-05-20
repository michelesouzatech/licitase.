export type TabelaSecao = {
  tipo: "tabela";
  colunas: string[];
  linhas: (string | number)[][];
};

export type Resultado = {
  secao_1_objeto: string;
  secao_2_resumo_executivo: string;
  secao_3_cronograma: string | TabelaSecao;
  secao_4_habilitacao: string | TabelaSecao;
  secao_5_atestados: string;
  secao_6_aderencia_matriz: string | TabelaSecao;
  secao_7_evidencias: string;
  secao_8_modulos: string;
  secao_9_diferenciais: string;
  secao_10_riscos: string;
  secao_11_viabilidade: string;
  secao_12_go_nogo: string;
};

export type SectionKey = keyof Resultado;

export type SectionMeta = {
  key: SectionKey;
  titulo: string;
};

export const SECTIONS: SectionMeta[] = [
  { key: "secao_1_objeto", titulo: "1. Identificação do Objeto" },
  { key: "secao_2_resumo_executivo", titulo: "2. Resumo Executivo" },
  { key: "secao_3_cronograma", titulo: "3. Cronograma" },
  { key: "secao_4_habilitacao", titulo: "4. Habilitação" },
  { key: "secao_5_atestados", titulo: "5. Atestados" },
  { key: "secao_6_aderencia_matriz", titulo: "6. Aderência - Matriz de Requisitos" },
  { key: "secao_7_evidencias", titulo: "7. Evidências" },
  { key: "secao_8_modulos", titulo: "8. Módulos SoftExpert" },
  { key: "secao_9_diferenciais", titulo: "9. Diferenciais" },
  { key: "secao_10_riscos", titulo: "10. Riscos" },
  { key: "secao_11_viabilidade", titulo: "11. Viabilidade" },
  { key: "secao_12_go_nogo", titulo: "12. Recomendação GO/NO-GO" },
] as const;

export const MAX_ANALYSIS_TEXT_CHARS = 90_000;
export const MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024;

export function isTabela(v: unknown): v is TabelaSecao {
  return (
    !!v &&
    typeof v === "object" &&
    "tipo" in v &&
    (v as Record<string, unknown>).tipo === "tabela"
  );
}

export type AderenciaScore = {
  score: number;
  total: number;
  total_total: number;
  total_parcial: number;
  total_nao: number;
};

export function calcularScoreAderencia(
  resultado: Resultado
): AderenciaScore | null {
  const matriz = resultado.secao_6_aderencia_matriz;
  if (!isTabela(matriz) || !matriz.linhas?.length) return null;

  const colIdx = matriz.colunas.findIndex((c) => /aderência|aderencia/i.test(c));
  const idx = colIdx >= 0 ? colIdx : 1;

  let total = 0;
  let parcial = 0;
  let nao = 0;

  for (const row of matriz.linhas) {
    const val = String(row[idx] ?? "").toLowerCase().trim();
    if (!val) continue;
    if (/^total|^plena|^atend|^sim/.test(val)) total++;
    else if (/parcial/.test(val)) parcial++;
    else nao++;
  }

  const totalLinhas = total + parcial + nao;
  if (totalLinhas === 0) return null;

  const score = Math.round(((total * 1 + parcial * 0.5) / totalLinhas) * 100);
  return { score, total: totalLinhas, total_total: total, total_parcial: parcial, total_nao: nao };
}
