import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Save, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { gerarDescricaoImovel } from "@/lib/imovel-ia.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CepAutoFill, type Endereco } from "@/components/forms/CepAutoFill";
import { MapPicker } from "@/components/forms/MapPicker";
import { useSystemOptions } from "@/hooks/use-system-options";
import { ImovelGaleria } from "./ImovelGaleria";
import { logAudit, logImovel } from "@/lib/audit";

type AnyRec = Record<string, any>;

type Estrutura = { id: string; nome: string; cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; estado: string | null; latitude: number | null; longitude: number | null; infraestrutura: string[] | null };

const COUNT_OPTS = [0, 1, 2, 3, 4, 5];

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function MultiPill({ options, value, onChange }: { options: { slug: string; nome: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  }
  if (!options.length) return <p className="text-xs text-muted-foreground">Cadastre opções em Configurações.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const sel = value.includes(o.slug);
        return (
          <button
            type="button"
            key={o.slug}
            onClick={() => toggle(o.slug)}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors ${sel ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
          >
            {o.nome}
          </button>
        );
      })}
    </div>
  );
}

export function ImovelForm({ initial, onSaved }: { initial?: AnyRec | null; onSaved?: (id: string) => void }) {
  const navigate = useNavigate();
  const isEdit = !!initial?.id;
  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [tab, setTab] = useState("identificacao");

  // Form state
  const [form, setForm] = useState<AnyRec>({
    titulo: "", unidade: "", box: "", quadra: "", lote: "",
    tipo_imovel: "", status_imovel: "disponivel",
    dormitorios: null, banheiros: null, lavabo: null, vagas: null, elevadores: null,
    area_privativa: null, area_total: null,
    edificio_id: null, condominio_id: null, empreendimento_id: null, loteamento_id: null, imobiliaria_id: null, corretor_id: null,
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    latitude: null, longitude: null,
    preco: null, preco_parcelado: null, comissao_percentual: null, valor_comissao: null,
    bonus: "", validade_bonus: "", padrao: "",
    condicoes_pagamento: [] as string[],
    responsavel_nome: "", responsavel_telefone: "", responsavel_whatsapp: "", responsavel_email: "",
    tipo_proprietario: "", exclusividade: false, local_chaves: "", termo_exclusividade_path: "",
    condicao: "", posicao_predio: "", posicao_solar: "", vista: "",
    vista_mar: false, decorado: false, aceita_permuta: false,
    infraestrutura: [] as string[], outras_caracteristicas: [] as string[],
    ativo_site: true, publicar_xml: false, destaque_home: false, destaque_categoria: "",
    descricao: "",
    link_video: "", link_material: "", link_drive_fotos: "", tour_360: "", pdf_comercial_path: "",
    data_captacao: "", responsavel_captacao: "", observacoes_internas: "",
    exclusivo: false, compartilhamento_permitido: true, comissao_compartilhada: null, data_vencimento_exclusividade: "",
    portais_permitidos: [] as string[], prioridade_xml: 0, ultima_exportacao: null, status_exportacao: "",
    exportacao_liberada: true,
    ...initial,
  });

  const [imovelId, setImovelId] = useState<string | null>(initial?.id ?? null);
  const [tagInput, setTagInput] = useState("");
  const [logs, setLogs] = useState<AnyRec[]>([]);
  const [edificios, setEdificios] = useState<Estrutura[]>([]);
  const [condominios, setCondominios] = useState<Estrutura[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<Estrutura[]>([]);
  const [loteamentos, setLoteamentos] = useState<Estrutura[]>([]);
  const [imobiliarias, setImobiliarias] = useState<AnyRec[]>([]);
  const [corretores, setCorretores] = useState<AnyRec[]>([]);

  const gerarDescFn = useServerFn(gerarDescricaoImovel);

  // System options
  const { active: tiposImovel } = useSystemOptions("tipo_imovel");
  const { active: statusImovel } = useSystemOptions("status_imovel");
  const { active: padroes } = useSystemOptions("padrao_imovel");
  const { active: condicoesPgto } = useSystemOptions("condicoes_pagamento");
  const { active: tiposProp } = useSystemOptions("tipo_proprietario");
  const { active: posicoesPredio } = useSystemOptions("posicao_predio");
  const { active: posicoesSolar } = useSystemOptions("posicao_solar");
  const { active: vistas } = useSystemOptions("vista");
  const { active: destaques } = useSystemOptions("destaque_categoria");
  const { active: infraOpts } = useSystemOptions("infraestrutura");
  const { active: portaisOpts } = useSystemOptions("portais_xml");

  // Loaders
  useEffect(() => {
    supabase.from("edificios").select("id, nome, cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude, infraestrutura, valor_condominio, valor_iptu").order("nome").then((r) => setEdificios((r.data as any) ?? []));
    supabase.from("condominios").select("id, nome, cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude, infraestrutura, valor_condominio, valor_iptu").order("nome").then((r) => setCondominios((r.data as any) ?? []));
    supabase.from("empreendimentos").select("id, nome, cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude, infraestrutura").order("nome").then((r) => setEmpreendimentos((r.data as any) ?? []));
    supabase.from("loteamentos" as any).select("id, nome, cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude, infraestrutura, valor_condominio, valor_iptu").order("nome").then((r: any) => setLoteamentos((r.data as any) ?? []));
    supabase.from("imobiliarias").select("id, nome").order("nome").then((r) => setImobiliarias(r.data ?? []));
    supabase.from("corretores").select("id, nome").order("nome").then((r) => setCorretores(r.data ?? []));
  }, []);


  useEffect(() => {
    if (!imovelId) return;
    supabase.from("imovel_logs").select("*").eq("imovel_id", imovelId).order("created_at", { ascending: false }).then((r) => setLogs(r.data ?? []));
  }, [imovelId]);

  // Compute commission
  useEffect(() => {
    const preco = Number(form.preco) || 0;
    const pct = Number(form.comissao_percentual) || 0;
    if (preco && pct) set("valor_comissao", +(preco * pct / 100).toFixed(2));
  }, [form.preco, form.comissao_percentual]);

  function set<K extends string>(key: K, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyEstrutura(e: Estrutura) {
    setForm((f) => ({
      ...f,
      cep: e.cep ?? f.cep,
      logradouro: e.logradouro ?? f.logradouro,
      numero: e.numero ?? f.numero,
      complemento: e.complemento ?? f.complemento,
      bairro: e.bairro ?? f.bairro,
      cidade: e.cidade ?? f.cidade,
      estado: e.estado ?? f.estado,
      latitude: e.latitude ?? f.latitude,
      longitude: e.longitude ?? f.longitude,
      infraestrutura: [...new Set([...(f.infraestrutura ?? []), ...(e.infraestrutura ?? [])])],
    }));
    toast.success(`Dados de "${e.nome}" herdados`);
  }

  function selectVinculo(tipo: "edificio" | "condominio" | "empreendimento" | "loteamento", id: string) {
    const list = tipo === "edificio" ? edificios
      : tipo === "condominio" ? condominios
      : tipo === "empreendimento" ? empreendimentos
      : loteamentos;
    const key = `${tipo}_id`;
    set(key, id || null);
    if (!id) return;
    const found = list.find((x) => x.id === id);
    if (found) applyEstrutura(found);
  }

  async function gerarDescricao() {
    setGeneratingAi(true);
    try {
      const r = await gerarDescFn({
        data: {
          titulo: form.titulo || "",
          tipo: tiposImovel.find((t) => t.slug === form.tipo_imovel)?.nome ?? form.tipo_imovel ?? "",
          cidade: form.cidade || "",
          bairro: form.bairro || "",
          dormitorios: form.dormitorios,
          banheiros: form.banheiros,
          vagas: form.vagas,
          area_privativa: form.area_privativa,
          area_total: form.area_total,
          preco: form.preco,
          infraestrutura: (form.infraestrutura ?? []).map((s: string) => infraOpts.find((o) => o.slug === s)?.nome ?? s),
          vista: vistas.find((v) => v.slug === form.vista)?.nome ?? form.vista ?? "",
          posicao_solar: posicoesSolar.find((p) => p.slug === form.posicao_solar)?.nome ?? form.posicao_solar ?? "",
          condicao: form.condicao || "",
          observacoes: form.observacoes_internas || "",
        },
      });
      set("descricao", r.description);
      toast.success("Descrição gerada");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar descrição");
    } finally {
      setGeneratingAi(false);
    }
  }

  async function uploadTermo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const path = `termos/${Date.now()}-${f.name}`;
    const up = await supabase.storage.from("exclusividades").upload(path, f);
    if (up.error) { toast.error(up.error.message); return; }
    set("termo_exclusividade_path", path);
    toast.success("Termo enviado");
    e.target.value = "";
  }

  async function uploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const path = `pdf-comercial/${Date.now()}-${f.name}`;
    const up = await supabase.storage.from("materiais").upload(path, f);
    if (up.error) { toast.error(up.error.message); return; }
    set("pdf_comercial_path", path);
    toast.success("PDF enviado");
    e.target.value = "";
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v) return;
    if ((form.outras_caracteristicas ?? []).includes(v)) return;
    set("outras_caracteristicas", [...(form.outras_caracteristicas ?? []), v]);
    setTagInput("");
  }
  function removeTag(t: string) {
    set("outras_caracteristicas", (form.outras_caracteristicas ?? []).filter((x: string) => x !== t));
  }

  async function save() {
    if (!form.titulo?.trim()) { toast.error("Título é obrigatório"); setTab("identificacao"); return; }
    setSaving(true);
    try {
      const payload: AnyRec = { ...form };
      // datas vazias → null
      ["validade_bonus", "data_captacao", "data_vencimento_exclusividade"].forEach((k) => {
        if (!payload[k]) payload[k] = null;
      });
      // números vazios → null
      ["dormitorios","banheiros","lavabo","vagas","elevadores","area_privativa","area_total","preco","preco_parcelado","comissao_percentual","valor_comissao","comissao_compartilhada","prioridade_xml","latitude","longitude"].forEach((k) => {
        if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
      });
      ["edificio_id","condominio_id","empreendimento_id","loteamento_id","imobiliaria_id","corretor_id"].forEach((k) => {
        if (!payload[k]) payload[k] = null;
      });
      delete payload.id;
      delete payload.codigo_interno;
      delete payload.created_at;
      delete payload.updated_at;

      if (imovelId) {
        const { error } = await supabase.from("imoveis").update(payload as never).eq("id", imovelId);
        if (error) throw error;
        await logAudit("imovel_atualizado", `Imóvel ${form.titulo}`);
        await logImovel(imovelId, "atualizado", `Imóvel atualizado: ${form.titulo}`);
        toast.success("Imóvel atualizado");
        onSaved?.(imovelId);
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id ?? null;
        const { data, error } = await supabase.from("imoveis").insert(payload as never).select().single();
        if (error) throw error;
        setImovelId(data.id);
        setForm((f) => ({ ...f, ...data }));
        await logAudit("imovel_criado", `Imóvel ${data.titulo} (${data.codigo_interno})`);
        await logImovel(data.id, "criado", `Imóvel criado: ${data.titulo}`);
        toast.success(`Imóvel criado — ${data.codigo_interno}`);
        onSaved?.(data.id);
        navigate({ to: "/imoveis/$id/editar", params: { id: data.id } });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const codigoLabel = useMemo(() => initial?.codigo_interno ?? "Gerado automaticamente ao salvar", [initial]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Código interno</p>
          <p className="text-lg font-semibold">{codigoLabel}</p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
          {isEdit || imovelId ? "Salvar alterações" : "Criar imóvel"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="identificacao">1. Identificação</TabsTrigger>
          <TabsTrigger value="vinculacao">2. Vinculação</TabsTrigger>
          <TabsTrigger value="endereco">3. Endereço</TabsTrigger>
          <TabsTrigger value="valores">4. Valores</TabsTrigger>
          <TabsTrigger value="origem">5. Origem</TabsTrigger>
          <TabsTrigger value="caracteristicas">6. Características</TabsTrigger>
          <TabsTrigger value="descricao">7. Descrição</TabsTrigger>
          <TabsTrigger value="videos">8. Vídeos</TabsTrigger>
          <TabsTrigger value="galeria">9. Galeria</TabsTrigger>
          <TabsTrigger value="interno">10. Controle</TabsTrigger>
          <TabsTrigger value="xml">11. XML</TabsTrigger>
          <TabsTrigger value="historico">12. Histórico</TabsTrigger>
        </TabsList>

        {/* === 1 IDENTIFICAÇÃO === */}
        <TabsContent value="identificacao" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Field label="Título do Imóvel *" className="md:col-span-6">
              <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
            </Field>
            <Field label="Unidade" className="md:col-span-2"><Input value={form.unidade} onChange={(e) => set("unidade", e.target.value)} /></Field>
            <Field label="Box" className="md:col-span-1"><Input value={form.box} onChange={(e) => set("box", e.target.value)} /></Field>
            <Field label="Quadra" className="md:col-span-1"><Input value={form.quadra} onChange={(e) => set("quadra", e.target.value)} /></Field>
            <Field label="Lote" className="md:col-span-2"><Input value={form.lote} onChange={(e) => set("lote", e.target.value)} /></Field>

            <Field label="Tipo do Imóvel" className="md:col-span-3">
              <Select value={form.tipo_imovel ?? ""} onValueChange={(v) => set("tipo_imovel", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {tiposImovel.map((o) => <SelectItem key={o.slug} value={o.slug}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" className="md:col-span-3">
              <Select value={form.status_imovel ?? "disponivel"} onValueChange={(v) => set("status_imovel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusImovel.map((o) => <SelectItem key={o.slug} value={o.slug}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {[
              { k: "dormitorios", label: "Dormitórios" },
              { k: "banheiros", label: "Banheiros" },
              { k: "lavabo", label: "Lavabo" },
              { k: "vagas", label: "Vagas" },
              { k: "elevadores", label: "Elevadores" },
            ].map((c) => (
              <Field key={c.k} label={c.label} className="md:col-span-1">
                <Select value={form[c.k] != null ? String(form[c.k]) : ""} onValueChange={(v) => set(c.k, v === "" ? null : Number(v))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {COUNT_OPTS.map((n) => <SelectItem key={n} value={String(n)}>{n}{n === 5 ? "+" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            ))}
            <Field label="Área privativa (m²)" className="md:col-span-3">
              <Input type="number" step="0.01" value={form.area_privativa ?? ""} onChange={(e) => set("area_privativa", e.target.value)} />
            </Field>
            <Field label="Área total (m²)" className="md:col-span-3">
              <Input type="number" step="0.01" value={form.area_total ?? ""} onChange={(e) => set("area_total", e.target.value)} />
            </Field>
          </div>
        </TabsContent>

        {/* === 2 VINCULAÇÃO === */}
        <TabsContent value="vinculacao" className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground">Ao selecionar uma estrutura, os dados de endereço e infraestrutura serão herdados automaticamente.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Edifício">
              <Select value={form.edificio_id ?? ""} onValueChange={(v) => selectVinculo("edificio", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {edificios.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Condomínio">
              <Select value={form.condominio_id ?? ""} onValueChange={(v) => selectVinculo("condominio", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {condominios.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Loteamento">
              <Select value={form.loteamento_id ?? ""} onValueChange={(v) => selectVinculo("loteamento", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {loteamentos.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Imobiliária">
              <Select value={form.imobiliaria_id ?? ""} onValueChange={(v) => set("imobiliaria_id", v || null)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {imobiliarias.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Corretor">
              <Select value={form.corretor_id ?? ""} onValueChange={(v) => set("corretor_id", v || null)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {corretores.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </TabsContent>

        {/* === 3 ENDEREÇO === */}
        <TabsContent value="endereco" className="space-y-4 pt-4">
          <CepAutoFill
            value={{ cep: form.cep ?? "", logradouro: form.logradouro ?? "", numero: form.numero ?? "", complemento: form.complemento ?? "", bairro: form.bairro ?? "", cidade: form.cidade ?? "", estado: form.estado ?? "" } as Endereco}
            onChange={(v) => setForm((f) => ({ ...f, ...v }))}
          />
          <div className="pt-2">
            <h4 className="text-sm font-semibold mb-2">Geolocalização</h4>
            <MapPicker latitude={form.latitude} longitude={form.longitude} onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))} />
          </div>
        </TabsContent>

        {/* === 4 VALORES === */}
        <TabsContent value="valores" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Preço (R$)"><Input type="number" step="0.01" value={form.preco ?? ""} onChange={(e) => set("preco", e.target.value)} /></Field>
            <Field label="Preço parcelado (R$)"><Input type="number" step="0.01" value={form.preco_parcelado ?? ""} onChange={(e) => set("preco_parcelado", e.target.value)} /></Field>
            <Field label="Comissão (%)"><Input type="number" step="0.01" value={form.comissao_percentual ?? ""} onChange={(e) => set("comissao_percentual", e.target.value)} /></Field>
            <Field label="Valor comissão (R$)"><Input type="number" step="0.01" value={form.valor_comissao ?? ""} readOnly className="bg-muted" /></Field>
            <Field label="Bônus" className="md:col-span-2"><Input value={form.bonus} onChange={(e) => set("bonus", e.target.value)} /></Field>
            <Field label="Validade do bônus"><Input type="date" value={form.validade_bonus ?? ""} onChange={(e) => set("validade_bonus", e.target.value)} /></Field>
            <Field label="Padrão">
              <Select value={form.padrao ?? ""} onValueChange={(v) => set("padrao", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{padroes.map((o) => <SelectItem key={o.slug} value={o.slug}>{o.nome}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Condições de pagamento" className="md:col-span-4">
              <MultiPill options={condicoesPgto} value={form.condicoes_pagamento ?? []} onChange={(v) => set("condicoes_pagamento", v)} />
            </Field>
          </div>
        </TabsContent>

        {/* === 5 ORIGEM === */}
        <TabsContent value="origem" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Nome responsável" className="md:col-span-2"><Input value={form.responsavel_nome} onChange={(e) => set("responsavel_nome", e.target.value)} /></Field>
            <Field label="Telefone"><Input value={form.responsavel_telefone} onChange={(e) => set("responsavel_telefone", e.target.value)} /></Field>
            <Field label="WhatsApp"><Input value={form.responsavel_whatsapp} onChange={(e) => set("responsavel_whatsapp", e.target.value)} /></Field>
            <Field label="Email" className="md:col-span-2"><Input type="email" value={form.responsavel_email} onChange={(e) => set("responsavel_email", e.target.value)} /></Field>
            <Field label="Tipo do proprietário">
              <Select value={form.tipo_proprietario ?? ""} onValueChange={(v) => set("tipo_proprietario", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{tiposProp.map((o) => <SelectItem key={o.slug} value={o.slug}>{o.nome}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Local das chaves"><Input value={form.local_chaves} onChange={(e) => set("local_chaves", e.target.value)} /></Field>
            <div className="md:col-span-4 flex items-center gap-3 pt-1">
              <Switch checked={!!form.exclusividade} onCheckedChange={(v) => set("exclusividade", v)} />
              <Label className="text-sm">Imóvel com exclusividade</Label>
            </div>
            <Field label="Termo de exclusividade (PDF/Imagem)" className="md:col-span-4">
              <div className="flex items-center gap-3">
                <label>
                  <input type="file" accept="application/pdf,image/*" className="hidden" onChange={uploadTermo} />
                  <Button type="button" variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1.5" /> Enviar termo</span></Button>
                </label>
                {form.termo_exclusividade_path && <Badge variant="secondary" className="text-xs">{form.termo_exclusividade_path.split("/").pop()}</Badge>}
              </div>
            </Field>
          </div>
        </TabsContent>

        {/* === 6 CARACTERÍSTICAS === */}
        <TabsContent value="caracteristicas" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Condição">
              <Select value={form.condicao ?? ""} onValueChange={(v) => set("condicao", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobiliado">Mobiliado</SelectItem>
                  <SelectItem value="semi_mobiliado">Semi-Mobiliado</SelectItem>
                  <SelectItem value="decorado">Decorado</SelectItem>
                  <SelectItem value="vazio">Vazio</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Posição no prédio">
              <Select value={form.posicao_predio ?? ""} onValueChange={(v) => set("posicao_predio", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{posicoesPredio.map((o) => <SelectItem key={o.slug} value={o.slug}>{o.nome}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Posição solar">
              <Select value={form.posicao_solar ?? ""} onValueChange={(v) => set("posicao_solar", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{posicoesSolar.map((o) => <SelectItem key={o.slug} value={o.slug}>{o.nome}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Vista">
              <Select value={form.vista ?? ""} onValueChange={(v) => set("vista", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{vistas.map((o) => <SelectItem key={o.slug} value={o.slug}>{o.nome}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {[
              { k: "vista_mar", label: "Vista mar" },
              { k: "decorado", label: "Decorado" },
              { k: "aceita_permuta", label: "Aceita permuta" },
              { k: "ativo_site", label: "Ativo no site" },
              { k: "publicar_xml", label: "Publicar XML" },
              { k: "destaque_home", label: "Destaque na home" },
            ].map((sw) => (
              <div key={sw.k} className="flex items-center gap-2 rounded-md border bg-card/50 p-3">
                <Switch checked={!!form[sw.k]} onCheckedChange={(v) => set(sw.k, v)} />
                <Label className="text-sm">{sw.label}</Label>
              </div>
            ))}
          </div>

          <Field label="Destaque categoria">
            <Select value={form.destaque_categoria ?? ""} onValueChange={(v) => set("destaque_categoria", v)}>
              <SelectTrigger className="md:w-72"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{destaques.map((o) => <SelectItem key={o.slug} value={o.slug}>{o.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          <Field label="Infraestrutura">
            <MultiPill options={infraOpts} value={form.infraestrutura ?? []} onChange={(v) => set("infraestrutura", v)} />
          </Field>

          <Field label="Outras características (tags livres)">
            <div className="flex flex-wrap gap-2 mb-2">
              {(form.outras_caracteristicas ?? []).map((t: string) => (
                <Badge key={t} variant="secondary" className="gap-1.5">
                  {t}
                  <button onClick={() => removeTag(t)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Nova característica" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
              <Button type="button" variant="outline" onClick={addTag}>Adicionar</Button>
            </div>
          </Field>
        </TabsContent>

        {/* === 7 DESCRIÇÃO === */}
        <TabsContent value="descricao" className="space-y-3 pt-4">
          <div className="flex justify-between items-center">
            <Label className="text-sm">Descrição do imóvel</Label>
            <Button type="button" variant="outline" size="sm" onClick={gerarDescricao} disabled={generatingAi}>
              {generatingAi ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Gerar com IA
            </Button>
          </div>
          <Textarea rows={14} value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} placeholder="Descreva o imóvel ou clique em 'Gerar com IA' para criar automaticamente." />
        </TabsContent>

        {/* === 8 VÍDEOS === */}
        <TabsContent value="videos" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Link do vídeo"><Input value={form.link_video} onChange={(e) => set("link_video", e.target.value)} placeholder="YouTube, Vimeo..." /></Field>
            <Field label="Link material completo"><Input value={form.link_material} onChange={(e) => set("link_material", e.target.value)} /></Field>
            <Field label="Link Drive de fotos"><Input value={form.link_drive_fotos} onChange={(e) => set("link_drive_fotos", e.target.value)} /></Field>
            <Field label="Tour 360°"><Input value={form.tour_360} onChange={(e) => set("tour_360", e.target.value)} /></Field>
            <Field label="PDF Comercial" className="md:col-span-2">
              <div className="flex items-center gap-3">
                <label>
                  <input type="file" accept="application/pdf" className="hidden" onChange={uploadPdf} />
                  <Button type="button" variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1.5" /> Enviar PDF</span></Button>
                </label>
                {form.pdf_comercial_path && <Badge variant="secondary" className="text-xs">{form.pdf_comercial_path.split("/").pop()}</Badge>}
              </div>
            </Field>
          </div>
        </TabsContent>

        {/* === 9 GALERIA === */}
        <TabsContent value="galeria" className="pt-4">
          <ImovelGaleria imovelId={imovelId} />
        </TabsContent>

        {/* === 10 CONTROLE INTERNO === */}
        <TabsContent value="interno" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Data captação"><Input type="date" value={form.data_captacao ?? ""} onChange={(e) => set("data_captacao", e.target.value)} /></Field>
            <Field label="Responsável captação" className="md:col-span-2"><Input value={form.responsavel_captacao} onChange={(e) => set("responsavel_captacao", e.target.value)} /></Field>
            <Field label="Observações internas" className="md:col-span-3"><Textarea rows={4} value={form.observacoes_internas} onChange={(e) => set("observacoes_internas", e.target.value)} /></Field>
            <div className="flex items-center gap-2 rounded-md border bg-card/50 p-3">
              <Switch checked={!!form.exclusivo} onCheckedChange={(v) => set("exclusivo", v)} /><Label className="text-sm">Exclusivo</Label>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-card/50 p-3">
              <Switch checked={!!form.compartilhamento_permitido} onCheckedChange={(v) => set("compartilhamento_permitido", v)} /><Label className="text-sm">Compartilhamento permitido</Label>
            </div>
            <Field label="Comissão compartilhada (%)"><Input type="number" step="0.01" value={form.comissao_compartilhada ?? ""} onChange={(e) => set("comissao_compartilhada", e.target.value)} /></Field>
            <Field label="Vencimento exclusividade"><Input type="date" value={form.data_vencimento_exclusividade ?? ""} onChange={(e) => set("data_vencimento_exclusividade", e.target.value)} /></Field>
          </div>
        </TabsContent>

        {/* === 11 XML === */}
        <TabsContent value="xml" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border bg-card/50 p-3 w-fit">
              <Switch checked={!!form.publicar_xml} onCheckedChange={(v) => set("publicar_xml", v)} /><Label className="text-sm">Publicar XML</Label>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-card/50 p-3 w-fit">
              <Switch checked={form.exportacao_liberada !== false} onCheckedChange={(v) => set("exportacao_liberada", v)} />
              <Label className="text-sm">Liberar exportação para clientes</Label>
            </div>
          </div>
          <Field label="Portais permitidos">
            <MultiPill options={portaisOpts} value={form.portais_permitidos ?? []} onChange={(v) => set("portais_permitidos", v)} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Prioridade XML"><Input type="number" value={form.prioridade_xml ?? 0} onChange={(e) => set("prioridade_xml", e.target.value)} /></Field>
            <Field label="Última exportação"><Input value={form.ultima_exportacao ? new Date(form.ultima_exportacao).toLocaleString("pt-BR") : "—"} readOnly className="bg-muted" /></Field>
            <Field label="Status exportação"><Input value={form.status_exportacao ?? ""} readOnly className="bg-muted" /></Field>
          </div>
        </TabsContent>

        {/* === 12 HISTÓRICO === */}
        <TabsContent value="historico" className="pt-4">
          {!imovelId ? (
            <p className="text-sm text-muted-foreground">Salve o imóvel para visualizar histórico.</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Data</th>
                    <th className="p-2">Ação</th>
                    <th className="p-2">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2 text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2"><Badge variant="outline">{l.acao}</Badge></td>
                      <td className="p-2">{l.descricao ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
