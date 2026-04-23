import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Database, FileText, Loader2, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fileToBase64, formatBytes, normalizeTags } from "@/lib/document-utils";
import { useAuth } from "@/components/auth/AuthGate";
import { AuthStatus } from "@/components/auth/AuthStatus";

type KnowledgeDocument = {
  id: string;
  file_name: string;
  file_type: string;
  title: string | null;
  solution_name: string | null;
  module_name: string | null;
  tags: string[] | null;
  summary: string | null;
  processing_status: string;
  created_at: string;
  file_size_bytes: number | null;
};

type SearchChunk = {
  chunk_id: string;
  document_id: string;
  file_name: string;
  title: string | null;
  solution_name: string | null;
  module_name: string | null;
  content: string;
  rank: number;
};

const acceptedExtensions = [".pdf", ".txt", ".docx"];

const Conhecimento = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [results, setResults] = useState<SearchChunk[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [solutionName, setSolutionName] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [query, setQuery] = useState("");
  const [solutionFilter, setSolutionFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const docClient = supabase as any;

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    const { data, error } = await docClient
      .from("knowledge_documents")
      .select("id, file_name, file_type, title, solution_name, module_name, tags, summary, processing_status, created_at, file_size_bytes")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar a base de conhecimento");
    } else {
      setDocuments((data ?? []) as KnowledgeDocument[]);
    }
    setLoadingDocs(false);
  };

  const searchKnowledge = async (term = query) => {
    setSearching(true);
    const { data, error } = await docClient.rpc("search_knowledge_chunks", {
      search_text: term,
      match_count: 10,
      filter_solution: solutionFilter || null,
      filter_module: moduleFilter || null,
    });

    if (error) {
      toast.error("Erro ao buscar trechos");
      setResults([]);
    } else {
      setResults((data ?? []) as SearchChunk[]);
    }
    setSearching(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (!documents.length) return;
    setResults([]);
  }, [solutionFilter, moduleFilter]);

  const solutionOptions = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.solution_name).filter(Boolean))) as string[],
    [documents],
  );

  const moduleOptions = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.module_name).filter(Boolean))) as string[],
    [documents],
  );

  const totals = useMemo(
    () => ({
      docs: documents.length,
      modules: moduleOptions.length,
      solutions: solutionOptions.length,
    }),
    [documents, moduleOptions.length, solutionOptions.length],
  );

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!acceptedExtensions.some((ext) => lower.endsWith(ext))) {
      toast.error("Envie um arquivo PDF, TXT ou DOCX");
      return;
    }
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) {
      toast.error("Selecione um arquivo para enviar");
      return;
    }

    setUploading(true);
    try {
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("knowledge-base")
        .upload(storagePath, selectedFile, { upsert: false });

      if (uploadError) throw uploadError;

      const fileBase64 = await fileToBase64(selectedFile);
      const tags = normalizeTags(tagsInput);
      const { error: processError } = await supabase.functions.invoke("process-knowledge-document", {
        body: {
          fileBase64,
          fileName: selectedFile.name,
          fileType: selectedFile.name.split(".").pop()?.toLowerCase() ?? "",
          storagePath,
          title: title || null,
          solutionName: solutionName || null,
          moduleName: moduleName || null,
          tags,
          fileSizeBytes: selectedFile.size,
        },
      });

      if (processError) throw processError;

      toast.success("Documento processado e indexado na base de conhecimento");
      setSelectedFile(null);
      setTitle("");
      setSolutionName("");
      setModuleName("");
      setTagsInput("");
      await fetchDocuments();
      if (query) {
        await searchKnowledge();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar documento";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b border-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute -bottom-px left-0 right-0 h-1" style={{ background: "var(--gradient-accent)" }} />
        <div className="container relative mx-auto px-4 py-8 md:py-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 32 32" className="h-7 w-7 text-accent" fill="currentColor" aria-hidden="true">
                  <path d="M16 1.5l12.5 7.25v14.5L16 30.5 3.5 23.25V8.75L16 1.5z" />
                </svg>
                <span className="text-primary-foreground font-bold text-base tracking-tight">
                  Soft<span className="text-accent">Expert</span>
                </span>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/" className="text-sm font-semibold text-primary-foreground/80 transition-colors hover:text-accent">
                  Nova análise
                </Link>
                <span className="text-primary-foreground/35">•</span>
                <Link to="/historico" className="text-sm font-semibold text-primary-foreground/80 transition-colors hover:text-accent">
                  Histórico
                </Link>
              </div>
            </div>
            <AuthStatus />
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-primary-foreground">
            Base de conhecimento
          </h1>
          <p className="mt-2 max-w-3xl text-sm md:text-base text-primary-foreground/80">
            Suba catálogos e documentos da SoftExpert para indexar funcionalidades, módulos e evidências que serão usados nas análises de editais.
          </p>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard icon={Database} label="Documentos" value={totals.docs} />
          <MetricCard icon={BookOpen} label="Soluções" value={totals.solutions} />
          <MetricCard icon={FileText} label="Módulos" value={totals.modules} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Novo documento</h2>
            </div>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="knowledge-file">Arquivo</Label>
                <Input
                  id="knowledge-file"
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">Formatos aceitos: PDF, TXT e DOCX.</p>
                {selectedFile && <p className="text-xs font-medium text-foreground">{selectedFile.name} · {formatBytes(selectedFile.size)}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge-title">Título</Label>
                <Input id="knowledge-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Catálogo SE Suite" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="knowledge-solution">Solução</Label>
                  <Input id="knowledge-solution" value={solutionName} onChange={(e) => setSolutionName(e.target.value)} placeholder="Ex.: SE Suite" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="knowledge-module">Módulo</Label>
                  <Input id="knowledge-module" value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="Ex.: BPM" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge-tags">Tags</Label>
                <Input id="knowledge-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="bpm, workflow, governança" />
              </div>
              <Button onClick={handleUpload} disabled={!selectedFile || uploading} className="w-full">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar e indexar"}
              </Button>
            </div>
          </Card>

          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Buscar conhecimento</h2>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar funcionalidade, evidência ou módulo" />
              <Input list="solution-options" value={solutionFilter} onChange={(e) => setSolutionFilter(e.target.value)} placeholder="Solução" />
              <Input list="module-options" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} placeholder="Módulo" />
              <Button onClick={() => searchKnowledge()} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
            <datalist id="solution-options">
              {solutionOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
            <datalist id="module-options">
              {moduleOptions.map((option) => <option key={option} value={option} />)}
            </datalist>

            <div className="mt-5 space-y-3">
              {results.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Faça uma busca para localizar trechos relevantes da sua base.
                </div>
              ) : (
                results.map((result) => (
                  <Card key={result.chunk_id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{result.title || result.file_name}</p>
                      {result.solution_name && <Badge variant="secondary">{result.solution_name}</Badge>}
                      {result.module_name && <Badge variant="outline">{result.module_name}</Badge>}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">{result.content}</p>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-foreground">Documentos indexados</h2>
          <div className="mt-4 space-y-3">
            {loadingDocs ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </Card>
            ) : documents.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nenhum documento enviado ainda.</Card>
            ) : (
              documents.map((doc) => (
                <Card key={doc.id} className="p-4 shadow-[var(--shadow-card)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{doc.title || doc.file_name}</p>
                        <Badge variant="outline">{doc.file_type.toUpperCase()}</Badge>
                        <Badge variant={doc.processing_status === "processed" ? "secondary" : "outline"}>{doc.processing_status}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {doc.solution_name && <span>Solução: {doc.solution_name}</span>}
                        {doc.module_name && <span>Módulo: {doc.module_name}</span>}
                        {doc.file_size_bytes ? <span>Tamanho: {formatBytes(doc.file_size_bytes)}</span> : null}
                      </div>
                      {doc.summary && <Textarea value={doc.summary} readOnly rows={3} className="mt-3 resize-none" />}
                    </div>
                    {doc.tags?.length ? (
                      <div className="flex max-w-xs flex-wrap gap-2">
                        {doc.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Card>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

function MetricCard({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
  return (
    <Card className="p-4 shadow-[var(--shadow-card)]">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-foreground">{value}</p>
    </Card>
  );
}

export default Conhecimento;
