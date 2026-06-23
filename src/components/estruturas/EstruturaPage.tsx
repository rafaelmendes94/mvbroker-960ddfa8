import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Search, Pencil, Trash2, Building2, Download, Upload, Loader2, LayoutGrid } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { generateSkeleton } from "@/lib/espelho";

import { CepAutoFill, emptyEndereco, type Endereco } from "@/components/forms/CepAutoFill";
import { MapPicker } from "@/components/forms/MapPicker";
import { InfraestruturaSelect } from "@/components/forms/InfraestruturaSelect";
import { GaleriaUpload, type EstruturaTipo } from "@/components/forms/GaleriaUpload";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { getEstruturaImageUrls, type EstruturaImageUrls } from "@/lib/estrutura-images";

function parseBRL(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}
function formatBRL(v: unknown): string {
  const n = typeof v === "number" ? v : parseBRL(v);
  if (n == null) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}


function parseLatLngFromUrl(url: string): { lat: number | null; lng: number | null } {
  if (!url) return { lat: null, lng: null };
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return { lat: null, lng: null };
}

export type BaseEstrutura = {
  id: string;
  nome: string;
  codigo_interno: string | null;
  descricao: string | null;
  ativo: boolean;
  cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cidade: string | null; estado: string | null;
  latitude: number | null; longitude: number | null;
  infraestrutura: string[];
  created_at: string;
};

type Specific = {
  fields: { key: string; label: string; type?: "text" | "number" | "currency" | "date" | "select"; options?: { value: string; label: string }[] }[];
};

const VALORES_FIELDS = [
  { key: "valor_condominio", label: "Valor do condomínio", type: "currency" as const },
  { key: "valor_iptu", label: "Valor do IPTU", type: "currency" as const },
];

const SPECIFIC: Record<EstruturaTipo, Specific> = {
  edificio: {
    fields: [
      { key: "qtd_andares", label: "Qtd. andares", type: "number" },
      { key: "qtd_elevadores", label: "Qtd. elevadores", type: "number" },
      { key: "qtd_apartamentos", label: "Qtd. apartamentos", type: "number" },
      { key: "ano_construcao", label: "Ano de construção", type: "number" },
      { key: "construtora", label: "Construtora" },
      ...VALORES_FIELDS,
    ],
  },
  condominio: {
    fields: [
      { key: "tipo_condominio", label: "Tipo de condomínio" },
      { key: "numero_lotes", label: "Número de lotes", type: "number" },
      { key: "portaria", label: "Portaria" },
      { key: "seguranca", label: "Segurança" },
      { key: "area_total", label: "Área total (m²)", type: "number" },
      ...VALORES_FIELDS,
    ],
  },
  empreendimento: {
    fields: [
      { key: "construtora", label: "Construtora" },
      { key: "incorporadora", label: "Incorporadora" },
      { key: "status_obra", label: "Status da obra", type: "select", options: [
        { value: "lancamento", label: "Lançamento" },
        { value: "em_obras", label: "Em Obras" },
        { value: "pronto", label: "Pronto" },
        { value: "entregue", label: "Entregue" },
      ] },
      { key: "data_lancamento", label: "Data de lançamento", type: "date" },
      { key: "data_prevista_entrega", label: "Data prevista entrega", type: "date" },
      { key: "data_entrega_efetiva", label: "Data entrega efetiva", type: "date" },
    ],
  },
  loteamento: {
    fields: [
      { key: "area_total_m2", label: "Área total (m²)", type: "number" },
      { key: "total_lotes", label: "Total de lotes", type: "number" },
      { key: "lotes_disponiveis", label: "Lotes disponíveis", type: "number" },
      ...VALORES_FIELDS,
    ],
  },
};



const TABLE: Record<EstruturaTipo, "edificios" | "condominios" | "empreendimentos" | "loteamentos"> = {
  edificio: "edificios",
  condominio: "condominios",
  empreendimento: "empreendimentos",
  loteamento: "loteamentos",
};

const LABELS: Record<EstruturaTipo, { title: string; singular: string; description: string }> = {
  edificio: { title: "Edifícios", singular: "edifício", description: "Gerencie os edifícios cadastrados e reutilize-os ao vincular novos imóveis." },
  condominio: { title: "Condomínios", singular: "condomínio", description: "Gerencie os condomínios cadastrados e reutilize-os ao vincular novos imóveis." },
  empreendimento: { title: "Empreendimentos", singular: "empreendimento", description: "Gerencie empreendimentos e lançamentos imobiliários da sua base." },
  loteamento: { title: "Loteamentos", singular: "loteamento", description: "Gerencie os loteamentos cadastrados e vincule rapidamente os lotes aos imóveis." },
};

export function EstruturaPage({ tipo }: { tipo: EstruturaTipo }) {
  const table = TABLE[tipo];
  const meta = LABELS[tipo];
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const [base, setBase] = useState({ nome: "", codigo_interno: "", descricao: "", ativo: true });
  const [endereco, setEndereco] = useState<Endereco>(emptyEndereco);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [infra, setInfra] = useState<string[]>([]);
  const [specific, setSpecific] = useState<Record<string, any>>({});

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nome", "Endereço", "Número", "Bairro", "Cidade", "Estado", "Link da Localização"],
      [`${meta.singular} exemplo`, "Av. Brasil", "1000", "Centro", "São Paulo", "SP", "https://www.google.com/maps?q=-23.5505,-46.6333"],
    ]);
    ws["!cols"] = [{ wch: 32 }, { wch: 28 }, { wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 8 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, meta.title);
    XLSX.writeFile(wb, `modelo-importar-${table}.xlsx`);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) { toast.error("Faça login para importar"); return; }
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const pick = (row: any, keys: string[]) => {
        const entries = Object.entries(row);
        for (const k of keys) {
          const target = norm(k);
          const found = entries.find(([key]) => norm(key) === target);
          if (found) return String(found[1] ?? "").trim();
        }
        return "";
      };
      const payload = rows
        .map((r) => {
          const nome = pick(r, ["Nome", "Nome do Empreendimento", "Empreendimento"]);
          const logradouro = pick(r, ["Endereço", "Endereco", "Rua", "Logradouro"]);
          const numero = pick(r, ["Número", "Numero", "Nº", "No"]);
          const bairro = pick(r, ["Bairro"]);
          const cidade = pick(r, ["Cidade"]);
          const estado = pick(r, ["Estado", "UF"]);
          const cep = pick(r, ["CEP", "Cep"]);
          const link = pick(r, ["Link da Localização", "Link da Localizacao", "Link", "Localização", "Localizacao", "Mapa"]);
          const { lat, lng } = parseLatLngFromUrl(link);
          return {
            nome, logradouro: logradouro || null, numero: numero || null,
            bairro: bairro || null, cidade: cidade || null, estado: estado || null, cep: cep || null,
            latitude: lat, longitude: lng,
            ativo: true, infraestrutura: [] as string[],
            created_by: user.id,
          };
        })
        .filter((r) => r.nome);

      if (!payload.length) {
        toast.error("Nenhuma linha válida encontrada", { description: "Verifique se há a coluna 'Nome'." });
        return;
      }

      const { error } = await supabase.from(table as any).insert(payload as any);
      if (error) throw error;
      await logAudit(`${tipo}_criado`, `${payload.length} ${meta.singular}(s) importado(s) via Excel`);
      toast.success(`${payload.length} ${meta.singular}(s) importado(s)`);
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao importar", { description: err?.message || "" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }


  const [covers, setCovers] = useState<Record<string, EstruturaImageUrls>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = data ?? [];
    setItems(list);
    setLoading(false);
    // carregar capas
    if (list.length) {
      const ids = list.map((i: any) => i.id);
      const { data: imgs } = await supabase
        .from("estrutura_imagens")
        .select("estrutura_id, storage_path, capa, ordem")
        .eq("estrutura_tipo", tipo)
        .in("estrutura_id", ids)
        .order("capa", { ascending: false })
        .order("ordem", { ascending: true });
      const firstByEst: Record<string, string> = {};
      for (const r of (imgs ?? []) as any[]) {
        if (!firstByEst[r.estrutura_id]) firstByEst[r.estrutura_id] = r.storage_path;
      }
      const entries = await Promise.all(
        Object.entries(firstByEst).map(async ([eid, path]) => {
          const urls = await getEstruturaImageUrls(path);
          return [eid, urls] as const;
        })
      );
      setCovers(Object.fromEntries(entries.filter((entry): entry is readonly [string, EstruturaImageUrls] => Boolean(entry[1]))));
    } else {
      setCovers({});
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tipo]);

  function resetForm() {
    setEditing(null);
    setBase({ nome: "", codigo_interno: "", descricao: "", ativo: true });
    setEndereco(emptyEndereco);
    setCoords({ lat: null, lng: null });
    setInfra([]);
    setSpecific({});
  }

  function openCreate() { resetForm(); setOpen(true); }
  function openEdit(it: any) {
    setEditing(it);
    setBase({ nome: it.nome, codigo_interno: it.codigo_interno ?? "", descricao: it.descricao ?? "", ativo: it.ativo });
    setEndereco({
      cep: it.cep ?? "", logradouro: it.logradouro ?? "", numero: it.numero ?? "",
      complemento: it.complemento ?? "", bairro: it.bairro ?? "", cidade: it.cidade ?? "", estado: it.estado ?? "",
    });
    setCoords({ lat: it.latitude, lng: it.longitude });
    setInfra(it.infraestrutura ?? []);
    const spec: Record<string, any> = {};
    SPECIFIC[tipo].fields.forEach((f) => { spec[f.key] = it[f.key] ?? ""; });
    setSpecific(spec);
    setOpen(true);
  }

  async function save() {
    if (!base.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload: any = {
      nome: base.nome,
      codigo_interno: base.codigo_interno || null,
      descricao: base.descricao || null,
      ativo: base.ativo,
      cep: endereco.cep || null,
      logradouro: endereco.logradouro || null,
      numero: endereco.numero || null,
      complemento: endereco.complemento || null,
      bairro: endereco.bairro || null,
      cidade: endereco.cidade || null,
      estado: endereco.estado || null,
      latitude: coords.lat,
      longitude: coords.lng,
      infraestrutura: infra,
    };
    SPECIFIC[tipo].fields.forEach((f) => {
      const v = specific[f.key];
      if (v === "" || v === undefined || v === null) { payload[f.key] = null; return; }
      if (f.type === "number") { payload[f.key] = Number(v); return; }
      if (f.type === "currency") { payload[f.key] = parseBRL(v); return; }
      payload[f.key] = v;
    });


    let savedId: string | null = null;
    if (editing) {
      const { error } = await supabase.from(table).update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await logAudit(`${tipo}_atualizado`, `${meta.singular}: ${base.nome}`);
      toast.success("Atualizado");
      savedId = editing.id;
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.created_by = u.user?.id ?? null;
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logAudit(`${tipo}_criado`, `${meta.singular}: ${base.nome}`);
      toast.success("Criado");
      setEditing(data);
      savedId = (data as any)?.id ?? null;
    }

    // Auto-gera espelho para edifício a partir de qtd_andares × qtd_apartamentos
    if (savedId && tipo === "edificio") {
      try {
        const andares = Number(payload.qtd_andares);
        const porAndar = Number(payload.qtd_apartamentos);
        if (andares > 0 && porAndar > 0) {
          const { data: existentes } = await supabase
            .from("espelho_unidades" as any)
            .select("grupo, numero")
            .eq("empreendimento_tipo", "edificio")
            .eq("empreendimento_id", savedId);
          const existSet = new Set(
            ((existentes as any[]) ?? []).map((u) => `${u.grupo}|${String(u.numero).trim()}`),
          );
          const grade = generateSkeleton("edificio", savedId, andares, porAndar);
          const faltantes = grade.filter((u) => !existSet.has(`${u.grupo}|${u.numero}`));
          if (faltantes.length > 0) {
            const { error } = await supabase
              .from("espelho_unidades" as any)
              .insert(faltantes as any);
            if (!error) {
              toast.success(`Espelho atualizado: ${faltantes.length} unidade(s) indisponível(is) gerada(s)`);
            }
          }
        }
      } catch (err) {
        console.warn("Falha ao gerar espelho do edifício", err);
      }
    }

    if (!editing) return; // mantém dialog aberto após criar para upload de imagens

    setOpen(false);
    load();
  }

  async function remove(id: string, nome: string) {
    if (!confirm(`Excluir ${meta.singular}?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAudit(`${tipo}_excluido`, `${meta.singular}: ${nome}`);
    toast.success("Excluído");
    load();
  }

  const filtered = items.filter((i) =>
    [i.nome, i.codigo_interno, i.cidade, i.bairro].some((v) =>
      v?.toLowerCase?.().includes(search.toLowerCase())
    )
  );

  return (
    <>
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1.5" /> Modelo Excel
            </Button>
            <Button variant="outline" disabled={importing} onClick={() => fileInputRef.current?.click()}>
              {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Importar Excel
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Novo {meta.singular}</Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, código, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((i) => (
                <div key={i.id} className="group grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-card p-2 transition-colors hover:border-primary sm:grid-cols-[88px_minmax(0,1fr)_auto]">
                  <Link
                    to="/empreendimentos/$id"
                    params={{ id: i.id }}
                    className="block h-16 w-[72px] overflow-hidden rounded-md bg-muted sm:h-16 sm:w-[88px]"
                  >
                    {covers[i.id] ? (
                      <img
                        src={covers[i.id].url}
                        alt={i.nome}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const fallback = covers[i.id]?.fallbackUrl;
                          if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Building2 className="h-5 w-5" />
                      </div>
                    )}
                  </Link>
                  <Link to="/empreendimentos/$id" params={{ id: i.id }} className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold">{i.nome}</p>
                      <Badge variant={i.ativo ? "default" : "secondary"} className="shrink-0 text-[10px]">
                        {i.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[i.cidade, i.estado].filter(Boolean).join("/") || "Sem cidade"}
                      {i.bairro ? ` · ${i.bairro}` : ""}
                      {i.codigo_interno ? ` · Cód. ${i.codigo_interno}` : ""}
                    </p>
                  </Link>
                  <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
                    {tipo !== "empreendimento" && (
                      <Button asChild size="sm" variant="outline" className="h-8">
                        <Link to="/empreendimentos/$tipo/$id" params={{ tipo, id: i.id }}>
                          <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Espelho
                        </Link>
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(i.id, i.nome)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${meta.singular}` : `Novo ${meta.singular}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <Section title="Dados básicos">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <Field label="Nome *" className="md:col-span-4">
                  <Input value={base.nome} onChange={(e) => setBase({ ...base, nome: e.target.value })} />
                </Field>
                <Field label="Código interno" className="md:col-span-2">
                  <Input value={base.codigo_interno} onChange={(e) => setBase({ ...base, codigo_interno: e.target.value })} />
                </Field>
                <Field label="Descrição" className="md:col-span-6">
                  <Textarea rows={2} value={base.descricao} onChange={(e) => setBase({ ...base, descricao: e.target.value })} />
                </Field>
                <div className="md:col-span-6 flex items-center gap-3 pt-1">
                  <Switch checked={base.ativo} onCheckedChange={(v) => setBase({ ...base, ativo: v })} />
                  <Label className="text-sm">Ativo</Label>
                </div>
              </div>
            </Section>

            <Section title="Endereço">
              <CepAutoFill value={endereco} onChange={setEndereco} />
            </Section>

            <Section title="Localização">
              <MapPicker
                latitude={coords.lat}
                longitude={coords.lng}
                onChange={(lat, lng) => setCoords({ lat, lng })}
              />
            </Section>

            <Section title="Infraestrutura">
              <InfraestruturaSelect value={infra} onChange={setInfra} />
            </Section>

            <Section title="Dados específicos">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SPECIFIC[tipo].fields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    {f.type === "select" ? (
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={specific[f.key] ?? ""}
                        onChange={(e) => setSpecific({ ...specific, [f.key]: e.target.value })}
                      >
                        <option value="">—</option>
                        {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : f.type === "currency" ? (
                      <Input
                        inputMode="decimal"
                        placeholder="R$ 0,00"
                        value={specific[f.key] === "" || specific[f.key] == null ? "" : formatBRL(specific[f.key])}
                        onChange={(e) => setSpecific({ ...specific, [f.key]: e.target.value.replace(/[^\d,.-]/g, "") })}
                        onBlur={(e) => {
                          const n = parseBRL(e.target.value);
                          setSpecific({ ...specific, [f.key]: n == null ? "" : n });
                        }}
                      />
                    ) : (
                      <Input
                        type={f.type ?? "text"}
                        value={specific[f.key] ?? ""}
                        onChange={(e) => setSpecific({ ...specific, [f.key]: e.target.value })}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </Section>

            <Section title="Galeria">
              <GaleriaUpload tipo={tipo} estruturaId={editing?.id ?? null} />
            </Section>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={save}>{editing ? "Salvar alterações" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">{title}</h3>
      <div className="rounded-lg border bg-card/50 p-4">{children}</div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
