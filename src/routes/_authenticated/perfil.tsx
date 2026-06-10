import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { AlterarSenhaCard } from "@/components/perfil/AlterarSenhaCard";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Perfil — MV Broker" }] }),
  component: Perfil,
});

function Perfil() {
  const { user } = useAuth();
  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <>
      <PageHeader title="Perfil do usuário" description="Gerencie suas informações pessoais." />
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="font-semibold">{user?.email ?? "Usuário"}</div>
            <div className="text-xs text-muted-foreground mt-1">Conta MV Broker</div>
            <Button variant="outline" size="sm" className="mt-4 w-full">Alterar foto</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Informações pessoais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome completo</Label><Input placeholder="Seu nome" /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" defaultValue={user?.email ?? ""} disabled /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input placeholder="(11) 99999-0000" /></div>
              <div className="space-y-2"><Label>Cargo</Label><Input placeholder="Ex.: Corretor" /></div>
              <div className="sm:col-span-2 flex justify-end pt-2">
                <Button><Save className="h-4 w-4" /> Salvar</Button>
              </div>
            </CardContent>
          </Card>

          <AlterarSenhaCard />
        </div>
      </div>
    </>
  );
}
