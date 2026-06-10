import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — MV Broker" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    await logAudit("login", `Login efetuado por ${email}`);
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard" });
  }



  async function handleForgot() {
    if (!email) return toast.error("Informe o e-mail primeiro.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-lg">MV BROKER</div>
            <div className="text-xs text-sidebar-foreground/60">Sistema de Suporte Imobiliário</div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Gestão imobiliária<br />sem complicação.
          </h1>
          <p className="mt-4 text-sidebar-foreground/70 max-w-md">
            Cadastros, relatórios, exportações e indicadores em uma única plataforma corporativa.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/40">© {new Date().getFullYear()} MV Broker</div>
        <div aria-hidden className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold tracking-tight">MV BROKER</div>
              <div className="text-xs text-muted-foreground">Sistema de Suporte Imobiliário</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
          <p className="text-sm text-muted-foreground mt-1">Acesse sua conta para continuar.</p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button type="button" onClick={handleForgot} className="text-xs text-primary hover:underline">
                  Esqueci minha senha
                </button>
              </div>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
            </Button>
          </form>

          <p className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            Não tem conta? O acesso é liberado pelo nosso time comercial.{" "}
            <a href="mailto:comercial@mvbroker.com.br" className="text-primary hover:underline">
              Fale conosco
            </a>
            .
          </p>


          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Voltar para o início</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
