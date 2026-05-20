import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Resultado, AderenciaScore, SectionMeta } from "@/types/edital";
import { isTabela } from "@/types/edital";
import { sanitizeFileName } from "./helpers";

interface JsPDFWithGState extends jsPDF {
  GState: new (opts: { opacity: number }) => unknown;
  setGState: (gs: unknown) => void;
}

const PDF_MARGIN = 40;
const PRIMARY_COLOR: [number, number, number] = [20, 45, 90];
const TEXT_COLOR: [number, number, number] = [20, 30, 50];

function addHeader(doc: jsPDF, fileName: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.text("LicitaExpert · SoftExpert", PDF_MARGIN, 38);
  doc.setFontSize(10);
  doc.text(fileName, pageW - PDF_MARGIN, 38, { align: "right" });
  doc.setTextColor(...TEXT_COLOR);
}

function addConfidentialityNotice(doc: jsPDF, startY: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const notice =
    "CONFIDENCIALIDADE E SEGURANCA: Este relatorio foi gerado por Inteligencia Artificial para apoio a decisao. Os dados extraidos devem, obrigatoriamente, ser validados com as areas tecnicas e comerciais da SoftExpert. O processamento desta analise respeita as diretrizes de privacidade e uso etico de IA da companhia.";

  doc.setFillColor(255, 247, 230);
  const lines = doc.splitTextToSize(notice, pageW - PDF_MARGIN * 2 - 12);
  const height = lines.length * 11 + 14;

  doc.rect(PDF_MARGIN, startY, pageW - PDF_MARGIN * 2, height, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 60, 0);
  doc.text(lines, PDF_MARGIN + 6, startY + 12);
  doc.setTextColor(...TEXT_COLOR);

  return startY + height + 14;
}

function addScoreSection(doc: jsPDF, aderencia: AderenciaScore, startY: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(245, 248, 252);
  doc.rect(PDF_MARGIN, startY, pageW - PDF_MARGIN * 2, 50, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("Score de Aderência", PDF_MARGIN + 10, startY + 18);

  doc.setFontSize(22);
  doc.text(`${aderencia.score}%`, pageW - PDF_MARGIN - 10, startY + 28, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 90, 110);
  doc.text(
    `Total: ${aderencia.total_total}  ·  Parcial: ${aderencia.total_parcial}  ·  Não evidenciado: ${aderencia.total_nao}  (base: ${aderencia.total} requisitos)`,
    PDF_MARGIN + 10,
    startY + 38
  );
  doc.setTextColor(...TEXT_COLOR);

  return startY + 64;
}

function addSections(doc: jsPDF, resultado: Resultado, sections: SectionMeta[], startY: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = startY;

  for (const { key, titulo } of sections) {
    if (y > pageH - 80) {
      doc.addPage();
      y = PDF_MARGIN;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_COLOR);
    doc.text(titulo, PDF_MARGIN, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const value = resultado[key];

    if (isTabela(value)) {
      autoTable(doc, {
        startY: y,
        head: [value.colunas],
        body: value.linhas.map((row) => row.map((c) => String(c))),
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: PRIMARY_COLOR, textColor: 255 },
        theme: "grid",
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable?.finalY + 18 ?? y + 20;
    } else {
      const text = String(value ?? "");
      const lines = doc.splitTextToSize(text, pageW - PDF_MARGIN * 2);
      if (y + lines.length * 12 > pageH - PDF_MARGIN) {
        doc.addPage();
        y = PDF_MARGIN;
      }
      doc.text(lines, PDF_MARGIN, y);
      y += lines.length * 12 + 12;
    }
  }
}

function addWatermark(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  const watermarkLines = [
    "Desenvolvido por Michele Souza Cezar · Sales Ops",
    "SoftExpert Software S.A.",
    `© ${new Date().getFullYear()} LicitaExpert`,
  ];

  const extendedDoc = doc as unknown as JsPDFWithGState;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (extendedDoc.GState) {
      const gs = new extendedDoc.GState({ opacity: 0.12 });
      extendedDoc.setGState(gs);
    }
    doc.setTextColor(...PRIMARY_COLOR);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(watermarkLines, pageW / 2, pageH / 2, {
      align: "center",
      angle: 30,
    });
    if (extendedDoc.GState) {
      extendedDoc.setGState(new extendedDoc.GState({ opacity: 1 }));
    }
  }
}

export function generateReportPdf(
  resultado: Resultado,
  sections: SectionMeta[],
  aderencia: AderenciaScore | null,
  rawFileName?: string
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const safeName = sanitizeFileName(rawFileName ?? "relatorio");

  addHeader(doc, rawFileName ?? "");
  let y = addConfidentialityNotice(doc, 90);

  if (aderencia) {
    y = addScoreSection(doc, aderencia, y);
  }

  addSections(doc, resultado, sections, y);
  addWatermark(doc);

  doc.save(`${safeName}-analise-softexpert.pdf`);
}
