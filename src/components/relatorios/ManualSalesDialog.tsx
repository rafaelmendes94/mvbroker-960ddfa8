import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Plus, Trash2, FileSpreadsheet, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Agenciamento } from "@/hooks/useAgenciamentos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

const COLUMNS: { key: keyof Agenciamento; label: string; type?: "number" | "date" }[] = [
  { key: "imovel", label: "Imóvel" },
  { key: "tipo", label: "Tipo (AP, Casa, Terreno...)" },
  { key: "padrao", label: "Padrão (Cobertura, Duplex...)" },
  { key: "apto_quadra_lote", label: "Apto/Quadra/Lote" },
  { key: "box", label: "Box" },
  { key: "dormitorios", label: "Dormitórios (ex: 2D 1S)" },
  { key: "metragem", label: "Metragem (m²)", type: "number" },
  { key: "ano_construcao_iptu", label: "Ano construção / IPTU" },
  { key: "posicao", label: "Posição (Frente/Fundos/Lateral)" },
  { key: "mobiliado", label: "Mobiliado (MOB/DEC/VAZIO)" },
  { key: "destaque", label: "Destaque" },
  { key: "bairro", label: "Bairro" },
  { key: "rua", label: "Rua" },
  { key: "valor", label: "Valor (R$)", type: "number" },
  { key: "fin_bancario", label: "Financiamento bancário" },
  { key: "entrada", label: "Entrada" },
  { key: "prazo_direto", label: "Prazo direto" },
  { key: "condicao_pagamento", label: "Condição de pagamento" },
  { key: "observacoes", label: "Observações" },
  { key: "cond_iptu", label: "Condomínio / IPTU" },
  { key: "chaves_obra", label: "Chaves / Obra" },
  { key: "proprietario", label: "Proprietário" },
  { key: "telefone", label: "Telefone" },
  { key: "cidade", label: "Cidade" },
  { key: "data_inclusao", label: "Data Inclusão", type: "date" },
  { key: "data_atualizacao", label: "Data Atualização", type: "date" },
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "novo_semana", label: "Novo na semana" },
  { value: "atualizado_semana", label: "Atualizado na semana" },
  { value: "vendido", label: "Vendido" },
];

const empty: Record<string, any> = COLUMNS.reduce((acc, c) => {
  acc[c.key] = c.type === "number" ? "" : c.type === "date" ? new Date().toISOString().slice(0, 10) : "";
  return acc;
}, { status: "ativo" } as Record<string, any>);

export function ManualSalesDialog({ open, onOpenChange, onChanged }: Props) {
  const [list, setList] = useState<Agenciamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(empty);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("agenciamentos")
      .select("*")
      .order("data_inclusao", { ascending: false });
    setList((data || []) as Agenciamento[]);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const downloadTemplate = () => {
    const sample: Record<string, any> = {
      imovel: "PUERTO MADERO",
      tipo: "AP",
      padrao: "AP",
      apto_quadra_lote: "606",
      box: "68",
      dormitorios: "1D",
      metragem: 43,
      ano_construcao_iptu: "",
      posicao: "",
      mobiliado: "MOB",
      destaque: "",
      bairro: "ZONA NOVA",
      rua: "JOSÉ MILTON LOPES",
      valor: 540000,
      fin_bancario: "",
      entrada: "",
      prazo_direto: "",
      condicao_pagamento: "AVISTA FAZ 460",
      observacoes: "",
      cond_iptu: "",
      chaves_obra: "COM ELE",
      proprietario: "GLADEMIR",
      telefone: "54999814498",
      cidade: "Capão da Canoa",
      data_inclusao: "2026-03-12",
      data_atualizacao: "",
      status: "ativo",
    };
    const ws = XLSX.utils.json_to_sheet([sample]);
    ws["!cols"] = Object.keys(sample).map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agenciamentos");
    XLSX.writeFile(wb, "modelo-agenciamentos.xlsx");
  };

  const parseDate = (v: any): string | null => {
    if (!v) return null;
    if (typeof v === "number") {
      return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
    }
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const yyyy = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${yyyy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    return s.slice(0, 10);
  };

  const handleAdd = async () => {
    if (!form.imovel || !form.valor) {
      toast.error("Imóvel e Valor são obrigatórios");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Faça login"); return; }

    const payload: any = { user_id: u.user.id };
    COLUMNS.forEach(c => {
      const v = form[c.key];
      if (c.type === "number") payload[c.key] = Number(v) || 0;
      else if (c.type === "date") payload[c.key] = v || null;
      else payload[c.key] = v || "";
    });
    payload.status = form.status || "ativo";

    const { error } = await (supabase as any).from("agenciamentos").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Agenciamento adicionado");
    setForm(empty);
    await load();
    onChanged();
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Faça login"); return; }

      const payload = rows
        .filter(r => r.imovel || r.IMOVEL || r["IMÓVEL"] || r.titulo)
        .map(r => {
          const get = (...keys: string[]) => {
            for (const k of keys) {
              if (r[k] !== undefined && r[k] !== "") return r[k];
              const upper = k.toUpperCase();
              if (r[upper] !== undefined && r[upper] !== "") return r[upper];
            }
            return "";
          };
          return {
            user_id: u.user!.id,
            imovel: String(get("imovel", "IMOVEL", "IMÓVEL") || ""),
            tipo: String(get("tipo", "TIPO") || ""),
            padrao: String(get("padrao", "PADRÃO", "PADRAO") || ""),
            apto_quadra_lote: String(get("apto_quadra_lote", "N° APTO QUADRA   LOTE", "apto") || ""),
            box: String(get("box", "BOX") || ""),
            dormitorios: String(get("dormitorios", "DOR", "dor") || ""),
            metragem: Number(get("metragem", "M²", "m2")) || 0,
            ano_construcao_iptu: String(get("ano_construcao_iptu", "ANO DA CONSTRUÇÃO IPTU") || ""),
            posicao: String(get("posicao", "FRENTE   FUNDOS LATERAL", "posição") || ""),
            mobiliado: String(get("mobiliado", "MOBILIADO DECORADO") || ""),
            destaque: String(get("destaque", "DESTAQUE") || ""),
            bairro: String(get("bairro", "BAIRRO") || ""),
            rua: String(get("rua", "RUA") || ""),
            valor: Number(get("valor", "R$", "preco")) || 0,
            fin_bancario: String(get("fin_bancario", "FIN. BANCARIO") || ""),
            entrada: String(get("entrada", "ENTRADA") || ""),
            prazo_direto: String(get("prazo_direto", "PRAZO DIRETO") || ""),
            condicao_pagamento: String(get("condicao_pagamento", "CONDIÇÃO PAG") || ""),
            observacoes: String(get("observacoes", "OBSERVAÇÕES") || ""),
            cond_iptu: String(get("cond_iptu", "COND        -           IPTU") || ""),
            chaves_obra: String(get("chaves_obra", "CHAVES         OBRA") || ""),
            proprietario: String(get("proprietario", "PROPRIETARIO NUMERO") || ""),
            telefone: String(get("telefone", "NUMERO") || ""),
            cidade: String(get("cidade", "CIDADE") || ""),
            data_inclusao: parseDate(get("data_inclusao", "DATA INCLUSÃO")),
            data_atualizacao: parseDate(get("data_atualizacao", "ATUALIZADA DIA")),
            status: String(get("status") || "ativo"),
          };
        });

      if (payload.length === 0) { toast.error("Nenhuma linha válida (precisa coluna 'imovel')"); return; }

      const CHUNK = 500;
      let total = 0;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const { error } = await (supabase as any).from("agenciamentos").insert(chunk);
        if (error) { toast.error(error.message); return; }
        total += chunk.length;
      }
      toast.success(`${total} agenciamento(s) importado(s)`);
      await load();
      onChanged();
    } catch (e: any) {
      toast.error("Erro ao ler planilha: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este agenciamento?")) return;
    await (supabase as any).from("agenciamentos").delete().eq("id", id);
    toast.success("Excluído");
    await load();
    onChanged();
  };

  const handleClearAll = async () => {
    if (!confirm(`Excluir TODOS os ${list.length} agenciamentos? Esta ação não pode ser desfeita.`)) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase as any).from("agenciamentos").delete().eq("user_id", u.user.id);
    toast.success("Todos excluídos");
    await load();
    onChanged();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      novo_semana: "bg-emerald-100 text-emerald-900 border-emerald-300",
      atualizado_semana: "bg-amber-100 text-amber-900 border-amber-300",
      vendido: "bg-red-100 text-red-900 border-red-300",
      ativo: "bg-slate-100 text-slate-700 border-slate-300",
    };
    const labels: Record<string, string> = {
      novo_semana: "Novo",
      atualizado_semana: "Atualizado",
      vendido: "Vendido",
      ativo: "Ativo",
    };
    return <Badge variant="outline" className={`text-[10px] ${map[s] || map.ativo}`}>{labels[s] || s}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" /> Agenciamentos (Carteira de Imóveis)
          </DialogTitle>
          <DialogDescription>
            Cadastre ou importe sua carteira de captação. Os dados alimentam o BI de Agenciamentos em /relatorios.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="upload"><Upload className="w-4 h-4 mr-1" /> Upload Planilha</TabsTrigger>
            <TabsTrigger value="manual"><Plus className="w-4 h-4 mr-1" /> Adicionar Manual</TabsTrigger>
            <TabsTrigger value="list"><FileSpreadsheet className="w-4 h-4 mr-1" /> Registros ({list.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 pt-4">
            <div className="rounded-lg border-2 border-dashed p-6 text-center bg-muted/20">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Faça upload da planilha de agenciamentos (.xlsx ou .csv)</p>
              <p className="text-xs text-muted-foreground mb-4">
                O sistema reconhece colunas no padrão da planilha "AGENCIAMENTOS MV BROKER" (Imóvel, Tipo, Padrão, Apto, Box, Dor, M², Bairro, Rua, R$, Proprietário etc.)
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-1" /> Baixar modelo
                </Button>
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button asChild size="sm" disabled={importing}>
                    <span><Upload className="w-4 h-4 mr-1" /> {importing ? "Importando..." : "Selecionar planilha"}</span>
                  </Button>
                  <input
                    id="file-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }}
                  />
                </Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COLUMNS.map(c => (
                <div key={c.key as string}>
                  <Label className="text-xs">{c.label}</Label>
                  <Input
                    type={c.type === "date" ? "date" : c.type === "number" ? "number" : "text"}
                    value={form[c.key as string] ?? ""}
                    onChange={e => setForm({ ...form, [c.key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <Label className="text-xs">Status</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={handleAdd} className="w-full">
              <Plus className="w-4 h-4 mr-1" /> Adicionar agenciamento
            </Button>
          </TabsContent>

          <TabsContent value="list" className="pt-4 space-y-2">
            {list.length > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-destructive text-xs">
                  <Trash2 className="w-3 h-3 mr-1" /> Excluir todos
                </Button>
              </div>
            )}
            {loading ? <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p> :
              list.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">Nenhum agenciamento cadastrado</p> : (
              <div className="overflow-x-auto max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imóvel</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Dor</TableHead>
                      <TableHead>M²</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs font-medium">{v.imovel}</TableCell>
                        <TableCell className="text-xs">{v.tipo}</TableCell>
                        <TableCell className="text-xs">{v.bairro}</TableCell>
                        <TableCell className="text-xs">{v.cidade}</TableCell>
                        <TableCell className="text-xs">{v.dormitorios}</TableCell>
                        <TableCell className="text-xs">{v.metragem || "—"}</TableCell>
                        <TableCell className="text-xs font-semibold text-right">R$ {Number(v.valor).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{statusBadge(v.status)}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(v.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
