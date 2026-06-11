import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2, LayoutDashboard, Users, UserSquare2,
  BarChart3, Download, Settings, LifeBuoy, Building, Briefcase, ShieldCheck, FolderArchive, Home, Search, Lock,
  Tag, Sparkles, Upload, ChevronDown, Layers, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoles } from "@/hooks/use-roles";
import { canAccess, primaryRole, ROLE_LABEL, type AppRole } from "@/lib/permissions";

type LeafItem = { to: string; label: string; icon: typeof LayoutDashboard };
type GroupItem = { label: string; icon: typeof LayoutDashboard; children: LeafItem[] };
type NavEntry = LeafItem | GroupItem;
type Section = { section: string; entries: NavEntry[] };

const isGroup = (e: NavEntry): e is GroupItem => "children" in e;

const SECTIONS: Section[] = [
  {
    section: "Principal",
    entries: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/oportunidades", label: "Oportunidades", icon: Sparkles },
      { to: "/imoveis", label: "Imóveis", icon: Home },
      {
        label: "Empreendimentos",
        icon: Layers,
        children: [
          { to: "/condominios", label: "Condomínios", icon: Building },
          { to: "/edificios", label: "Edifícios", icon: Building2 },
          { to: "/loteamentos", label: "Loteamentos", icon: Layers },
        ],
      },
    ],
  },
  {
    section: "Gestão",
    entries: [
      { to: "/clientes", label: "Clientes", icon: UserSquare2 },
      { to: "/usuarios", label: "Usuários", icon: Users },
      { to: "/planos", label: "Planos", icon: Tag },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/relatorios-admin", label: "Relatórios Admin", icon: BarChart3 },
    ],
  },
  {
    section: "Distribuição",
    entries: [
      { to: "/imoveis/exportacao", label: "Exportação de Imóveis", icon: Download },
      { to: "/carteiras", label: "Carteiras XML", icon: Briefcase },
      { to: "/portais", label: "Portais", icon: Briefcase },
      { to: "/importacoes", label: "Importações", icon: Upload },
      { to: "/tabela", label: "Tabela", icon: FileText },
    ],
  },
  {
    section: "Sistema",
    entries: [
      { to: "/biblioteca", label: "Biblioteca de Arquivos", icon: FolderArchive },
      { to: "/auditoria", label: "Auditoria", icon: ShieldCheck },
      { to: "/seguranca", label: "Segurança", icon: Lock },
      { to: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { roles } = useRoles();
  const effectiveRoles: AppRole[] = roles.length ? roles : ["corretor_autonomo"];
  const role = primaryRole(effectiveRoles);

  const sections: Section[] = SECTIONS
    .map((s) => ({
      section: s.section,
      entries: s.entries
        .map((e) => {
          if (isGroup(e)) {
            const children = e.children.filter((c) => canAccess(c.to, effectiveRoles));
            return children.length ? { ...e, children } : null;
          }
          return canAccess(e.to, effectiveRoles) ? e : null;
        })
        .filter(Boolean) as NavEntry[],
    }))
    .filter((s) => s.entries.length > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 group">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-accent-foreground shrink-0 shadow-[var(--shadow-accent)] transition-transform group-hover:scale-105">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold tracking-tight text-base leading-tight text-white">MV BROKER</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-bold leading-tight truncate">
              {ROLE_LABEL[role]}
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-2">
        {sections.map((s) => (
          <div key={s.section}>
            <div className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-white/35 font-bold">
              {s.section}
            </div>
            <ul className="space-y-0.5">
              {s.entries.map((item) =>
                isGroup(item) ? (
                  <GroupNode key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
                ) : (
                  <LeafNode key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
                )
              )}
            </ul>
          </div>
        ))}
      </nav>

      {/* Plan card — apenas para clientes (corretores / imobiliárias) */}
      {!["super_admin", "admin", "secretaria"].includes(role) && (
        <div className="p-4">
          <div className="rounded-2xl bg-accent/10 border border-accent/20 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-white/50 mb-1">Plano Atual</p>
            <p className="text-sm font-extrabold text-accent">Premium Pro</p>
            <a
              href="#"
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white text-[#050914] text-[11px] font-extrabold tracking-wider uppercase py-2 hover:bg-white/90 transition-colors"
            >
              <LifeBuoy className="h-3.5 w-3.5 mr-1.5" />
              Suporte
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function LeafNode({ item, pathname, onNavigate, nested }: { item: LeafItem; pathname: string; onNavigate?: () => void; nested?: boolean }) {
  const active = pathname === item.to || pathname.startsWith(item.to + "/");
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all relative",
          nested && "pl-10",
          active
            ? "bg-accent/10 text-accent font-semibold border-l-[3px] border-accent rounded-l-none"
            : "text-white/60 hover:bg-white/5 hover:text-white",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}

function GroupNode({ item, pathname, onNavigate }: { item: GroupItem; pathname: string; onNavigate?: () => void }) {
  const hasActive = item.children.some((c) => pathname === c.to || pathname.startsWith(c.to + "/"));
  const [open, setOpen] = useState(hasActive);
  const Icon = item.icon;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all",
          hasActive
            ? "text-white font-semibold"
            : "text-white/60 hover:bg-white/5 hover:text-white",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children.map((c) => (
            <LeafNode key={c.to} item={c} pathname={pathname} onNavigate={onNavigate} nested />
          ))}
        </ul>
      )}
    </li>
  );
}
