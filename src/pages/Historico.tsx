import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarIcon,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Trophy,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Licitacao = {
  id: string;
  pdf_name: string;
  data_consulta: string;
  ganhou: boolean | null;
  observacao: string | null;
  resultado_json: any;
};

type GanhouFiltro = "todos" | "ganhou" | "nao_ganhou" | "pendente";

const Historico = () => {
  const [items, setItems] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ganhouFiltro, setGanhouFiltro] = useState<GanhouFiltro>("todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("listar-licitacoes", { body: {} });
    if (error) {
      toast.error("Erro ao carregar histórico");
      console.error(error);
    } else {
      setItems(((data as any)?.items ?? []) as Licitacao[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      // ganhou
      if (ganhouFiltro === "ganhou" && it.ganhou !== true) return false;
      if (ganhouFiltro === "nao_ganhou" && it.ganhou !== false) return false;
      if (ganhouFiltro === "pendente" && it.ganhou !== null) return false;

      // search
      if (search) {
        const q = search.toLowerCase();
        if (
          !it.pdf_name.toLowerCase().includes(q) &&
          !(it.observacao ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      // date range
      const d = new Date(it.data_consulta);
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (d < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    });
  }, [items, search, ganhouFiltro, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = items.length;
    const ganhas = items.filter((i) => i.ganhou === true).length;
    const perdidas = items.filter((i) => i.ganhou === false).length;
    const pendentes = items.filter((i) => i.ganhou === null).length;
    return { total, ganhas, perdidas, pendentes };
  }, [items]);

  const updateGanhou = async (id: string, value: boolean | null) => {
    setSavingId(id);
    const previous = items;
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ganhou: value } : it)));
    const { error } = await supabase.functions.invoke("atualizar-licitacao", {
      body: { id, ganhou: value },
    });
    if (error) {
      toast.error("Erro ao atualizar status");
      setItems(previous);
    } else {
      toast.success("Status atualizado");
    }
    setSavingId(null);
  };

  const updateObservacao = async (id: string, value: string) => {
    setSavingId(id);
    const { error } = await supabase.functions.invoke("atualizar-licitacao", {
      body: { id, observacao: value },
    });
    if (error) toast.error("Erro ao salvar observação");
    else toast.success("Observação salva");
    setSavingId(null);
  };

  const limparFiltros = () => {
    setSearch("");
    setGanhouFiltro("todos");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute -bottom-px left-0 right-0 h-1" style={{ background: "var(--gradient-accent)" }} />
        <div className="container relative mx-auto px-4 py-8 md:py-10">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 32" className="h-7 w-7 text-accent" fill="currentColor" aria-hidden="true">
                <path d="M16 1.5l12.5 7.25v14.5L16 30.5 3.5 23.25V8.75L16 1.5z" />
              </svg>
              <span className="text-primary-foreground font-bold text-base tracking-tight">
                Soft<span className="text-accent">Expert</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-primary-foreground/90 hover:text-accent text-sm font-semibold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Nova análise
              </Link>
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-primary-foreground">
            Histórico de licitações
          </h1>
          <p className="mt-2 text-primary-foreground/80 text-sm md:text-base">
            Acompanhe e atualize o status das análises realizadas no LicitaExpert.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Ganhas" value={stats.ganhas} tone="success" />
          <StatCard label="Não ganhas" value={stats.perdidas} tone="destructive" />
          <StatCard label="Pendentes" value={stats.pendentes} tone="muted" />
        </div>

        {/* Filtros */}
        <Card className="p-4 md:p-5 mb-6 shadow-[var(--shadow-card)]">
          <div className="grid gap-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome do PDF ou observação"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Status
              </label>
              <Select value={ganhouFiltro} onValueChange={(v) => setGanhouFiltro(v as GanhouFiltro)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ganhou">Ganhas</SelectItem>
                  <SelectItem value="nao_ganhou">Não ganhas</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                De
              </label>
              <DateInput value={dateFrom} onChange={setDateFrom} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Até
              </label>
              <DateInput value={dateTo} onChange={setDateTo} />
            </div>

            <div className="md:col-span-1">
              <Button variant="ghost" onClick={limparFiltros} className="w-full">
                Limpar
              </Button>
            </div>
          </div>
        </Card>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            Nenhuma licitação encontrada com os filtros selecionados.
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <LicitacaoRow
                key={item.id}
                item={item}
                saving={savingId === item.id}
                onSetGanhou={(v) => updateGanhou(item.id, v)}
                onSaveObservacao={(v) => updateObservacao(item.id, v)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "destructive" | "muted";
}) => {
  const colorClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
      ? "text-destructive"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-primary";
  return (
    <Card className="p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("text-2xl md:text-3xl font-extrabold mt-1", colorClass)}>{value}</p>
    </Card>
  );
};

const DateInput = ({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, "dd/MM/yyyy") : <span>Selecionar</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={value}
        onSelect={onChange}
        initialFocus
        locale={ptBR}
        className={cn("p-3 pointer-events-auto")}
      />
    </PopoverContent>
  </Popover>
);

const LicitacaoRow = ({
  item,
  saving,
  onSetGanhou,
  onSaveObservacao,
}: {
  item: Licitacao;
  saving: boolean;
  onSetGanhou: (v: boolean | null) => void;
  onSaveObservacao: (v: string) => void;
}) => {
  const [obs, setObs] = useState(item.observacao ?? "");
  const dirty = obs !== (item.observacao ?? "");

  const recomendacao =
    typeof item.resultado_json?.secao_12_go_nogo === "string"
      ? item.resultado_json.secao_12_go_nogo.startsWith("GO")
        ? "GO"
        : item.resultado_json.secao_12_go_nogo.startsWith("NO-GO")
        ? "NO-GO"
        : null
      : null;

  return (
    <Card className="p-4 md:p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-secondary flex items-center justify-center text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground break-all">{item.pdf_name}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>
                  {format(new Date(item.data_consulta), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                {recomendacao && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-semibold",
                      recomendacao === "GO"
                        ? "border-success/50 text-success"
                        : "border-destructive/50 text-destructive",
                    )}
                  >
                    {recomendacao}
                  </Badge>
                )}
                <StatusBadge ganhou={item.ganhou} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Observação
            </label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Anotações sobre esta licitação..."
              rows={2}
              className="resize-y"
            />
            {dirty && (
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setObs(item.observacao ?? "")}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => onSaveObservacao(obs)} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Ganhou actions */}
        <div className="md:w-48 shrink-0">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            Resultado
          </label>
          <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
            <Button
              variant={item.ganhou === true ? "default" : "outline"}
              size="sm"
              onClick={() => onSetGanhou(true)}
              disabled={saving}
              className={cn(
                "justify-center md:justify-start",
                item.ganhou === true && "bg-success hover:bg-success/90 text-white",
              )}
            >
              <Trophy className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Ganhou</span>
            </Button>
            <Button
              variant={item.ganhou === false ? "default" : "outline"}
              size="sm"
              onClick={() => onSetGanhou(false)}
              disabled={saving}
              className={cn(
                "justify-center md:justify-start",
                item.ganhou === false && "bg-destructive hover:bg-destructive/90 text-white",
              )}
            >
              <XCircle className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Não ganhou</span>
            </Button>
            <Button
              variant={item.ganhou === null ? "default" : "outline"}
              size="sm"
              onClick={() => onSetGanhou(null)}
              disabled={saving}
              className="justify-center md:justify-start"
            >
              <CheckCircle2 className="h-4 w-4 md:mr-2 opacity-60" />
              <span className="hidden md:inline">Pendente</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

const StatusBadge = ({ ganhou }: { ganhou: boolean | null }) => {
  if (ganhou === true)
    return <Badge className="bg-success hover:bg-success text-white">Ganha</Badge>;
  if (ganhou === false)
    return <Badge className="bg-destructive hover:bg-destructive text-white">Não ganha</Badge>;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Pendente
    </Badge>
  );
};

export default Historico;
