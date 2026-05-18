import { useMemo, useRef, useState } from "react";
import { Loader2, Upload, FileText, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { extractText } from "unpdf";

type TabelaSecao = {
  tipo: "tabela";
  colunas: string[];
  linhas: (string | number)[][];
};

type Resultado = {
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

const SECTIONS: { key: keyof Resultado; titulo: string }[] = [
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
];

const MAX_ANALYSIS_TEXT_CHARS = 90_000;

function isTabela(v: unknown): v is TabelaSecao {
  return !!v && typeof v === "object" && (v as any).tipo === "tabela";
}

function calcularScoreAderencia(
  resultado: Resultado,
): { score: number; total: number; total_total: number; total_parcial: number; total_nao: number } | null {
  const matriz = resultado.secao_6_aderencia_matriz;
  if (!isTabela(matriz) || !matriz.linhas?.length) return null;
  const colIdx = matriz.colunas.findIndex((c) => /aderência|aderencia/i.test(c));
  const idx = colIdx >= 0 ? colIdx : 1;
  let total = 0, parcial = 0, nao = 0;
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

async function extractPdfTextInBrowser(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { text } = await extractText(bytes, { mergePages: true });
  return String(text ?? "").trim().slice(0, MAX_ANALYSIS_TEXT_CHARS);
}

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie um arquivo PDF");
      return;
    }
    setFile(f);
    setResultado(null);
  };

  const analisar = async () => {
    if (!file) {
      toast.error("Selecione um PDF antes de analisar");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("PDF muito grande (limite 6MB)");
      return;
    }
    setLoading(true);
    try {
      const editalText = await extractPdfTextInBrowser(file);

      const { data, error } = await supabase.functions.invoke("analisar-edital", {
        body: { editalText, fileName: file.name },
      });
      if (error) throw error;
      const { resultado: r } = data as { resultado: Resultado };
      setResultado(r);

      toast.success("Análise concluída e salva no histórico");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error(`Falha na análise: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const exportarPDF = () => {
    if (!resultado) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFillColor(20, 45, 90);
    doc.rect(0, 0, pageW, 60, "F");
    doc.setTextColor(255);
    doc.setFontSize(16);
    doc.text("LicitaExpert · SoftExpert", margin, 38);
    doc.setFontSize(10);
    doc.text(file?.name ?? "", pageW - margin, 38, { align: "right" });
    y = 90;
    doc.setTextColor(20, 30, 50);

    // Aviso de confidencialidade
    doc.setFillColor(255, 247, 230);
    const avisoLines = doc.splitTextToSize(
      "CONFIDENCIALIDADE E SEGURANCA: Este relatorio foi gerado por Inteligencia Artificial para apoio a decisao. Os dados extraidos devem, obrigatoriamente, ser validados com as areas tecnicas e comerciais da SoftExpert. O processamento desta analise respeita as diretrizes de privacidade e uso etico de IA da companhia.",
      pageW - margin * 2 - 12,
    );
    const avisoH = avisoLines.length * 11 + 14;
    doc.rect(margin, y, pageW - margin * 2, avisoH, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 60, 0);
    doc.text(avisoLines, margin + 6, y + 12);
    y += avisoH + 14;
    doc.setTextColor(20, 30, 50);

    // Score de aderência
    const aderencia = calcularScoreAderencia(resultado);
    if (aderencia) {
      doc.setFillColor(245, 248, 252);
      doc.rect(margin, y, pageW - margin * 2, 50, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 45, 90);
      doc.text("Score de Aderência", margin + 10, y + 18);
      doc.setFontSize(22);
      doc.text(`${aderencia.score}%`, pageW - margin - 10, y + 28, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 90, 110);
      doc.text(
        `Total: ${aderencia.total_total}  ·  Parcial: ${aderencia.total_parcial}  ·  Não evidenciado: ${aderencia.total_nao}  (base: ${aderencia.total} requisitos)`,
        margin + 10,
        y + 38,
      );
      y += 64;
      doc.setTextColor(20, 30, 50);
    }

    SECTIONS.forEach(({ key, titulo }) => {
      const value = resultado[key];
      if (y > pageH - 80) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(titulo, margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      if (isTabela(value)) {
        autoTable(doc, {
          startY: y,
          head: [value.colunas],
          body: value.linhas.map((row) => row.map((c) => String(c))),
          margin: { left: margin, right: margin },
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [20, 45, 90], textColor: 255 },
          theme: "grid",
        });
        // @ts-ignore
        y = (doc as any).lastAutoTable.finalY + 18;
      } else {
        const text = String(value ?? "");
        const lines = doc.splitTextToSize(text, pageW - margin * 2);
        if (y + lines.length * 12 > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines, margin, y);
        y += lines.length * 12 + 12;
      }
    });

    const safe = (file?.name ?? "relatorio").replace(/\.pdf$/i, "");

    // Marca d'água diagonal em todas as páginas
    const totalPages = doc.getNumberOfPages();
    const watermarkLines = [
      "Desenvolvido por Michele Souza Cezar · Sales Ops",
      "SoftExpert Software S.A.",
      `© ${new Date().getFullYear()} LicitaExpert`,
    ];
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      // @ts-ignore - GState exists at runtime in jsPDF
      const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.12 }) : null;
      // @ts-ignore
      if (gs) (doc as any).setGState(gs);
      doc.setTextColor(20, 45, 90);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text(watermarkLines, pageW / 2, pageH / 2, {
        align: "center",
        angle: 30,
      });
      // restore opacity for subsequent pages drawing
      // @ts-ignore
      if ((doc as any).GState) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
    }

    doc.save(`${safe}-analise-softexpert.pdf`);
  };

  const dragHandlers = useMemo(
    () => ({
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onPickFile(f);
      },
    }),
    [],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_10%,white,transparent_45%)]" />
        <div className="absolute -bottom-px left-0 right-0 h-1" style={{ background: "var(--gradient-accent)" }} />
        <div className="container relative mx-auto px-4 py-10 md:py-16">
          {/* Brand bar */}
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 32" className="h-8 w-8 text-accent" fill="currentColor" aria-hidden="true">
                <path d="M16 1.5l12.5 7.25v14.5L16 30.5 3.5 23.25V8.75L16 1.5z" />
              </svg>
              <span className="text-primary-foreground font-bold text-lg tracking-tight">
                Soft<span className="text-accent">Expert</span>
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 mb-5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-primary-foreground text-[11px] font-semibold tracking-wider uppercase">
              Inteligência Comercial
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-primary-foreground leading-[1.05]">
            Licita<span className="text-accent">Expert</span>
          </h1>
          <p className="mt-3 text-primary-foreground/70 text-base md:text-lg font-medium">
            Análise automática de editais e termos de referência
          </p>
          <p className="mt-5 max-w-2xl text-primary-foreground/80 text-sm md:text-base leading-relaxed">
            Faça o upload de um edital ou TR em PDF e receba um parecer estruturado em
            12 seções para apoiar a decisão GO/NO-GO.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        {/* Upload */}
        <Card className="p-6 md:p-8 shadow-[var(--shadow-elegant)] -mt-12 md:-mt-16 relative bg-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Enviar documento</h2>
          <div
            {...dragHandlers}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/40 hover:bg-secondary/40 transition-colors rounded-xl p-6 md:p-10 text-center cursor-pointer"
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <div className="mx-auto h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-primary mb-3">
              {file ? <FileText className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
            </div>
            {file ? (
              <div>
                <p className="font-medium text-foreground break-all">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(file.size / 1024).toFixed(0)} KB · clique para trocar
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-foreground">Arraste o PDF aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .pdf</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              O texto extraído será salvo no histórico para aprendizado das próximas licitações.
            </p>
            <Button
              size="lg"
              onClick={analisar}
              disabled={!file || loading}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando...
                </>
              ) : (
                <>Analisar</>
              )}
            </Button>
          </div>
        </Card>

        {/* Resultado */}
        {resultado && (() => {
          const aderencia = calcularScoreAderencia(resultado);
          const scoreColor = aderencia
            ? aderencia.score >= 70
              ? "text-success"
              : aderencia.score >= 40
                ? "text-accent"
                : "text-destructive"
            : "";
          return (
          <section className="mt-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="text-xl font-bold text-foreground">Resultado da análise</h2>
              </div>
              <Button onClick={exportarPDF} variant="outline">
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

            {aderencia && (
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
                      <div className={`text-4xl md:text-5xl font-extrabold tracking-tight ${scoreColor}`}>
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
                    className={`h-full ${aderencia.score >= 70 ? "bg-success" : aderencia.score >= 40 ? "bg-accent" : "bg-destructive"}`}
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
        })()}
      </main>

      <footer className="border-t border-border mt-12 py-8 bg-secondary/40">
        <div className="container mx-auto px-4 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <svg viewBox="0 0 32 32" className="h-4 w-4 text-accent" fill="currentColor" aria-hidden="true">
              <path d="M16 1.5l12.5 7.25v14.5L16 30.5 3.5 23.25V8.75L16 1.5z" />
            </svg>
            <span>SoftExpert Software S.A.</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} LicitaExpert
          </p>
          <p className="text-xs text-muted-foreground">
            Desenvolvido por{" "}
            <span className="font-semibold text-foreground">Michele Souza Cezar</span>
            <span className="mx-1.5 text-accent">·</span>
            <span className="text-primary/80">Sales Ops</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
