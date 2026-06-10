import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, ROUTE_ACCESS, type AppRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/seguranca/permissoes")({
  component: Permissoes,
});

const MODULOS: { key: string; nome: string; permissoes: string[] }[] = [
  { key: "imoveis", nome: "Imóveis", permissoes: ["imoveis.view", "imoveis.create", "imoveis.edit", "imoveis.delete"] },
  { key: "arquivos", nome: "Arquivos", permissoes: ["arquivos.view", "arquivos.upload", "arquivos.download", "arquivos.delete"] },
  { key: "carteiras", nome: "Carteiras XML", permissoes: ["carteiras.view", "carteiras.create", "carteiras.edit", "carteiras.delete"] },
  { key: "xml", nome: "XML / Portais", permissoes: ["xml.generate", "xml.publish", "portais.manage"] },
  { key: "relatorios", nome: "Relatórios", permissoes: ["relatorios.view", "relatorios.export"] },
  { key: "usuarios", nome: "Usuários", permissoes: ["usuarios.view", "usuarios.manage", "usuarios.roles"] },
  { key: "configuracoes", nome: "Configurações", permissoes: ["configuracoes.view", "configuracoes.manage"] },
  { key: "seguranca", nome: "Segurança", permissoes: ["seguranca.view", "seguranca.manage", "sessoes.terminate"] },
];

const ROLES: AppRole[] = ["super_admin", "imobiliaria", "secretaria", "corretor_imobiliaria", "corretor_autonomo"];

function Permissoes() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Permissões por módulo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {MODULOS.map((m) => (
            <div key={m.key}>
              <div className="text-sm font-semibold mb-2">{m.nome}</div>
              <div className="flex flex-wrap gap-1.5">
                {m.permissoes.map((p) => (
                  <Badge key={p} variant="secondary" className="font-mono text-xs">{p}</Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Acesso por rota e perfil</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left p-2">Rota</th>
                  {ROLES.map((r) => <th key={r} className="text-center p-2">{ROLE_LABEL[r]}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(ROUTE_ACCESS).map(([path, allowed]) => (
                  <tr key={path} className="border-b">
                    <td className="p-2 font-mono text-xs">{path}</td>
                    {ROLES.map((r) => {
                      const ok = allowed.length === 0 || allowed.includes(r);
                      return (
                        <td key={r} className="text-center p-2">
                          {ok ? <span className="text-primary">✓</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
