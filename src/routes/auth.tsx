import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Building2, Loader2, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

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
      redirectTo: `${window.location.origin}/reset-password`,
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
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
            </Button>
          </form>

          <p className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            Não tem conta? O acesso é liberado pelo nosso time comercial.{" "}
            <a
              href="https://wa.me/5551983282535"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004c-1.058 0-2.099-.27-3.016-.784l-.216-.127-2.244.588.6-2.183-.142-.225c-.621-.98-.95-2.115-.95-3.275 0-3.393 2.771-6.154 6.18-6.154 1.652 0 3.204.644 4.369 1.814 1.165 1.17 1.806 2.724 1.806 4.373 0 3.392-2.775 6.154-6.185 6.154m10.849-8.003c0-5.908-4.808-10.716-10.717-10.716-5.908 0-10.716 4.808-10.716 10.716 0 1.89.493 3.717 1.428 5.33l-1.492 5.438 5.559-1.459c1.559.85 3.314.299 4.221.299 5.908 0 10.717-4.808 10.717-10.716" />
              </svg>
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
