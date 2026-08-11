import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Building2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupCorretor } from "@/lib/solicitacoes.functions";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — MV Broker" },
      {
        name: "description",
        content:
          "Cadastre sua conta de corretor ou imobiliária na MV Broker e comece a distribuir seus imóveis para os portais.",
      },
      { property: "og:title", content: "Criar conta — MV Broker" },
      {
        property: "og:description",
        content: "Cadastro de corretores e imobiliárias na plataforma MV Broker.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<"corretor" | "imobiliaria">("corretor");
  const [nome, setNome] = useState("");
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [creci, setCreci] = useState("");
  const [cidade, setCidade] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pré-seleção via link dos planos: /cadastro?tipo=imobiliaria
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tipo");
    if (t === "imobiliaria" || t === "corretor") setTipo(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== senha2) return toast.error("As senhas não conferem.");
    if (senha.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres.");
    setLoading(true);
    try {
      await signupCorretor({
        data: {
          tipo,
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          creci: creci.trim(),
          cidade: cidade.trim(),
          cnpj: cnpj.trim(),
          razao_social: razao.trim(),
          senha,
        },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        toast.success("Cadastro enviado! Faça login para acompanhar a aprovação.");
        navigate({ to: "/auth" });
      } else {
        toast.success("Cadastro enviado! Sua conta está em análise.");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  const isImob = tipo === "imobiliaria";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
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
            {isImob ? (
              <>Plano Imobiliária<br />para sua equipe.</>
            ) : (
              <>Plano Corretor<br />para você vender mais.</>
            )}
          </h1>
          <p className="mt-4 text-sidebar-foreground/70 max-w-md">
            Cadastre-se agora. Após a análise da nossa equipe, seu plano é liberado e o acesso é ativado.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/40">© {new Date().getFullYear()} MV Broker</div>
        <div aria-hidden className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight">
            {isImob ? "Criar conta de imobiliária" : "Criar conta de corretor"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha os dados. Após o envio, sua conta passa por aprovação da nossa equipe.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {([
              { v: "corretor", l: "Sou corretor" },
              { v: "imobiliaria", l: "Sou imobiliária" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setTipo(o.v)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  tipo === o.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-muted"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-nome">{isImob ? "Nome fantasia da imobiliária" : "Nome completo"}</Label>
              <Input id="c-nome" required maxLength={200} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            {isImob && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="c-razao">Razão social</Label>
                  <Input id="c-razao" required maxLength={200} value={razao} onChange={(e) => setRazao(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-cnpj">CNPJ</Label>
                  <Input id="c-cnpj" required maxLength={30} placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="c-email">E-mail</Label>
              <Input id="c-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-tel">Telefone / WhatsApp</Label>
                <Input id="c-tel" inputMode="tel" required maxLength={40} placeholder="(51) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-creci">CRECI {isImob ? "(jurídico)" : ""}</Label>
                <Input id="c-creci" required={!isImob} maxLength={40} value={creci} onChange={(e) => setCreci(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-cidade">Cidade</Label>
              <Input id="c-cidade" required maxLength={120} value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-senha">Senha</Label>
                <div className="relative">
                  <Input id="c-senha" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={72} value={senha} onChange={(e) => setSenha(e.target.value)} className="pr-10" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-senha2">Confirmar senha</Label>
                <Input id="c-senha2" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={72} value={senha2} onChange={(e) => setSenha2(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar cadastro
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Já tem conta? <Link to="/auth" className="text-primary hover:underline">Entrar</Link> ·{" "}
            <Link to="/" className="hover:text-foreground">Voltar para o início</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
