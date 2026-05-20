import { useMemo } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SECTIONS, calcularScoreAderencia, isTabela } from "@/types/edital";
import type { Resultado } from "@/types/edital";
import { getScoreVisualProps } from "@/utils/helpers";
import { generateReportPdf } from "@/utils/pdfExport";

type AnalysisResultProps = {
  resultado: Resultado;
  fileName?: string;
};

export function AnalysisResult({ resultado, fileName }: AnalysisResultProps) {
  const aderencia = useMemo(() => calcularScoreAderencia(resultado), [resultado]);
  const scoreVisual = aderencia ? getScoreVisualProps(aderencia.score) : null;

  const handleExport = () => {
    generateReportPdf(resultado, SECTIONS, aderencia, fileName);
  };

  return (
    <section className="mt-10 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          <h2 className="text-xl font-bold text-foreground">Resultado da análise</h2>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Baixar PDF do resultado
        </Button>
      </div>

      <Card className="p-4 md:p-5 border-l-4 border-l-accent bg-accent/5">
        <p className="text-sm md:text-[15px] text-foreground/90 leading-relaxed">
          <span className="font-bold">⚠️ CONFIDENCIALIDADE E SEGURANÇA:</span>{" "}
          Este relatório foi gerado por Inteligência Artificial para apoio à decisão.
          Os dados extraídos devem, obrigatoriamente, ser validados com as áreas técnicas
          e comerciais da SoftExpert. O processamento desta análise respeita as diretrizes
          de privacidade e uso ético de IA da companhia.
        </p>
      </Card>

      {aderencia && scoreVisual && (
        <Card className="p-5 md:p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-base md:text-lg font-bold text-primary">Score de Aderência</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Calculado a partir da matriz de requisitos (seção 6).
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className={`text-4xl md:text-5xl font-extrabold tracking-tight ${scoreVisual.colorClass}`}>
                  {aderencia.score}%
                </div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                  Aderência geral
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <div className="font-bold text-success text-lg">{aderencia.total_total}</div>
                  <div className="text-muted-foreground">Total</div>
                </div>
                <div>
                  <div className="font-bold text-accent text-lg">{aderencia.total_parcial}</div>
                  <div className="text-muted-foreground">Parcial</div>
                </div>
                <div>
                  <div className="font-bold text-destructive text-lg">{aderencia.total_nao}</div>
                  <div className="text-muted-foreground">Não</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full ${scoreVisual.bgClass}`}
              style={{ width: `${aderencia.score}%` }}
            />
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {SECTIONS.map(({ key, titulo }) => {
          const value = resultado[key];
          return (
            <Card key={key} className="p-5 md:p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-base md:text-lg font-bold text-primary mb-3">{titulo}</h3>
              {isTabela(value) ? (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-secondary text-secondary-foreground">
                        {value.colunas.map((c) => (
                          <th key={c} className="text-left font-semibold px-3 py-2 border border-border">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {value.linhas.map((row, i) => (
                        <tr key={i} className="odd:bg-background even:bg-secondary/30">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 border border-border align-top">
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm md:text-base text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {String(value ?? "")}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
