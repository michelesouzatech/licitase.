import { useRef, useState, useCallback } from "react";
import { Loader2, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MAX_FILE_SIZE_BYTES } from "@/types/edital";
import type { Resultado } from "@/types/edital";
import { extractPdfTextInBrowser } from "@/utils/helpers";
import { assertIsResultado } from "@/utils/validation";
import { AnalysisResult } from "@/components/AnalysisResult";

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onPickFile = useCallback((f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie um arquivo PDF");
      return;
    }
    setFile(f);
    setResultado(null);
  }, []);

  const analisar = useCallback(async () => {
    if (!file) {
      toast.error("Selecione um PDF antes de analisar");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("PDF muito grande (limite 6MB)");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const editalText = await extractPdfTextInBrowser(file);

      if (controller.signal.aborted) return;

      const { data, error } = await supabase.functions.invoke("analisar-edital", {
        body: { editalText, fileName: file.name },
      });

      if (controller.signal.aborted) return;
      if (error) throw error;

      const resultadoValidado = assertIsResultado(
        (data as { resultado?: unknown })?.resultado
      );

      setResultado(resultadoValidado);
      toast.success("Análise concluída e salva no histórico");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error(`Falha na análise: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [file]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f) onPickFile(f);
    },
    [onPickFile]
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
            onDragOver={handleDragOver}
            onDrop={handleDrop}
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

        {resultado && <AnalysisResult resultado={resultado} fileName={file?.name} />}
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
