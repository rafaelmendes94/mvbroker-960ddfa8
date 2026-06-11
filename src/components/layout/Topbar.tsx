import { Bell, Menu, Search, Plus, LogOut, User as UserIcon, Settings, CheckCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();
  const { items, unread, marcarLida, marcarTodasLidas } = useNotifications(10);
  const recentes = items.slice(0, 8);

  async function handleLogout() {
    await logAudit("logout", `Logout: ${user?.email ?? ""}`);
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth" });
  }

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      <div className="flex items-center gap-3 h-20 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por clientes, imóveis..."
            className="pl-11 h-11 rounded-full bg-muted border-transparent focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>


        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full bg-muted hover:bg-muted/70 h-10 w-10">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] bg-accent text-accent-foreground border-2 border-card">
                    {unread > 99 ? "99+" : unread}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-96">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
                {unread > 0 && (
                  <button
                    onClick={() => marcarTodasLidas()}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Marcar todas
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              {recentes.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {recentes.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className={cn("flex flex-col items-start gap-1 py-3", !n.lida && "bg-primary/5")}
                      onClick={() => {
                        if (!n.lida) marcarLida(n.id);
                        if (n.link) navigate({ to: n.link });
                      }}
                    >
                      <div className="text-sm font-medium">{n.titulo}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/notificacoes" })} className="justify-center text-sm font-medium text-primary">
                Ver todas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-full hover:bg-muted pl-3 pr-1 py-1 transition-colors border-l border-border ml-1">
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-sm font-bold text-foreground truncate max-w-[160px]">{user?.email?.split("@")[0] ?? "Usuário"}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Conta MV Broker</span>
                </div>
                <Avatar className="h-9 w-9 ring-2 ring-muted">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate">{user?.email}</span>
                  <span className="text-xs text-muted-foreground">Conta MV Broker</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
                <UserIcon className="h-4 w-4 mr-2" /> Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
                <Settings className="h-4 w-4 mr-2" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
