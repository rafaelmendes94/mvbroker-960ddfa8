import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/seguranca/acessos")({
  component: Acessos,
});

type Acesso = {
  id: string;
  user_id: string | null;
  evento: string;
  descricao: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

function Acessos() {
  const [rows, setRows] = useState<Acesso[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("auditoria_acessos")
        .select("id, user_id, evento, descricao, ip, user_agent, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((data ?? []) as Acesso[]);
    })();
  }, []);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Navegador</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), "dd/MM HH:mm")}</TableCell>
                <TableCell><Badge variant="outline">{r.evento}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.user_id?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.ip ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[260px]">{r.user_agent ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[260px]">{r.descricao ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem acessos registrados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
