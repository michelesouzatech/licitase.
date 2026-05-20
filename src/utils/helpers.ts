import { MAX_ANALYSIS_TEXT_CHARS } from "@/types/edital";

export function sanitizeFileName(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
    .slice(0, 100);
}

export async function extractPdfTextInBrowser(file: File): Promise<string> {
  const { extractText } = await import("unpdf");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { text } = await extractText(bytes, { mergePages: true });
  return String(text ?? "").trim().slice(0, MAX_ANALYSIS_TEXT_CHARS);
}

export type ScoreVisualProps = {
  colorClass: string;
  bgClass: string;
};

export function getScoreVisualProps(score: number): ScoreVisualProps {
  if (score >= 70) return { colorClass: "text-success", bgClass: "bg-success" };
  if (score >= 40) return { colorClass: "text-accent", bgClass: "bg-accent" };
  return { colorClass: "text-destructive", bgClass: "bg-destructive" };
}
