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

const isGroup = (e: NavEntry): e is GroupItem => "children" in e;

const ALL_NAV: NavEntry[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/oportunidades", label: "Oportunidades", icon: Sparkles },
  { to: "/imoveis", label: "Imóveis", icon: Home },
  { to: "/central", label: "Central de Imóveis", icon: Search },
  {
    label: "Empreendimentos",
    icon: Layers,
    children: [
      
      { to: "/condominios", label: "Condomínios", icon: Building },
      { to: "/edificios", label: "Edifícios", icon: Building2 },
      { to: "/loteamentos", label: "Loteamentos", icon: Layers },
    ],
  },
  { to: "/usuarios", label: "Usuários", icon: Users },
  { to: "/clientes", label: "Clientes", icon: UserSquare2 },
  { to: "/planos", label: "Planos", icon: Tag },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/relatorios-admin", label: "Relatórios Admin", icon: BarChart3 },
  { to: "/imoveis/exportacao", label: "Exportação de Imóveis", icon: Download },
  { to: "/carteiras", label: "Carteiras XML", icon: Briefcase },
  { to: "/portais", label: "Portais", icon: Briefcase },
  { to: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { to: "/seguranca", label: "Segurança", icon: Lock },
  { to: "/biblioteca", label: "Biblioteca de Arquivos", icon: FolderArchive },
  { to: "/importacoes", label: "Importações", icon: Upload },
  { to: "/tabela", label: "Tabela", icon: FileText },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { roles } = useRoles();
  const effectiveRoles: AppRole[] = roles.length ? roles : ["corretor_autonomo"];
  const role = primaryRole(effectiveRoles);

  const items: NavEntry[] = ALL_NAV
    .map((e) => {
      if (isGroup(e)) {
        const children = e.children.filter((c) => canAccess(c.to, effectiveRoles));
        return children.length ? { ...e, children } : null;
      }
      return canAccess(e.to, effectiveRoles) ? e : null;
    })
    .filter(Boolean) as NavEntry[];

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 group">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground shrink-0 transition-transform group-hover:scale-105">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold tracking-tight text-base leading-tight">MV BROKER</div>
            <div className="text-[11px] text-sidebar-foreground/60 leading-tight truncate">
              Sistema de Suporte Imobiliário
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-2 mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">Menu</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground/80">
            {ROLE_LABEL[role]}
          </span>
        </div>
        <ul className="space-y-0.5">
          {items.map((item) =>
            isGroup(item) ? (
              <GroupNode key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
            ) : (
              <LeafNode key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
            )
          )}
        </ul>
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        <a href="#" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <LifeBuoy className="h-4 w-4" />
          Suporte
        </a>
      </div>
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
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          nested && "pl-9",
          active
            ? "bg-primary text-primary-foreground font-medium shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
          "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          hasActive
            ? "text-sidebar-foreground font-medium"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
