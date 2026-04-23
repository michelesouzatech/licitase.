import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Loader2, LogIn, Mail, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { Session, User } from "@supabase/supabase-js";

type AuthMode = "signin" | "signup";

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login realizado com sucesso");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Conta criada. Confira seu e-mail para confirmar o acesso.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na autenticação";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setSubmitting(true);
    try {
      const redirect_uri = `${window.location.origin}${window.location.pathname}`;
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri });
      if (result?.error) throw result.error;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no login com Google";
      toast.error(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b border-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute -bottom-px left-0 right-0 h-1" style={{ background: "var(--gradient-accent)" }} />
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="h-8 w-8 text-accent" fill="currentColor" aria-hidden="true">
              <path d="M16 1.5l12.5 7.25v14.5L16 30.5 3.5 23.25V8.75L16 1.5z" />
            </svg>
            <span className="text-primary-foreground font-bold text-lg tracking-tight">
              Licita<span className="text-accent">Expert</span>
            </span>
          </div>
          <h1 className="mt-8 text-3xl md:text-5xl font-extrabold tracking-tight text-primary-foreground leading-[1.05]">
            Base privada de conhecimento Soft<span className="text-accent">Expert</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm md:text-base text-primary-foreground/80 leading-relaxed">
            Entre para analisar editais, subir documentos da base e consultar aderência por solução, módulo e funcionalidade.
          </p>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "Base por usuário",
                text: "Cada pessoa acessa apenas os próprios documentos, trechos e arquivos enviados.",
              },
              {
                icon: Mail,
                title: "Catálogo indexado",
                text: "PDF, TXT e Word são transformados em trechos pesquisáveis para consulta rápida.",
              },
              {
                icon: LogIn,
                title: "Análise com contexto",
                text: "O app usa sua base para reforçar aderência, módulos e diferenciais na análise.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title} className="p-5 shadow-[var(--shadow-card)]">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-bold text-foreground">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </Card>
            ))}
          </section>

          <Card className="p-6 shadow-[var(--shadow-elegant)]">
            <div className="inline-flex rounded-md border border-border bg-secondary p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === "signin"
                    ? "bg-background text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === "signup"
                    ? "bg-background text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground"
                }`}
              >
                Criar conta
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth-email">E-mail</Label>
                <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password">Senha</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button className="w-full" onClick={handleEmailAuth} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>

              <Button variant="outline" className="w-full" onClick={handleGoogleAuth} disabled={submitting}>
                Continuar com Google
              </Button>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {mode === "signin"
                  ? "Use seu login para acessar o histórico e a base de conhecimento privados."
                  : "Após criar a conta, confirme seu e-mail antes do primeiro acesso."}
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Sessão encerrada");
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando acesso...
      </div>
    );
  }

  if (!auth.session) {
    return <AuthScreen />;
  }

  return <>{children}</>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
