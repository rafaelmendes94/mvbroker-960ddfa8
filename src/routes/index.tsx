import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  SlidersHorizontal,
  FolderOpen,
  Send,
  Database,
  FileCode2,
  Globe2,
  BarChart3,
  Briefcase,
  Menu,
  X,
  BedDouble,
  Bath,
  Car,
  Maximize,
  MapPin,
  Check,
  Play,
  User,
  Users,
  Crown,
  Facebook,
  Instagram,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import bgDesktop from "@/assets/bg-mv.png.asset.json";
import bgMobile from "@/assets/bg-mobilemv.png.asset.json";
import logoMv from "@/assets/logo-mv.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MV BROKER — Sistema de Suporte Imobiliário" },
      {
        name: "description",
        content:
          "Sistema de suporte imobiliário para corretores e imobiliárias: base centralizada, carteira personalizada e distribuição via XML.",
      },
      { property: "og:title", content: "MV BROKER — Sistema de Suporte Imobiliário" },
      {
        property: "og:description",
        content:
          "Organize sua operação imobiliária. Pesquise, monte carteiras e distribua imóveis para os principais portais.",
      },
      { property: "og:image", content: bgDesktop.url },
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
  valor: number;
  dorm?: number;
  banh?: number;
  vagas?: number;
  area: number;
};

const IMOVEIS: Imovel[] = [
  { titulo: "Apartamento Vista Mar no Centro", cidade: "Capão da Canoa", bairro: "Centro", valor: 890000, dorm: 3, banh: 2, vagas: 1, area: 118 },
  { titulo: "Apartamento Alto Padrão Navegantes", cidade: "Capão da Canoa", bairro: "Navegantes", valor: 1450000, dorm: 3, banh: 3, vagas: 2, area: 142 },
  { titulo: "Casa em Condomínio Atlântida", cidade: "Xangri-lá", bairro: "Atlântida", valor: 2800000, dorm: 4, banh: 4, vagas: 3, area: 280 },
  { titulo: "Terreno em Condomínio Fechado", cidade: "Xangri-lá", bairro: "Remanso", valor: 520000, area: 420 },
  { titulo: "Apartamento Decorado Zona Nova", cidade: "Capão da Canoa", bairro: "Zona Nova", valor: 740000, dorm: 2, banh: 2, vagas: 1, area: 86 },
  { titulo: "Cobertura Duplex Beira-Mar", cidade: "Capão da Canoa", bairro: "Centro", valor: 2350000, dorm: 4, banh: 4, vagas: 3, area: 230 },
];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const NAV = [
  { label: "Início", href: "#inicio" },
  { label: "Como Funciona", href: "#como-funciona" },
  { label: "Imóveis em Destaque", href: "#imoveis" },
  { label: "Planos", href: "#planos" },
];

const STEPS = [
  { icon: Search, t: "Acesse a base de imóveis", d: "Consulte imóveis disponíveis em uma base centralizada e organizada." },
  { icon: SlidersHorizontal, t: "Pesquise oportunidades disponíveis", d: "Use filtros avançados para encontrar imóveis alinhados ao seu perfil." },
  { icon: FolderOpen, t: "Monte sua carteira personalizada", d: "Selecione os imóveis que deseja trabalhar e organize sua própria carteira." },
  { icon: Send, t: "Gere seu XML e distribua nos portais", d: "Copie seu link XML e publique automaticamente nos principais portais imobiliários." },
];

const BENEFITS = [
  { i: Database, t: "Base centralizada de imóveis", d: "Acesse uma base completa, organizada e sempre atualizada." },
  { i: Search, t: "Pesquisa avançada", d: "Encontre imóveis com filtros inteligentes e rápidos." },
  { i: FolderOpen, t: "Carteira personalizada", d: "Monte várias carteiras e organize como preferir." },
  { i: FileCode2, t: "XML por corretor ou imobiliária", d: "Gere seu feed XML exclusivo com atualização automática." },
  { i: Globe2, t: "Distribuição para portais", d: "Envie seus imóveis para os principais portais do Brasil." },
  { i: BarChart3, t: "Relatórios de performance", d: "Acompanhe resultados, acessos, downloads e muito mais." },
];

const WHATSAPP_FALLBACK = "5551983282535"; // Patrique Lopes (fallback)
const waLink = (numero: string, plano: string) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(
    `Olá Patrique! Tenho interesse no Plano ${plano} do MV BROKER e gostaria de mais informações para assinar.`
  )}`;

const PLANS = [
  {
    icon: User,
    name: "Corretor",
    desc: "Ideal para corretores autônomos.",
    items: ["1 usuário", "Carteiras ilimitadas", "XML exclusivo", "Distribuição para portais", "Relatórios básicos"],
    cta: "Assinar Plano Corretor",
    dark: false,
  },
  {
    icon: Users,
    name: "Imobiliária",
    desc: "Ideal para imobiliárias com equipe.",
    items: ["Usuários ilimitados", "Carteiras ilimitadas", "XMLs exclusivos", "Distribuição para portais", "Relatórios completos", "Suporte prioritário"],
    cta: "Assinar Plano Imobiliária",
    dark: false,
  },
  {
    icon: Crown,
    name: "Premium",
    desc: "Para operações maiores e multiusuários.",
    items: ["Tudo do plano Imobiliária", "Integrações avançadas", "Relatórios personalizados", "Suporte dedicado", "Consultoria especializada"],
    cta: "Falar sobre Plano Premium",
    dark: true,
  },
];

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [waNumero, setWaNumero] = useState(WHATSAPP_FALLBACK);

  useEffect(() => {
    supabase
      .rpc("get_contato_publico", { p_slug: "whatsapp_comercial" })
      .then(({ data }) => {
        const v = (data as string | null)?.replace(/\D/g, "");
        if (v && v.length >= 10) setWaNumero(v);
      });
  }, []);



  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#020617] text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex items-center gap-2 shrink-0">
            <img src={logoMv.url} alt="MV BROKER" className="h-8 w-auto" />
            <span className="hidden text-[10px] uppercase tracking-widest text-white/50 sm:block">
              Sistema de Suporte Imobiliário
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((i) => (
              <a key={i.href} href={i.href} className="text-sm font-medium text-white/80 transition-colors hover:text-white">
                {i.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:block">
            <Link to="/auth">
              <button className="inline-flex items-center gap-2 rounded-md border border-[#ffffff] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ffffff]">
                <User className="h-4 w-4" />
                Login
              </button>
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#020617] md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-4">
              {NAV.map((i) => (
                <a key={i.href} href={i.href} onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium text-white/80">
                  {i.label}
                </a>
              ))}
              <Link to="/auth" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-[#ffffff] px-4 py-2 text-sm font-semibold text-white">
                <User className="h-4 w-4" />
                Login
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="inicio" className="relative isolate overflow-hidden bg-[#020617] text-white">
        {/* Desktop bg */}
        <div
          className="absolute inset-0 hidden bg-cover bg-center md:block"
          style={{ backgroundImage: `url(${bgDesktop.url})` }}
          aria-hidden
        />
        {/* Mobile bg */}
        <div
          className="absolute inset-0 bg-cover bg-top md:hidden"
          style={{ backgroundImage: `url(${bgMobile.url})` }}
          aria-hidden
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/95 via-[#020617]/70 to-transparent md:block hidden" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/60 to-[#020617] md:hidden" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[600px] flex-col justify-end pb-12 pt-16 md:min-h-[640px] md:justify-center md:py-28 md:max-w-2xl">
            <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-[#ffffff]">MV</span> <span className="text-white">BROKER</span>
            </h1>
            <p className="mt-6 text-xl font-semibold text-white sm:text-2xl">
              Sistema de Suporte Imobiliário para corretores e imobiliárias.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80">
              Acesse uma base organizada de imóveis, selecione oportunidades, gere sua carteira personalizada e distribua seus imóveis para portais através de XML.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <a href="#planos">
                <Button size="lg" className="w-full bg-white px-8 text-base font-semibold text-[#020617] shadow-lg hover:bg-white/90 sm:w-auto">
                  Assinar Plano
                </Button>
              </a>
              <a href="#como-funciona">
                <Button size="lg" variant="outline" className="w-full gap-2 border-white/30 bg-transparent px-8 text-base font-semibold text-white hover:bg-white/10 hover:text-white sm:w-auto">
                  <Play className="h-4 w-4 fill-white" />
                  Ver Como Funciona
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-[#020617]">Como Funciona</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Simples, rápido e eficiente
            </h2>
          </div>
          <div className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, idx) => (
              <div key={s.t} className="relative text-center">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-7xl font-black text-slate-100 select-none">
                  {idx + 1}
                </span>
                <div className="relative">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#020617] text-white shadow-lg">
                    <s.icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-slate-900">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IMÓVEIS */}
      <section id="imoveis" className="bg-[#F8FAFC] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-sm font-bold uppercase tracking-widest text-slate-900">
            Imóveis em Destaque
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {IMOVEIS.map((im, idx) => (
              <div key={idx} className="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-lg">
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <img
                    src={MOCK_IMAGES[idx]}
                    alt={im.titulo}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute right-3 top-3 rounded-md bg-[#020617] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Destaque
                  </span>
                </div>
                <div className="space-y-2 p-5">
                  <h3 className="line-clamp-2 text-base font-bold text-slate-900">{im.titulo}</h3>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />
                    {im.cidade}, {im.bairro}
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1 text-xs text-slate-600">
                    {im.dorm !== undefined && im.dorm > 0 ? (
                      <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{im.dorm}</span>
                    ) : null}
                    {im.banh !== undefined && im.banh > 0 ? (
                      <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{im.banh}</span>
                    ) : null}
                    {im.vagas !== undefined && im.vagas > 0 ? (
                      <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{im.vagas}</span>
                    ) : null}
                    <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{im.area}m²</span>
                  </div>
                  <p className="pt-1 text-lg font-bold text-[#020617]">{fmtBRL(im.valor)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-sm font-bold uppercase tracking-widest text-slate-900">
            Por que escolher o <span className="text-[#020617]">MV BROKER</span>?
          </h2>
          <div className="mt-10 rounded-2xl bg-[#F8FAFC] p-6 md:p-10">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
              {BENEFITS.map((b) => (
                <div key={b.t} className="text-left">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md text-[#020617]">
                    <b.i className="h-7 w-7" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold leading-snug text-slate-900">{b.t}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{b.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="bg-[#020617] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-sm font-bold uppercase tracking-widest text-white">
            Planos que cabem no seu negócio
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className="flex flex-col overflow-hidden rounded-xl bg-white shadow-xl">
                <div className="flex-1 p-7">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#020617] text-white">
                    <p.icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-[#020617]">Plano {p.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{p.desc}</p>
                  <ul className="mt-6 space-y-2.5">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#020617]" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <a href={waLink(waNumero, p.name)} target="_blank" rel="noreferrer">
                  <button
                    className={`w-full py-3.5 text-sm font-semibold transition-colors ${
                      p.dark
                        ? "bg-[#020617] text-white hover:bg-[#020617]/90"
                        : "bg-[#020617] text-white hover:bg-[#020617]/90"
                    }`}
                  >
                    {p.cta}
                  </button>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-gradient-to-r from-[#020617] to-[#1f2937] py-12">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3 md:items-center lg:px-8">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Pronto para organizar sua operação imobiliária?
          </h2>
          <p className="text-sm leading-relaxed text-white/90">
            Assine o MV BROKER e transforme sua base de imóveis em uma central de distribuição profissional.
          </p>
          <div className="md:text-right">
            <Link to="/auth">
              <button className="rounded-md bg-white px-6 py-3 text-sm font-bold text-[#020617] shadow-md transition-colors hover:bg-white/95">
                Começar Agora
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#020617] py-14 text-white/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
              <img src={logoMv.url} alt="MV BROKER" className="h-8 w-auto" />
              <p className="mt-4 max-w-sm text-sm leading-relaxed">
                Sistema completo para corretores e imobiliárias organizarem, distribuírem e gerenciarem seus imóveis com eficiência.
              </p>
              <div className="mt-5 flex gap-3">
                <a href="#" aria-label="Facebook" className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
                  <Facebook className="h-4 w-4" />
                </a>
                <a href="#" aria-label="Instagram" className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
                  <Instagram className="h-4 w-4" />
                </a>
                <a href="#" aria-label="LinkedIn" className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
                  <Linkedin className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-bold text-white">Links Rápidos</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#inicio" className="hover:text-white">Início</a></li>
                <li><a href="#como-funciona" className="hover:text-white">Como Funciona</a></li>
                <li><a href="#imoveis" className="hover:text-white">Imóveis em Destaque</a></li>
                <li><a href="#planos" className="hover:text-white">Planos</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-bold text-white">Suporte</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-white">Fale Conosco</a></li>
                <li><a href="#" className="hover:text-white">Status do Sistema</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-bold text-white">Institucional</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Sobre o MV BROKER</a></li>
                <li><a href="#" className="hover:text-white">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-white">Política de Privacidade</a></li>
              </ul>
              <h4 className="mb-3 mt-6 text-sm font-bold text-white">Acesso</h4>
              <Link to="/auth">
                <button className="inline-flex items-center gap-2 rounded-md border border-[#ffffff] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ffffff]">
                  <User className="h-3.5 w-3.5" />
                  Login
                </button>
              </Link>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/50">
            © 2025 MV BROKER - Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
