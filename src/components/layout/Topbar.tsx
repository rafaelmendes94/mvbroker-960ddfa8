import { Bell, Menu, Search, Plus, LogOut, User as UserIcon, Settings } from "lucide-react";
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

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logAudit("logout", `Logout: ${user?.email ?? ""}`);
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth" });
  }

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
      <div className="flex items-center gap-3 h-16 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search */}
        <div className="flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Busca global..." className="pl-9 bg-muted/40 border-transparent focus-visible:bg-background" />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button variant="default" size="sm" className="hidden sm:inline-flex">
            <Plus className="h-4 w-4" />
            Novo
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] bg-primary">3</Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[1, 2, 3].map(i => (
                <DropdownMenuItem key={i} className="flex flex-col items-start gap-1 py-3">
                  <div className="text-sm font-medium">Novo cadastro recebido</div>
                  <div className="text-xs text-muted-foreground">Há {i * 10} minutos</div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full hover:bg-muted px-1 py-1 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
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
