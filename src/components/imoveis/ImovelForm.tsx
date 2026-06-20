import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2, MapPin, BedDouble, Bath, Car, Ruler, User, Phone, DollarSign,
  Percent, Gift, Home, Sparkles, Save, Image as ImageIcon, Loader2,
  FileText, Eye, Key, Calendar, Building, Fence, Landmark, Wand2,
  Play, FolderDown, Download, Clock, CheckCircle2, Ban, History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSystemOptions } from "@/hooks/use-system-options";
import { gerarDescricaoImovel } from "@/lib/imovel-ia.functions";
import {
  listFeedPersonalizadoIds,
  setImovelInFeedPersonalizado,
} from "@/lib/feed-personalizado.functions";
import { logAudit, logImovel } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CepAutoFill, type Endereco } from "@/components/forms/CepAutoFill";
import { MapPicker } from "@/components/forms/MapPicker";
import { QuickPick } from "@/components/forms/QuickPick";
import { QuickPickEditable } from "@/components/forms/QuickPickEditable";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { InfraToggle } from "@/components/forms/InfraToggle";
import { DraggableBlocks } from "@/components/forms/DraggableBlocks";
import { EntitySelector, type EntityOption } from "@/components/imoveis/EntitySelector";
import { ImovelGaleria } from "@/components/imoveis/ImovelGaleria";

// ---------- catálogos ----------
const STATUS_OPTS: { slug: string; label: string; icon: typeof Home; color: string; bg: string; border: string }[] = [
  { slug: "disponivel", label: "Ativo",     icon: Home,        color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { slug: "reservado",  label: "Reservado", icon: Clock,       color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  { slug: "vendido",    label: "Vendido",   icon: CheckCircle2, color: "text-red-500",    bg: "bg-red-500/10",     border: "border-red-500/30" },
  { slug: "alugado",    label: "Alugado",   icon: Key,         color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
  { slug: "suspenso",   label: "Suspenso",  icon: Ban,         color: "text-gray-500",    bg: "bg-gray-500/10",    border: "border-gray-500/30" },
];

const TIPOS_FALLBACK = ["Apartamento", "Casa", "Comercial", "Terreno", "Lote", "Condomínio"];
const CONDICAO_OPTS = ["Mobiliado", "Semi-mobiliado", "Vazio", "Decorado"];
const OWNER_TYPE_OPTS = ["Construtora", "Investidor", "Particular", "Adm Comercial", "Exclusividade"];
const PADRAO_OPTS = ["Econômico", "Médio Padrão", "Alto Padrão", "Luxo"];
const DESTAQUE_OPTS = [
  { value: "none", label: "Sem destaque" },
  { value: "apartamentos", label: "Apartamentos" },
  { value: "condominios", label: "Condomínios" },
  { value: "casas", label: "Casas" },
  { value: "lotes-cond", label: "Lotes Condomínio" },
  { value: "lotes-bairro", label: "Lotes Bairro" },
  { value: "decorados", label: "Decorados" },
  { value: "vista-mar", label: "Vista Mar" },
];
const PAYMENT_OPTS = [
  "À Vista", "Parcelamento 12x", "Parcelamento 24x", "Parcelamento 36x",
  "Parcelamento 48x", "Parcelamento 60x", "Parcelamento 120x",
  "Financiamento Bancário", "FGTS", "Dação", "Permuta", "Consórcio",
];

const AI_STYLES = [
  { id: "gatilhos", label: "🎯 Gatilhos de Venda" },
  { id: "agressiva", label: "🔥 Agressiva" },
  { id: "informativa", label: "📋 Informativa" },
  { id: "geolocalizacao", label: "📍 Geolocalização" },
  { id: "padrao_anuncio", label: "📣 Legenda Padrão Anúncio" },
];

// ---------- helpers ----------
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border">
      <Icon className="w-5 h-5 text-primary" />
      <h3 className="text-base font-bold text-foreground">{title}</h3>
    </div>
  );
}

type FormState = {
  titulo: string;
  tipo_imovel: string;
  status_imovel: string;
  unidade: string;
  box: string;
  quadra: string;
  lote: string;
  // endereço
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; estado: string;
  latitude: number | null; longitude: number | null;
  // estruturas
  edificio_id: string;
  condominio_id: string;
  empreendimento_id: string;
  loteamento_id: string;
  // valores
  preco: string; preco_parcelado: string;
  comissao_percentual: string;
  bonus: string; validade_bonus: string; padrao: string;
  condicoes_pagamento: string[];
  // proprietário
  responsavel_nome: string; responsavel_telefone: string; tipo_proprietario: string;
  local_chaves: string;
  data_vencimento_exclusividade: string;
  termo_exclusividade_path: string;
  // caract / contagens
  dormitorios: number; suites: number; banheiros: number; lavabo: number; vagas: number; elevadores: number;
  area_total: string; area_privativa: string;
  condicao: string; posicao_predio: string; posicao_solar: string; vista: string;
  vista_mar: boolean; decorado: boolean; aceita_permuta: boolean;
  ativo_site: boolean; publicar_xml: boolean; destaque_home: boolean; destaque_categoria: string;
  infraestrutura: string[]; outras_caracteristicas: string[];
  // mídia/links
  descricao: string;
  link_video: string; link_material: string; tour_360: string;
  link_drive_fotos: string; pdf_comercial_path: string;
};

const INITIAL: FormState = {
  titulo: "", tipo_imovel: "", status_imovel: "disponivel",
  unidade: "", box: "", quadra: "", lote: "",
  cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", estado: "",
  latitude: null, longitude: null,
  edificio_id: "", condominio_id: "", empreendimento_id: "", loteamento_id: "",
  preco: "", preco_parcelado: "",
  comissao_percentual: "",
  bonus: "", validade_bonus: "", padrao: "",
  condicoes_pagamento: [],
  responsavel_nome: "", responsavel_telefone: "", tipo_proprietario: "",
  local_chaves: "", data_vencimento_exclusividade: "", termo_exclusividade_path: "",
  dormitorios: 0, suites: 0, banheiros: 0, lavabo: 0, vagas: 0, elevadores: 0,
  area_total: "", area_privativa: "",
  condicao: "", posicao_predio: "", posicao_solar: "", vista: "",
  vista_mar: false, decorado: false, aceita_permuta: false,
  ativo_site: true, publicar_xml: false, destaque_home: false, destaque_categoria: "none",
  infraestrutura: [], outras_caracteristicas: [],
  descricao: "",
  link_video: "", link_material: "", tour_360: "",
  link_drive_fotos: "", pdf_comercial_path: "",
};

export function ImovelForm({ initial }: { initial?: any | null }) {
  const { user, profile, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const editId: string | undefined = initial?.id;
  const isEdit = !!editId;

  const [imovelId, setImovelId] = useState<string | null>(editId ?? null);
  const DRAFT_KEY = "imovel-novo-draft";
  const [form, setForm] = useState<FormState>({
    ...INITIAL,
    ...(initial
      ? {
          titulo: initial.titulo ?? "",
          tipo_imovel: initial.tipo_imovel ?? "",
          status_imovel: initial.status_imovel ?? "disponivel",
          unidade: initial.unidade ?? "", box: initial.box ?? "",
          quadra: initial.quadra ?? "", lote: initial.lote ?? "",
          cep: initial.cep ?? "", logradouro: initial.logradouro ?? "",
          numero: initial.numero ?? "", complemento: initial.complemento ?? "",
          bairro: initial.bairro ?? "", cidade: initial.cidade ?? "", estado: initial.estado ?? "",
          latitude: initial.latitude ?? null, longitude: initial.longitude ?? null,
          edificio_id: initial.edificio_id ?? "", condominio_id: initial.condominio_id ?? "",
          empreendimento_id: initial.empreendimento_id ?? "", loteamento_id: initial.loteamento_id ?? "",
          preco: initial.preco != null ? String(initial.preco) : "",
          preco_parcelado: initial.preco_parcelado != null ? String(initial.preco_parcelado) : "",
          comissao_percentual: initial.comissao_percentual != null ? String(initial.comissao_percentual) : "",
          bonus: initial.bonus ?? "",
          validade_bonus: initial.validade_bonus ?? "",
          padrao: initial.padrao ?? "",
          condicoes_pagamento: initial.condicoes_pagamento ?? [],
          responsavel_nome: initial.responsavel_nome ?? "",
          responsavel_telefone: initial.responsavel_telefone ?? "",
          tipo_proprietario: initial.tipo_proprietario ?? "",
          local_chaves: initial.local_chaves ?? "",
          data_vencimento_exclusividade: initial.data_vencimento_exclusividade ?? "",
          termo_exclusividade_path: initial.termo_exclusividade_path ?? "",
          dormitorios: initial.dormitorios ?? 0, suites: initial.suites ?? 0, banheiros: initial.banheiros ?? 0,
          lavabo: initial.lavabo ?? 0, vagas: initial.vagas ?? 0, elevadores: initial.elevadores ?? 0,
          area_total: initial.area_total != null ? String(initial.area_total) : "",
          area_privativa: initial.area_privativa != null ? String(initial.area_privativa) : "",
          condicao: initial.condicao ?? "", posicao_predio: initial.posicao_predio ?? "",
          posicao_solar: initial.posicao_solar ?? "", vista: initial.vista ?? "",
          vista_mar: !!initial.vista_mar, decorado: !!initial.decorado, aceita_permuta: !!initial.aceita_permuta,
          ativo_site: initial.ativo_site ?? true, publicar_xml: !!initial.publicar_xml,
          destaque_home: !!initial.destaque_home,
          destaque_categoria: initial.destaque_categoria || "none",
          infraestrutura: initial.infraestrutura ?? [],
          outras_caracteristicas: initial.outras_caracteristicas ?? [],
          descricao: initial.descricao ?? "",
          link_video: initial.link_video ?? "", link_material: initial.link_material ?? "",
          tour_360: initial.tour_360 ?? "", link_drive_fotos: initial.link_drive_fotos ?? "",
          pdf_comercial_path: initial.pdf_comercial_path ?? "",
        }
      : (() => {
          if (typeof window === "undefined") return {};
          try {
            const raw = localStorage.getItem(DRAFT_KEY);
            return raw ? JSON.parse(raw) : {};
          } catch { return {}; }
        })()),
  });

  // Persiste rascunho (somente no modo novo)
  useEffect(() => {
    if (isEdit) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
  }, [form, isEdit]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const [saving, setSaving] = useState(false);
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [aiBusyStyle, setAiBusyStyle] = useState<string | null>(null);
  const newCaractRef = useRef<HTMLInputElement>(null);

  const { active: tiposImovel, addOption: addTipoImovel } = useSystemOptions("tipo_imovel");
  const { active: infraOptsRaw, addOption: addInfra } = useSystemOptions("infraestrutura");
  const { active: posicaoPredioOpts, addOption: addPosPredio } = useSystemOptions("posicao_predio");
  const { active: posicaoSolarOpts, addOption: addPosSolar } = useSystemOptions("posicao_solar");
  const { active: vistaOpts, addOption: addVista } = useSystemOptions("vista");
  const { active: padraoOpts, addOption: addPadrao } = useSystemOptions("padrao_imovel");
  const { active: pagamentoOpts, addOption: addPagamento } = useSystemOptions("condicoes_pagamento");
  const { active: condicaoOpts, addOption: addCondicao } = useSystemOptions("condicao_imovel");

  const tiposLabels = useMemo(
    () => (tiposImovel.length ? tiposImovel.map((t) => t.nome) : TIPOS_FALLBACK),
    [tiposImovel],
  );
  const infraOpts = useMemo(() => infraOptsRaw.map((o) => o.nome), [infraOptsRaw]);
  const posPredioLabels = useMemo(
    () => (posicaoPredioOpts.length ? posicaoPredioOpts.map((o) => o.nome) : ["Frente", "Fundos", "Lateral", "Esquina"]),
    [posicaoPredioOpts],
  );
  const posSolarLabels = useMemo(
    () => (posicaoSolarOpts.length ? posicaoSolarOpts.map((o) => o.nome) : ["Nascente", "Poente", "Norte", "Sul"]),
    [posicaoSolarOpts],
  );
  const vistaLabels = useMemo(
    () => (vistaOpts.length ? vistaOpts.map((o) => o.nome) : ["Mar", "Cidade", "Lagoa", "Montanha"]),
    [vistaOpts],
  );
  const padraoLabels = useMemo(
    () => (padraoOpts.length ? padraoOpts.map((o) => o.nome) : PADRAO_OPTS),
    [padraoOpts],
  );
  const pagamentoLabels = useMemo(
    () => (pagamentoOpts.length ? pagamentoOpts.map((o) => o.nome) : PAYMENT_OPTS),
    [pagamentoOpts],
  );
  const condicaoLabels = useMemo(
    () => (condicaoOpts.length ? condicaoOpts.map((o) => o.nome) : CONDICAO_OPTS),
    [condicaoOpts],
  );

  const gerarDescFn = useServerFn(gerarDescricaoImovel);
  const fnListFeed = useServerFn(listFeedPersonalizadoIds);
  const fnSetFeed = useServerFn(setImovelInFeedPersonalizado);
  const [inFeedPersonalizado, setInFeedPersonalizado] = useState(false);

  // Carrega estado do feed personalizado para este imóvel
  useEffect(() => {
    if (!imovelId) return;
    fnListFeed().then((r: any) => {
      setInFeedPersonalizado((r?.imovel_ids ?? []).includes(imovelId));
    }).catch(() => {});
  }, [imovelId]);

  // logs (modo edição)
  useEffect(() => {
    if (!imovelId) return;
    supabase
      .from("imovel_logs")
      .select("*")
      .eq("imovel_id", imovelId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then((r) => setLogs(r.data ?? []));
  }, [imovelId]);

  // preenche proprietário com perfil (modo novo / não super_admin)
  useEffect(() => {
    if (isEdit || isSuperAdmin || !profile) return;
    setForm((p) => ({
      ...p,
      responsavel_nome: p.responsavel_nome || profile.full_name || "",
      responsavel_telefone: p.responsavel_telefone || profile.phone || profile.telefone || "",
    }));
  }, [isEdit, isSuperAdmin, profile]);

  // comissão calculada
  const comissaoValor = (parseFloat(form.preco) || 0) * (parseFloat(form.comissao_percentual) || 0) / 100;

  // endereço bridge
  const enderecoValue: Endereco = {
    cep: form.cep, logradouro: form.logradouro, numero: form.numero,
    complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado,
  };
  const onEnderecoChange = (v: Endereco) => setForm((p) => ({ ...p, ...v }));

  function handleEntitySelect(entity: EntityOption) {
    setForm((p) => ({
      ...p,
      cep: entity.cep || p.cep,
      logradouro: entity.logradouro || p.logradouro,
      numero: entity.numero || p.numero,
      complemento: entity.complemento || p.complemento,
      bairro: entity.bairro || p.bairro,
      cidade: entity.cidade || p.cidade,
      estado: entity.estado || p.estado,
      latitude: entity.latitude ?? p.latitude,
      longitude: entity.longitude ?? p.longitude,
      infraestrutura: Array.from(new Set([...(p.infraestrutura || []), ...((entity.infraestrutura as string[]) || [])])),
    }));
    toast.success(`Dados de "${entity.nome}" herdados`);
  }

  function togglePayment(cond: string) {
    setForm((p) => ({
      ...p,
      condicoes_pagamento: p.condicoes_pagamento.includes(cond)
        ? p.condicoes_pagamento.filter((c) => c !== cond)
        : [...p.condicoes_pagamento, cond],
    }));
  }

  async function uploadTermo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande (limite 10MB)"); return; }
    const ext = f.name.split(".").pop() || "bin";
    const path = `termos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("exclusividades").upload(path, f);
    if (error) { toast.error(error.message); return; }
    set("termo_exclusividade_path", path);
    toast.success("Termo enviado");
    e.target.value = "";
  }

  async function uploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (limite 20MB)"); return; }
    const ext = f.name.split(".").pop() || "pdf";
    const path = `pdf/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("materiais").upload(path, f);
    if (error) { toast.error(error.message); return; }
    set("pdf_comercial_path", path);
    toast.success("PDF enviado");
    e.target.value = "";
  }

  async function gerarDescricao(estilo: string) {
    if (!form.titulo && !form.tipo_imovel && !form.cidade) {
      toast.error("Preencha título, tipo e cidade antes de gerar.");
      return;
    }
    setAiBusyStyle(estilo);
    try {
      const r = await gerarDescFn({
        data: {
          titulo: form.titulo,
          tipo: form.tipo_imovel,
          cidade: form.cidade,
          bairro: form.bairro,
          dormitorios: form.dormitorios || null,
          banheiros: form.banheiros || null,
          vagas: form.vagas || null,
          area_privativa: form.area_privativa ? Number(form.area_privativa) : null,
          area_total: form.area_total ? Number(form.area_total) : null,
          preco: form.preco ? Number(form.preco) : null,
          infraestrutura: form.infraestrutura,
          vista: form.vista,
          posicao_solar: form.posicao_solar,
          condicao: form.condicao,
          observacoes: `Estilo solicitado: ${estilo}`,
        },
      });
      set("descricao", (r as any).description ?? form.descricao);
      toast.success("Descrição gerada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar descrição");
    } finally {
      setAiBusyStyle(null);
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user) { toast.error("Você precisa estar logado."); return; }
    if (!form.titulo.trim()) { toast.error("Título é obrigatório."); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        titulo: form.titulo,
        tipo_imovel: form.tipo_imovel || null,
        status_imovel: form.status_imovel || "disponivel",
        unidade: form.unidade || null, box: form.box || null,
        quadra: form.quadra || null, lote: form.lote || null,
        cep: form.cep || null, logradouro: form.logradouro || null,
        numero: form.numero || null, complemento: form.complemento || null,
        bairro: form.bairro || null, cidade: form.cidade || null, estado: form.estado || null,
        latitude: form.latitude, longitude: form.longitude,
        edificio_id: form.edificio_id || null,
        condominio_id: form.condominio_id || null,
        empreendimento_id: form.empreendimento_id || null,
        loteamento_id: form.loteamento_id || null,
        preco: form.preco ? Number(form.preco) : null,
        preco_parcelado: form.preco_parcelado ? Number(form.preco_parcelado) : null,
        comissao_percentual: form.comissao_percentual ? Number(form.comissao_percentual) : null,
        valor_comissao: comissaoValor || null,
        bonus: form.bonus || null,
        validade_bonus: form.validade_bonus || null,
        padrao: form.padrao || null,
        condicoes_pagamento: form.condicoes_pagamento,
        responsavel_nome: form.responsavel_nome || null,
        responsavel_telefone: form.responsavel_telefone || null,
        tipo_proprietario: form.tipo_proprietario || null,
        local_chaves: form.local_chaves || null,
        data_vencimento_exclusividade: form.data_vencimento_exclusividade || null,
        termo_exclusividade_path: form.termo_exclusividade_path || null,
        dormitorios: form.dormitorios || null,
        suites: form.suites || null,
        banheiros: form.banheiros || null,
        lavabo: form.lavabo || null,
        vagas: form.vagas || null,
        elevadores: form.elevadores || null,
        area_total: form.area_total ? Number(form.area_total) : null,
        area_privativa: form.area_privativa ? Number(form.area_privativa) : null,
        condicao: form.condicao || null,
        posicao_predio: form.posicao_predio || null,
        posicao_solar: form.posicao_solar || null,
        vista: form.vista || null,
        vista_mar: form.vista_mar, decorado: form.decorado, aceita_permuta: form.aceita_permuta,
        ativo_site: form.ativo_site,
        publicar_xml: form.publicar_xml,
        destaque_home: form.destaque_home || form.destaque_categoria !== "none",
        destaque_categoria: form.destaque_categoria === "none" ? null : form.destaque_categoria,
        infraestrutura: form.infraestrutura,
        outras_caracteristicas: form.outras_caracteristicas,
        descricao: form.descricao || null,
        link_video: form.link_video || null,
        link_material: form.link_material || null,
        tour_360: form.tour_360 || null,
        link_drive_fotos: form.link_drive_fotos || null,
        pdf_comercial_path: form.pdf_comercial_path || null,
      };

      let savedId = imovelId;
      if (imovelId) {
        const { error } = await supabase.from("imoveis").update(payload as never).eq("id", imovelId);
        if (error) throw error;
        await logAudit("imovel_atualizado", `Imóvel ${form.titulo}`);
        await logImovel(imovelId, "atualizado", `Imóvel atualizado: ${form.titulo}`);
        toast.success("Imóvel atualizado");
      } else {
        payload.created_by = user.id;
        const { data, error } = await supabase.from("imoveis").insert(payload as never).select().single();
        if (error) throw error;
        setImovelId(data.id);
        savedId = data.id;
        await logAudit("imovel_criado", `Imóvel ${data.titulo} (${data.codigo_interno})`);
        await logImovel(data.id, "criado", `Imóvel criado: ${data.titulo}`);
        toast.success(`Imóvel criado — ${data.codigo_interno}`);
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
      }

      // Sincroniza Feed Personalizado
      if (savedId) {
        try {
          await fnSetFeed({ data: { imovel_id: savedId, incluir: inFeedPersonalizado } });
        } catch (err) {
          console.warn("Falha ao sincronizar Feed Personalizado", err);
        }
      }

      if (!imovelId && savedId) {
        navigate({ to: "/imoveis/$id/editar", params: { id: savedId } });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-5xl mx-auto space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground">
            {isEdit ? "Editar Imóvel" : "Cadastrar Novo Imóvel"}
          </h1>
          {initial?.codigo_interno && (
            <p className="text-xs text-muted-foreground">Código: <b>{initial.codigo_interno}</b></p>
          )}
        </div>
        <Button type="submit" disabled={saving} className="gap-2 w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : isEdit || imovelId ? "Salvar" : "Cadastrar"}
        </Button>
      </div>

      <DraggableBlocks storageKey="imovel-form-blocks-order">
        {/* IDENTIFICAÇÃO */}
        <div key="identificacao" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={Building2} title="Identificação" />
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 sm:gap-4 mb-4">
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">Título do Imóvel *</Label>
              <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Apartamento 3 quartos frente mar" required />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Unidade</Label><Input value={form.unidade} onChange={(e) => set("unidade", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Box</Label>
              {(() => {
                const boxes = form.box ? form.box.split(",").map((b) => b.trim()) : [""];
                const updateBoxes = (arr: string[]) => set("box", arr.join(", "));
                return (
                  <div className="space-y-1.5">
                    {boxes.map((b, i) => (
                      <div key={i} className="flex gap-1.5">
                        <Input
                          value={b}
                          onChange={(e) => {
                            const next = [...boxes];
                            next[i] = e.target.value;
                            updateBoxes(next);
                          }}
                          placeholder={`Box ${i + 1}`}
                        />
                        {boxes.length > 1 && (
                          <Button type="button" variant="outline" size="icon" onClick={() => updateBoxes(boxes.filter((_, j) => j !== i))}>
                            ×
                          </Button>
                        )}
                        {i === boxes.length - 1 && (
                          <Button type="button" variant="outline" size="icon" onClick={() => updateBoxes([...boxes, ""])}>
                            +
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Quadra</Label><Input value={form.quadra} onChange={(e) => set("quadra", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Lote</Label><Input value={form.lote} onChange={(e) => set("lote", e.target.value)} /></div>
          </div>

          <QuickPickEditable
            label="Tipo do Imóvel"
            icon={<Home className="w-3.5 h-3.5" />}
            options={tiposLabels}
            value={form.tipo_imovel}
            onChange={(v) => set("tipo_imovel", String(v))}
            onAddOption={addTipoImovel}
            className="mb-4"
          />

          <div className="mb-4 space-y-1.5">
            <Label className="text-xs">Status do Imóvel</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTS.map((s) => {
                const Icon = s.icon;
                const active = form.status_imovel === s.slug;
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => set("status_imovel", s.slug)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all",
                      active ? `${s.bg} ${s.color} ${s.border} shadow-sm` : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" /> {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-4">
            <QuickPick label="Dormitórios" icon={<BedDouble className="w-3.5 h-3.5" />} options={[0,1,2,3,4,"5+"]} value={form.dormitorios} onChange={(v) => set("dormitorios", v === "5+" ? 5 : Number(v))} />
            <QuickPick label="Suítes" icon={<BedDouble className="w-3.5 h-3.5" />} options={[0,1,2,3,4,"5+"]} value={form.suites} onChange={(v) => set("suites", v === "5+" ? 5 : Number(v))} />
            <QuickPick label="Banheiros" icon={<Bath className="w-3.5 h-3.5" />} options={[0,1,2,3,4,"5+"]} value={form.banheiros} onChange={(v) => set("banheiros", v === "5+" ? 5 : Number(v))} />
            <QuickPick label="Lavabo" icon={<Bath className="w-3.5 h-3.5" />} options={[0,1,"2+"]} value={form.lavabo} onChange={(v) => set("lavabo", v === "2+" ? 2 : Number(v))} />
            <QuickPick label="Vagas" icon={<Car className="w-3.5 h-3.5" />} options={[0,1,2,3,"4+"]} value={form.vagas} onChange={(v) => set("vagas", v === "4+" ? 4 : Number(v))} />
            <QuickPick label="Elevadores" options={[0,1,2,"3+"]} value={form.elevadores} onChange={(v) => set("elevadores", v === "3+" ? 3 : Number(v))} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> Área Privativa (m²)</Label>
              <Input type="number" value={form.area_privativa} onChange={(e) => set("area_privativa", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> Área Total (m²)</Label>
              <Input type="number" value={form.area_total} onChange={(e) => set("area_total", e.target.value)} />
            </div>
          </div>
        </div>

        {/* VINCULAÇÃO */}
        <div key="vinculacao" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={Landmark} title="Vincular a Edifício / Condomínio / Loteamento" />
          <p className="text-xs text-muted-foreground mb-4">Selecione apenas um. Endereço e infraestrutura serão herdados.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <EntitySelector
              id="edificio" label="Edifício" icon={<Building className="w-3.5 h-3.5" />} table="edificios"
              value={form.edificio_id}
              onChange={(id) => { set("edificio_id", id); if (id) { set("condominio_id", ""); set("empreendimento_id", ""); set("loteamento_id", ""); } }}
              onSelect={handleEntitySelect}
              openId={openEntity} setOpenId={setOpenEntity}
            />
            <EntitySelector
              id="condominio" label="Condomínio" icon={<Fence className="w-3.5 h-3.5" />} table="condominios"
              value={form.condominio_id}
              onChange={(id) => { set("condominio_id", id); if (id) { set("edificio_id", ""); set("empreendimento_id", ""); set("loteamento_id", ""); } }}
              onSelect={handleEntitySelect}
              openId={openEntity} setOpenId={setOpenEntity}
            />
            <EntitySelector
              id="loteamento" label="Loteamento" icon={<Landmark className="w-3.5 h-3.5" />} table="loteamentos"
              value={form.loteamento_id}
              onChange={(id) => { set("loteamento_id", id); if (id) { set("edificio_id", ""); set("condominio_id", ""); set("empreendimento_id", ""); } }}
              onSelect={handleEntitySelect}
              openId={openEntity} setOpenId={setOpenEntity}
            />
          </div>
        </div>

        {/* ENDEREÇO */}
        <div key="endereco" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={MapPin} title="Endereço" />
          <CepAutoFill value={enderecoValue} onChange={onEnderecoChange} />
        </div>

        {/* MAPA */}
        <div key="mapa" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={MapPin} title="Localização no Mapa" />
          <MapPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={(lat, lng) => setForm((p) => ({ ...p, latitude: lat, longitude: lng }))}
          />
        </div>

        {/* VALORES */}
        <div key="valor" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={DollarSign} title="Valor e Condições" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Preço</Label>
              <CurrencyInput value={form.preco} onValueChange={(v) => set("preco", v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preço Parcelado</Label>
              <CurrencyInput value={form.preco_parcelado} onValueChange={(v) => set("preco_parcelado", v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> Comissão (%)</Label>
              <Input type="number" step="0.01" value={form.comissao_percentual} onChange={(e) => set("comissao_percentual", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor Comissão</Label>
              <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted text-sm font-semibold">
                R$ {comissaoValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Gift className="w-3.5 h-3.5" /> Bônus (texto livre)</Label>
              <Input value={form.bonus} onChange={(e) => set("bonus", e.target.value)} placeholder="Ex: R$ 10.000 em móveis" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Validade do Bônus</Label>
              <Input type="date" value={form.validade_bonus} onChange={(e) => set("validade_bonus", e.target.value)} />
            </div>
            <QuickPickEditable
              label="Padrão"
              options={padraoLabels}
              value={form.padrao}
              onChange={(v) => set("padrao", String(v))}
              onAddOption={addPadrao}
            />
          </div>

          <QuickPickEditable
            label="Condições de Pagamento"
            multi
            options={pagamentoLabels}
            value={form.condicoes_pagamento}
            onChange={(v) => set("condicoes_pagamento", Array.isArray(v) ? v : [v])}
            onAddOption={addPagamento}
          />
        </div>

        {/* PROPRIETÁRIO */}
        <div key="proprietario" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={User} title="Proprietário" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><User className="w-3.5 h-3.5" /> Nome</Label>
              <Input value={form.responsavel_nome} onChange={(e) => set("responsavel_nome", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Telefone</Label>
              <Input value={form.responsavel_telefone} onChange={(e) => set("responsavel_telefone", e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <QuickPick label="Tipo do Proprietário" options={OWNER_TYPE_OPTS} value={form.tipo_proprietario} onChange={(v) => set("tipo_proprietario", String(v))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Key className="w-3.5 h-3.5" /> Local das Chaves</Label>
              <Input value={form.local_chaves} onChange={(e) => set("local_chaves", e.target.value)} placeholder="Ex: Portaria, Imobiliária..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Vencimento Exclusividade</Label>
              <Input type="date" value={form.data_vencimento_exclusividade} onChange={(e) => set("data_vencimento_exclusividade", e.target.value)} />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Arquivo do Termo</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="file" accept="image/*,application/pdf" onChange={uploadTermo} className="flex-1 min-w-[200px]" />
              {form.termo_exclusividade_path && (
                <>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{form.termo_exclusividade_path}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => set("termo_exclusividade_path", "")}>Remover</Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CARACTERÍSTICAS */}
        <div key="caracteristicas" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={Sparkles} title="Características" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <QuickPickEditable label="Condição" options={condicaoLabels} value={form.condicao} onChange={(v) => set("condicao", String(v))} onAddOption={addCondicao} />
            <QuickPickEditable label="Posição no Prédio" options={posPredioLabels} value={form.posicao_predio} onChange={(v) => set("posicao_predio", String(v))} onAddOption={addPosPredio} />
            <QuickPickEditable label="Posição Solar" options={posSolarLabels} value={form.posicao_solar} onChange={(v) => set("posicao_solar", String(v))} onAddOption={addPosSolar} />
            <QuickPickEditable label="Vista" options={vistaLabels} value={form.vista} onChange={(v) => set("vista", String(v))} onAddOption={addVista} />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-6 mb-4 py-3 px-3 sm:px-4 bg-muted/50 rounded-lg">
            <label className="flex items-center gap-2"><Switch checked={form.vista_mar} onCheckedChange={(v) => set("vista_mar", v)} /><span className="text-xs">Vista Mar</span></label>
            <label className="flex items-center gap-2"><Switch checked={form.decorado} onCheckedChange={(v) => set("decorado", v)} /><span className="text-xs">Decorado</span></label>
            <label className="flex items-center gap-2"><Switch checked={form.aceita_permuta} onCheckedChange={(v) => set("aceita_permuta", v)} /><span className="text-xs">Permuta</span></label>
            <label className="flex items-center gap-2"><Switch checked={inFeedPersonalizado} onCheckedChange={setInFeedPersonalizado} /><span className="text-xs font-semibold">⭐ Feed Personalizado</span></label>
            {isSuperAdmin && (
              <>
                <label className="flex items-center gap-2"><Switch checked={form.ativo_site} onCheckedChange={(v) => set("ativo_site", v)} /><span className="text-xs font-semibold">🌐 Site</span></label>
                <label className="flex items-center gap-2"><Switch checked={form.publicar_xml} onCheckedChange={(v) => set("publicar_xml", v)} /><span className="text-xs font-semibold">📡 Portais (XML)</span></label>
                <label className="flex items-center gap-2">
                  <Switch checked={form.destaque_home} onCheckedChange={(v) => { set("destaque_home", v); if (!v) set("destaque_categoria", "none"); }} />
                  <span className="text-xs font-semibold">⭐ Destaque</span>
                </label>
                <div className="col-span-2 sm:col-span-1">
                  <QuickPick
                    label="Tipo de Destaque"
                    options={DESTAQUE_OPTS.map((o) => o.label)}
                    value={DESTAQUE_OPTS.find((o) => o.value === form.destaque_categoria)?.label || "Sem destaque"}
                    onChange={(v) => {
                      const opt = DESTAQUE_OPTS.find((o) => o.label === String(v));
                      set("destaque_categoria", opt?.value || "none");
                      if (opt && opt.value !== "none") set("destaque_home", true);
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <InfraToggle label="Infraestrutura" options={infraOpts} selected={form.infraestrutura} onChange={(s) => set("infraestrutura", s)} allowCustom onAddOption={addInfra} />

          <div className="mt-4">
            <Label className="text-xs font-semibold mb-2 block">Outras Características</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.outras_caracteristicas.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs">
                  {t}
                  <button type="button" onClick={() => set("outras_caracteristicas", form.outras_caracteristicas.filter((_, idx) => idx !== i))}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                ref={newCaractRef}
                placeholder="Ex: Beira Lago, Documentação OK..."
                className="flex-1 sm:max-w-xs h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = newCaractRef.current?.value.trim();
                    if (!v) return;
                    if (!form.outras_caracteristicas.includes(v)) set("outras_caracteristicas", [...form.outras_caracteristicas, v]);
                    if (newCaractRef.current) newCaractRef.current.value = "";
                  }
                }}
              />
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => {
                  const v = newCaractRef.current?.value.trim();
                  if (!v) return;
                  if (!form.outras_caracteristicas.includes(v)) set("outras_caracteristicas", [...form.outras_caracteristicas, v]);
                  if (newCaractRef.current) newCaractRef.current.value = "";
                }}
              >Adicionar</Button>
            </div>
          </div>
        </div>

        {/* DESCRIÇÃO */}
        <div key="descricao" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={FileText} title="Descrição" />
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">Gerar com IA</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AI_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={aiBusyStyle !== null}
                  onClick={() => gerarDescricao(s.id)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {aiBusyStyle === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea rows={6} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Descreva o imóvel com o máximo de detalhes..." className="resize-y" />
        </div>

        {/* MÍDIA */}
        <div key="midia" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={Play} title="Vídeo e Material" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Play className="w-3.5 h-3.5" /> Link do Vídeo</Label>
              <Input value={form.link_video} onChange={(e) => set("link_video", e.target.value)} placeholder="https://youtube.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><FolderDown className="w-3.5 h-3.5" /> Drive de Fotos</Label>
              <Input value={form.link_drive_fotos} onChange={(e) => set("link_drive_fotos", e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><FolderDown className="w-3.5 h-3.5" /> Link Material Completo</Label>
              <Input value={form.link_material} onChange={(e) => set("link_material", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Download className="w-3.5 h-3.5" /> PDF Comercial</Label>
              <div className="flex gap-2 flex-wrap">
                <Input type="file" accept="application/pdf" onChange={uploadPdf} className="flex-1 min-w-[200px]" />
                {form.pdf_comercial_path && (
                  <>
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">{form.pdf_comercial_path}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => set("pdf_comercial_path", "")}>Remover</Button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Tour 360°</Label>
              <Input value={form.tour_360} onChange={(e) => set("tour_360", e.target.value)} placeholder="https://kuula.co/..." />
            </div>
          </div>
        </div>

        {/* FOTOS */}
        <div key="fotos" className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <SectionHeader icon={ImageIcon} title="Fotos do Imóvel" />
          {imovelId ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                A primeira foto é a <b>capa</b>. Reordene pelos botões ▲ ▼ e marque outra foto como capa com a estrela.
              </p>
              <ImovelGaleria imovelId={imovelId} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Salve o imóvel para habilitar o upload de fotos.</p>
          )}
        </div>
      </DraggableBlocks>

      {/* HISTÓRICO */}
      {imovelId && (
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
          <SectionHeader icon={History} title="Histórico de Alterações" />
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhuma alteração registrada.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="border border-border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{log.acao}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    </span>
                  </div>
                  {log.descricao && <p className="text-xs text-muted-foreground">{log.descricao}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-3 pb-6">
        <Button type="button" variant="outline" onClick={() => { if (!isEdit) { try { localStorage.removeItem(DRAFT_KEY); } catch {} } navigate({ to: "/imoveis" }); }} className="w-full sm:w-auto">Cancelar</Button>
        <Button type="submit" disabled={saving} className="gap-2 px-8 w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : isEdit || imovelId ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
