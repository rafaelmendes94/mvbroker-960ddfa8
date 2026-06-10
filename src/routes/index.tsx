import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2,
  Search,
  Briefcase,
  Share2,
  BarChart3,
  Database,
  FileCode2,
  Globe2,
  Menu,
  X,
  BedDouble,
  Bath,
  Car,
  Maximize,
  MapPin,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MV BROKER — Sistema de Suporte Imobiliário" },
      {
        name: "description",
        content:
          "Plataforma de suporte imobiliário: base centralizada, carteira personalizada e distribuição via XML para portais.",
      },
      { property: "og:title", content: "MV BROKER — Sistema de Suporte Imobiliário" },
      {
        property: "og:description",
        content:
          "Organize sua operação imobiliária. Pesquise, monte carteiras e distribua imóveis para os principais portais.",
      },
    ],
  }),
  component: LandingPage,
});

const MOCK_IMAGES = [
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
  "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
];

type Imovel = {
  titulo: string;
  cidade: string;
  bairro: string;
  tipo: string;
  valor: number;
  dorm?: number;
  banh?: number;
  vagas?: number;
  area: number;
  badge: string;
};

const IMOVEIS: Imovel[] = [
  { titulo: "Apartamento Vista Mar no Centro", cidade: "Capão da Canoa", bairro: "Centro", tipo: "Apartamento", valor: 890000, dorm: 3, banh: 2, vagas: 1, area: 118, badge: "Vista Mar" },
  { titulo: "Apartamento Alto Padrão Navegantes", cidade: "Capão da Canoa", bairro: "Navegantes", tipo: "Apartamento", valor: 1450000, dorm: 3, banh: 3, vagas: 2, area: 142, badge: "Alto Padrão" },
  { titulo: "Casa em Condomínio Atlântida", cidade: "Xangri-lá", bairro: "Atlântida", tipo: "Casa em Condomínio", valor: 2800000, dorm: 4, banh: 4, vagas: 3, area: 280, badge: "Exclusivo" },
  { titulo: "Terreno em Condomínio Fechado", cidade: "Xangri-lá", bairro: "Remanso", tipo: "Terreno", valor: 520000, area: 420, badge: "Oportunidade" },
  { titulo: "Apartamento Decorado Zona Nova", cidade: "Capão da Canoa", bairro: "Zona Nova", tipo: "Apartamento", valor: 740000, dorm: 2, banh: 2, vagas: 1, area: 86, badge: "Decorado" },
  { titulo: "Cobertura Duplex Beira-Mar", cidade: "Capão da Canoa", bairro: "Centro", tipo: "Cobertura", valor: 2350000, dorm: 4, banh: 4, vagas: 3, area: 230, badge: "Beira-Mar" },
  { titulo: "Casa Moderna em Noiva do Mar", cidade: "Xangri-lá", bairro: "Noiva do Mar", tipo: "Casa", valor: 1280000, dorm: 3, banh: 3, vagas: 2, area: 190, badge: "Moderna" },
  { titulo: "Apartamento Compacto para Investimento", cidade: "Capão da Canoa", bairro: "Zona Nova", tipo: "Apartamento", valor: 480000, dorm: 1, banh: 1, vagas: 1, area: 54, badge: "Investimento" },
  { titulo: "Mansão em Condomínio de Luxo", cidade: "Xangri-lá", bairro: "Atlântida", tipo: "Casa em Condomínio", valor: 4900000, dorm: 5, banh: 6, vagas: 4, area: 420, badge: "Luxo" },
  { titulo: "Apartamento Frente Praça", cidade: "Capão da Canoa", bairro: "Centro", tipo: "Apartamento", valor: 680000, dorm: 2, banh: 2, vagas: 1, area: 78, badge: "Localização" },
];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const NAV = [
  { label: "Início", href: "#inicio" },
  { label: "Como Funciona", href: "#como-funciona" },
  { label: "Imóveis em Destaque", href: "#imoveis" },
  { label: "Planos", href: "#planos" },
];

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight">MV BROKER</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((i) => (
              <a key={i.href} href={i.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {i.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <a href="#planos">
              <Button size="sm">Assinar Plano</Button>
            </a>
          </div>

          <button className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-4">
              {NAV.map((i) => (
                <a key={i.href} href={i.href} onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium text-muted-foreground">
                  {i.label}
                </a>
              ))}
              <Link to="/auth" className="py-2 text-sm font-medium">Login</Link>
              <a href="#planos" className="pt-2">
                <Button size="sm" className="w-full">Assinar Plano</Button>
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="inicio" className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2 lg:px-8 lg:py-32">
          <div className="flex flex-col justify-center">
            <Badge className="mb-6 w-fit bg-primary/15 text-primary border-primary/20 hover:bg-primary/20">
              Sistema de Suporte Imobiliário
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              MV <span className="text-primary">BROKER</span>
            </h1>
            <p className="mt-4 text-xl font-medium text-sidebar-foreground/90">
              Sistema de Suporte Imobiliário para corretores e imobiliárias.
            </p>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-sidebar-foreground/70">
              Acesse uma base organizada de imóveis, selecione oportunidades, gere sua carteira personalizada e distribua seus imóveis para portais através de XML.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a href="#planos">
                <Button size="lg" className="gap-2">
                  Assinar Plano <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href="#como-funciona">
                <Button size="lg" variant="outline" className="border-sidebar-foreground/20 bg-transparent text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground">
                  Ver Como Funciona
                </Button>
              </a>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-transparent blur-3xl" />
            <img
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"
              alt="Imóvel premium"
              className="relative h-full max-h-[520px] w-full rounded-3xl object-cover shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Como Funciona</h2>
            <p className="mt-4 text-muted-foreground">Em quatro passos você organiza sua operação e amplia sua presença nos portais.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 1, t: "Acesse a base de imóveis", d: "Conecte-se a uma base unificada e atualizada de oportunidades." },
              { n: 2, t: "Pesquise oportunidades", d: "Filtros avançados para encontrar o imóvel certo em segundos." },
              { n: 3, t: "Monte sua carteira", d: "Selecione e organize sua carteira personalizada por cliente ou portal." },
              { n: 4, t: "Gere XML e distribua", d: "Exporte XML por corretor ou imobiliária e distribua nos portais." },
            ].map((s) => (
              <Card key={s.n} className="border-border/60 transition-all hover:border-primary/40 hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                    {s.n}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* IMÓVEIS */}
      <section id="imoveis" className="bg-muted/40 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Imóveis em Destaque</h2>
              <p className="mt-2 text-muted-foreground">Seleção ilustrativa de oportunidades em Capão da Canoa e Xangri-lá.</p>
            </div>
            <Badge variant="secondary" className="bg-background">Exemplos demonstrativos</Badge>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {IMOVEIS.map((im, idx) => (
              <Card key={idx} className="group overflow-hidden border-border/60 p-0 transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={MOCK_IMAGES[idx]}
                    alt={im.titulo}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <Badge className="absolute left-3 top-3 bg-primary text-primary-foreground shadow-md">{im.badge}</Badge>
                </div>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {im.bairro}, {im.cidade}
                  </div>
                  <h3 className="line-clamp-2 text-base font-semibold leading-snug">{im.titulo}</h3>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{im.tipo}</p>
                  <p className="text-xl font-bold text-primary">{fmtBRL(im.valor)}</p>
                  <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    {im.dorm !== undefined && (
                      <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {im.dorm}</span>
                    )}
                    {im.banh !== undefined && (
                      <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {im.banh}</span>
                    )}
                    {im.vagas !== undefined && (
                      <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {im.vagas}</span>
                    )}
                    <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {im.area}m²</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Tudo o que você precisa em um só lugar</h2>
            <p className="mt-4 text-muted-foreground">Recursos profissionais para corretores e imobiliárias de todos os tamanhos.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { i: Database, t: "Base centralizada de imóveis", d: "Toda a oferta organizada em um único repositório confiável." },
              { i: Search, t: "Pesquisa avançada", d: "Filtros por cidade, bairro, tipo, valor e características." },
              { i: Briefcase, t: "Carteira personalizada", d: "Monte e gerencie carteiras por cliente e por portal." },
              { i: FileCode2, t: "XML por corretor ou imobiliária", d: "Gere XML padronizado pronto para envio aos portais." },
              { i: Globe2, t: "Distribuição para portais", d: "Conecte-se aos principais portais imobiliários do mercado." },
              { i: BarChart3, t: "Relatórios de performance", d: "Acompanhe acessos, exportações e desempenho real." },
            ].map((b, i) => (
              <Card key={i} className="border-border/60">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                    <b.i className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{b.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="bg-muted/40 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Planos</h2>
            <p className="mt-4 text-muted-foreground">Escolha o plano ideal para sua operação.</p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                name: "Corretor",
                desc: "Ideal para corretores autônomos.",
                features: ["Acesso à base de imóveis", "Carteira personalizada", "Exportação XML individual", "Suporte por e-mail"],
                cta: "Assinar Plano",
                highlight: false,
              },
              {
                name: "Imobiliária",
                desc: "Ideal para imobiliárias com equipe.",
                features: ["Tudo do plano Corretor", "Gestão de corretores", "XML por imobiliária", "Relatórios da equipe", "Suporte prioritário"],
                cta: "Assinar Plano",
                highlight: true,
              },
              {
                name: "Premium",
                desc: "Para operações maiores e multiusuários.",
                features: ["Tudo do plano Imobiliária", "Multiusuários ilimitados", "Integrações avançadas", "Gerente de conta dedicado", "SLA personalizado"],
                cta: "Falar com Comercial",
                highlight: false,
              },
            ].map((p) => (
              <Card
                key={p.name}
                className={
                  p.highlight
                    ? "relative border-primary bg-sidebar text-sidebar-foreground shadow-2xl md:scale-105"
                    : "border-border/60"
                }
              >
                {p.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Mais escolhido
                  </Badge>
                )}
                <CardContent className="flex h-full flex-col p-8">
                  <h3 className="text-2xl font-bold">Plano {p.name}</h3>
                  <p className={`mt-2 text-sm ${p.highlight ? "text-sidebar-foreground/70" : "text-muted-foreground"}`}>{p.desc}</p>
                  <ul className="mt-8 flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? "text-primary" : "text-primary"}`} />
                        <span className={p.highlight ? "text-sidebar-foreground/90" : ""}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="mt-8">
                    <Button className="w-full" variant={p.highlight ? "default" : "outline"} size="lg">
                      {p.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-sidebar py-20 text-sidebar-foreground md:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pronto para organizar sua operação imobiliária?
          </h2>
          <p className="mt-6 text-lg text-sidebar-foreground/70">
            Assine o MV BROKER e transforme sua base de imóveis em uma central de distribuição profissional.
          </p>
          <div className="mt-10">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Começar Agora <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <span className="text-lg font-bold">MV BROKER</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Sistema de Suporte Imobiliário.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Links rápidos</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><a href="#como-funciona" className="hover:text-foreground">Como Funciona</a></li>
                <li><a href="#imoveis" className="hover:text-foreground">Imóveis</a></li>
                <li><a href="#planos" className="hover:text-foreground">Planos</a></li>
                <li><Link to="/auth" className="hover:text-foreground">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-foreground">Política de Privacidade</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} MV BROKER. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
