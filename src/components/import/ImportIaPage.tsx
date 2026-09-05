import { useMemo } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { FileDropzone } from "./FileDropzone";
import { PreviewTable } from "./PreviewTable";
import { ColumnMapper } from "./ColumnMapper";
import { ImportReport } from "./ImportReport";
import { parseFile, coerceValue } from "@/lib/import-runner";
import { IMOVEIS_FIELDS_UNIQUE } from "@/lib/import-schemas";
import {
  useImportIaState,
  setImportIa,
  resetImportIa,
  getImportIaState,
  type ReviewItem,
  type Etapa,
} from "@/lib/import-ia-store";
import {
  iaSugerirMapeamento,
  iaNormalizarLote,
  iaVincularEmpreendimentos,
  buscarDuplicados,
  iaResolverDuplicados,
  executarImportacaoIa,
} from "@/lib/import-ia.functions";

const STATUS_OPCOES = [
  { value: "", label: "Não definir status" },
  { value: "pre_importacao", label: "Pré-importação (revisar antes de ativar)" },
  { value: "disponivel", label: "Disponível (ativo)" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "arquivado", label: "Inativo (arquivado)" },
];

const FK_KEYS = ["empreendimento_nome", "condominio_nome", "edificio_nome", "imobiliaria_nome"];

export function ImportIaPage() {
  const st = useImportIaState();
  const { etapa, parsed, fileName, mapping, statusPadrao, forcarStatus, progresso, pct, itens, resultado, erro } = st;

  const setEtapa = (v: Etapa) => setImportIa({ etapa: v });
  const setParsed = (v: any) => setImportIa({ parsed: v });
  const setFileName = (v: string) => setImportIa({ fileName: v });
  const setMapping = (v: Record<string, string>) => setImportIa({ mapping: v });
  const setStatusPadrao = (v: string) => setImportIa({ statusPadrao: v });
  const setForcarStatus = (v: boolean) => setImportIa({ forcarStatus: v });
  const setProgresso = (v: string) => setImportIa({ progresso: v });
  const setPct = (v: number) => setImportIa({ pct: v });
  const setItens = (v: ReviewItem[] | ((prev: ReviewItem[]) => ReviewItem[])) =>
    setImportIa((s) => ({ itens: typeof v === "function" ? v(s.itens) : v }));
  const setResultado = (v: any) => setImportIa({ resultado: v });
  const setErro = (v: string) => setImportIa({ erro: v });


  const sample = useMemo(() => parsed?.rows.slice(0, 12) ?? [], [parsed]);

  async function handleFile(f: File) {
    try {
      const p = await parseFile(f);
      if (!p.rows.length) {
        toast.error("Arquivo sem linhas.");
        return;
      }
      resetImportIa();
      setParsed(p);
      setFileName(f.name);
      setMapping({});
      setEtapa("mapeamento");

      // Sugestão de mapeamento por IA (assíncrona, com fallback silencioso)
      setProgresso("Analisando colunas com IA...");
      try {
        const out = await iaSugerirMapeamento({ data: { headers: p.headers, sample: p.rows.slice(0, 12) } });
        const m: Record<string, string> = {};
        for (const item of out.mapping || []) {
          if (item.campo && (item.confianca ?? 0) >= 0.5) {
            if (!Object.values(m).includes(item.coluna)) m[item.campo] = item.coluna;
          }
        }
        setMapping(m);
        toast.success("Mapeamento sugerido pela IA. Revise antes de continuar.");
      } catch (e: any) {
        toast.error("IA não respondeu no mapeamento: " + (e?.message || "erro"));
      } finally {
        setProgresso("");
      }
    } catch {
      toast.error("Não consegui ler o arquivo.");
    }
  }

  function normKey(d: Record<string, any>) {
    const n = (s: any) =>
      String(s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    if (n(d.codigo_interno)) return `cod:${n(d.codigo_interno)}`;
    return [n(d.cidade), n(d.logradouro), n(d.numero), n(d.unidade), n(d.quadra), n(d.lote)].join("|");
  }

  async function processar() {
    if (!parsed) return;
    setEtapa("processando");
    setErro("");
    setPct(0);
    try {
      const fields = IMOVEIS_FIELDS_UNIQUE;
      // 1) Coerção tipada dos campos mapeados
      setProgresso("Convertendo valores...");
      let linhas = parsed.rows.map((src, idx) => {
        const dados: Record<string, any> = {};
        const texto: Record<string, any> = { i: idx, empreendimento: "" };
        for (const f of fields) {
          const header = mapping[f.key];
          if (!header) continue;
          const raw = src[header];
          if (FK_KEYS.includes(f.key)) {
            if (f.key === "imobiliaria_nome") continue; // não vinculado nesta importação
            const v = raw == null ? "" : String(raw).trim();
            if (v) texto.empreendimento = texto.empreendimento ? `${texto.empreendimento} ${v}` : v;
            continue;
          }
          if (f.key === "status_imovel") texto.status = raw == null ? "" : String(raw);
          const v = coerceValue(f, raw);
          if (v !== null) dados[f.key] = v;
        }
        for (const k of ["titulo", "tipo_imovel", "cidade", "bairro", "logradouro", "padrao", "condicao", "posicao_solar", "vista"])
          if (dados[k] != null) texto[k] = String(dados[k]);
        return { idx, dados, texto };
      });

      // 2) Normalização com IA em lotes
      const B = 40;
      for (let k = 0; k < linhas.length; k += B) {
        setProgresso(`IA normalizando linhas ${k + 1}–${Math.min(k + B, linhas.length)}...`);
        setPct(5 + Math.round((k / linhas.length) * 35));
        const lote = linhas.slice(k, k + B).map((l) => l.texto);
        const out = await iaNormalizarLote({ data: { linhas: lote } });
        const byI = new Map((out.linhas || []).map((r: any) => [r.i, r]));
        for (const l of linhas.slice(k, k + B)) {
          const n = byI.get(l.idx);
          if (!n) continue;
          for (const k2 of ["titulo", "tipo_imovel", "cidade", "bairro", "logradouro", "padrao", "condicao", "posicao_solar", "vista"])
            if (n[k2]) l.dados[k2] = n[k2];
          if (n.status_imovel) l.dados.status_imovel = n.status_imovel;
          if (n.arquivado === true) l.dados.arquivado = true;
          if (n.empreendimento_nome) {
            l.texto.empreendimento = n.empreendimento_nome;
            l.texto.empreendimento_tipo = n.empreendimento_tipo || null;
          }
        }
      }

      // 3) Status padrão
      for (const l of linhas) {
        if (forcarStatus || (!l.dados.status_imovel && l.dados.arquivado !== true)) {
          if (statusPadrao === "arquivado") l.dados.arquivado = true;
          else if (statusPadrao) {
            l.dados.status_imovel = statusPadrao;
            l.dados.arquivado = false;
          }
        }
        if (!l.dados.estado) l.dados.estado = "RS";
        if (!l.dados.titulo) l.dados.titulo = `${l.dados.tipo_imovel || "Imóvel"} ${l.dados.cidade || ""}`.trim();
      }

      // 4) Vínculo de empreendimentos
      setProgresso("Vinculando empreendimentos...");
      setPct(45);
      const nomesUnicos = [
        ...new Map(
          linhas
            .filter((l) => l.texto.empreendimento)
            .map((l) => [l.texto.empreendimento.toLowerCase(), { nome: l.texto.empreendimento, tipo: l.texto.empreendimento_tipo || null }]),
        ).values(),
      ];
      const vincMap = new Map<string, { tabela: string; id: string; nome_oficial: string } | null>();
      for (let k = 0; k < nomesUnicos.length; k += 100) {
        const out = await iaVincularEmpreendimentos({ data: { nomes: nomesUnicos.slice(k, k + 100) } });
        for (const r of out.resultado || []) {
          vincMap.set(r.nome.toLowerCase(), r.encontrado ? { tabela: r.tabela!, id: r.id!, nome_oficial: r.nome_oficial! } : null);
        }
      }
      for (const l of linhas) {
        if (!l.texto.empreendimento) continue;
        const v = vincMap.get(l.texto.empreendimento.toLowerCase());
        if (v) {
          const col =
            v.tabela === "condominios" ? "condominio_id"
            : v.tabela === "edificios" ? "edificio_id"
            : v.tabela === "loteamentos" ? "loteamento_id"
            : "empreendimento_id";
          l.dados[col] = v.id;
        }
      }

      // 5) Dedupe dentro do próprio arquivo
      const vistos = new Set<string>();
      linhas = linhas.filter((l) => {
        const key = normKey(l.dados);
        if (vistos.has(key)) return false;
        vistos.add(key);
        return true;
      });

      // 6) Duplicados no banco
      setProgresso("Buscando possíveis duplicados no sistema...");
      setPct(60);
      const dups: any[] = [];
      for (let k = 0; k < linhas.length; k += 200) {
        setProgresso(`Comparando linhas ${k + 1}–${Math.min(k + 200, linhas.length)} com o banco...`);
        setPct(60 + Math.round((k / linhas.length) * 25));
        const out = await buscarDuplicados({
          data: {
            linhas: linhas.slice(k, k + 200).map((l) => ({
              i: l.idx,
              codigo_interno: l.dados.codigo_interno || null,
              cidade: l.dados.cidade || null,
              logradouro: l.dados.logradouro || null,
              numero: l.dados.numero || null,
              unidade: l.dados.unidade || null,
              bairro: l.dados.bairro || null,
              titulo: l.dados.titulo || null,
            })),
          },
        });
        dups.push(...(out.resultados || []));
      }
      const dupByI = new Map(dups.map((d: any) => [d.i, d]));

      // 7) IA decide os duvidosos e também os de código repetido
      const duvidosos = linhas.filter((l) => {
        const d = dupByI.get(l.idx);
        return (d?.status === "duvidoso" || d?.status === "exato") && d?.candidatos?.[0];
      });

      const decididos = new Map<number, { veredito: string; motivo?: string }>();
      for (let k = 0; k < duvidosos.length; k += 30) {
        setProgresso(`IA analisando possíveis duplicados ${k + 1}–${Math.min(k + 30, duvidosos.length)}...`);
        setPct(85 + Math.round((k / Math.max(duvidosos.length, 1)) * 10));
        const pares = duvidosos.slice(k, k + 30).map((l) => ({
          i: l.idx,
          linha: {
            titulo: l.dados.titulo, codigo_interno: l.dados.codigo_interno, tipo_imovel: l.dados.tipo_imovel,
            cidade: l.dados.cidade, bairro: l.dados.bairro, logradouro: l.dados.logradouro, numero: l.dados.numero,
            unidade: l.dados.unidade, quadra: l.dados.quadra, lote: l.dados.lote, preco: l.dados.preco,
          },
          candidato: dupByI.get(l.idx).candidatos[0],
        }));
        const out = await iaResolverDuplicados({ data: { pares } });
        for (const d of out.decisoes || []) decididos.set(d.i, d);
      }

      // 8) Monta revisão
      setProgresso("Montando revisão...");
      setPct(97);
      const itens: ReviewItem[] = linhas.map((l) => {
        const d = dupByI.get(l.idx);
        const cand = d?.candidatos?.[0];
        if (d?.status === "exato" && cand) {
          const dec = decididos.get(l.idx);
          if (dec?.veredito === "diferente")
            return { i: l.idx, dados: l.dados, decisao: "criar", pendente: false, motivo: `Código repetido, imóvel diferente — novo código será gerado (IA: ${dec.motivo || "diferente"})` };
          if (dec?.veredito === "incerto")
            return { i: l.idx, dados: l.dados, decisao: "ignorar", pendente: true, alvoId: cand.id, alvoTitulo: cand.titulo, motivo: dec?.motivo || "Mesmo código, mas IA em dúvida — decida manualmente" };
          return { i: l.idx, dados: l.dados, decisao: "atualizar", pendente: false, alvoId: cand.id, alvoTitulo: cand.titulo, motivo: `Mesmo código interno${dec?.motivo ? ` (IA: ${dec.motivo})` : ""}` };
        }
        if (d?.status === "alto" && cand)
          return { i: l.idx, dados: l.dados, decisao: "atualizar", pendente: false, alvoId: cand.id, alvoTitulo: cand.titulo, motivo: "Semelhança alta" };
        if (d?.status === "duvidoso" && cand) {
          const dec = decididos.get(l.idx);
          if (dec?.veredito === "mesmo_imovel")
            return { i: l.idx, dados: l.dados, decisao: "atualizar", pendente: false, alvoId: cand.id, alvoTitulo: cand.titulo, motivo: `IA: ${dec.motivo || "mesmo imóvel"}` };
          if (dec?.veredito === "diferente")
            return { i: l.idx, dados: l.dados, decisao: "criar", pendente: false, motivo: `IA: ${dec.motivo || "imóvel diferente"}` };
          return { i: l.idx, dados: l.dados, decisao: "ignorar", pendente: true, alvoId: cand.id, alvoTitulo: cand.titulo, motivo: dec?.motivo || "IA em dúvida — decida manualmente" };
        }

        return { i: l.idx, dados: l.dados, decisao: "criar", pendente: false };
      });

      setItens(itens);
      setEtapa("revisao");
    } catch (e: any) {
      setErro(e?.message || "Erro no processamento");
      setEtapa("mapeamento");
      toast.error(e?.message || "Erro no processamento");
    } finally {
      setProgresso("");
    }
  }

  async function executar() {
    const pendentes = itens.filter((x) => x.pendente);
    if (pendentes.length) {
      toast.error(`Resolva as ${pendentes.length} linhas pendentes antes de importar.`);
      return;
    }
    setEtapa("processando");
    setProgresso("Gravando imóveis...");
    try {
      const out = await executarImportacaoIa({
        data: {
          arquivoNome: fileName,
          totalLinhas: parsed?.rows.length || 0,
          acoes: itens.map((x) => ({ tipo: x.decisao, id: x.alvoId || null, dados: x.dados })),
        },
      });
      setResultado(out);
      setEtapa("resultado");
      if (out.falhas === 0) toast.success("Importação concluída!");
      else toast.warning(`Importação concluída com ${out.falhas} falha(s).`);
    } catch (e: any) {
      setErro(e?.message || "Erro ao gravar");
      setEtapa("revisao");
      toast.error(e?.message || "Erro ao gravar");
    } finally {
      setProgresso("");
    }
  }

  const contadores = useMemo(() => {
    const c = { criar: 0, rascunho: 0, atualizar: 0, ignorar: 0, pendente: 0 };
    for (const x of itens) {
      if (x.pendente) c.pendente++;
      else c[x.decisao]++;
    }
    return c;
  }, [itens]);

  return (
    <div className="space-y-6">
      {etapa !== "arquivo" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            Importação em andamento{fileName ? <> — <strong className="text-foreground">{fileName}</strong></> : null}
          </span>
          <button
            onClick={() => resetImportIa()}
            className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Começar de novo
          </button>
        </div>
      )}

      {st.linhasPerdidas && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          A planilha era grande demais para ser guardada ao trocar de aba. Envie o arquivo novamente para continuar.
        </div>
      )}

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {erro}
        </div>
      )}


      {etapa === "arquivo" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Importação inteligente: a IA mapeia as colunas, corrige digitação, interpreta o status e evita duplicados.
          </div>
          <FileDropzone onFile={handleFile} />
        </div>
      )}

      {etapa === "mapeamento" && parsed && (
        <div className="space-y-5">
          <PreviewTable headers={parsed.headers} rows={parsed.rows} />
          {progresso && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" /> {progresso}
            </div>
          )}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="font-medium text-sm">Status dos imóveis</div>
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={statusPadrao}
                onChange={(e) => setStatusPadrao(e.target.value)}
                className="text-sm border rounded-md px-3 py-2 bg-background"
              >
                {STATUS_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={forcarStatus} onChange={(e) => setForcarStatus(e.target.checked)} />
                Forçar este status em todas as linhas (ignora a coluna da planilha)
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Sem forçar, a IA interpreta a coluna de situação da planilha (Ativo/Inativo, Disponível, Vendido...) e o status padrão só vale para linhas sem indicação.
            </p>
          </div>
          <div>
            <div className="font-medium text-sm mb-3">Mapeamento das colunas</div>
            <ColumnMapper fields={IMOVEIS_FIELDS_UNIQUE} headers={parsed.headers} mapping={mapping} onChange={setMapping} />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setEtapa("arquivo")} className="flex items-center gap-2 text-sm border rounded-md px-4 py-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button onClick={processar} className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-md px-4 py-2">
              <Sparkles className="h-4 w-4" /> Processar com IA
            </button>
          </div>
        </div>
      )}

      {etapa === "processando" && (
        <div className="rounded-xl border bg-card p-10 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-sm font-medium">{progresso || "Processando..."}</div>
          {pct > 0 && (
            <div className="w-full max-w-md h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      {etapa === "revisao" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-medium">
              <CheckCircle2 className="inline h-3 w-3 mr-1" />{contadores.criar} novos
            </span>
            <span className="rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400 px-3 py-1 text-xs font-medium">
              {contadores.rascunho} rascunhos
            </span>
            <span className="rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 px-3 py-1 text-xs font-medium">{contadores.atualizar} atualizações</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{contadores.ignorar} ignorados</span>
            {contadores.pendente > 0 && (
              <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1 text-xs font-medium">
                <AlertTriangle className="inline h-3 w-3 mr-1" />{contadores.pendente} pendentes
              </span>
            )}
          </div>
          <div className="rounded-lg border overflow-auto max-h-[480px]">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left w-10">#</th>
                  <th className="px-2 py-2 text-left">Imóvel</th>
                  <th className="px-2 py-2 text-left">Ação</th>
                  <th className="px-2 py-2 text-left">Observação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((x, idx) => (
                  <tr key={x.i} className="border-t">
                    <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                    <td className="px-2 py-1.5 max-w-[260px]">
                      <div className="font-medium truncate">{x.dados.titulo}</div>
                      <div className="text-muted-foreground truncate">
                        {[x.dados.codigo_interno, x.dados.bairro, x.dados.cidade].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      {x.pendente ? (
                        <select
                          value={x.decisao}
                          onChange={(e) =>
                            setItens((prev) =>
                              prev.map((p) =>
                                p.i === x.i
                                  ? { ...p, decisao: e.target.value as any, pendente: false }
                                  : p,
                              ),
                            )
                          }
                          className="border rounded px-2 py-1 bg-background"
                        >
                          <option value="ignorar">Ignorar</option>
                          <option value="criar">Criar novo</option>
                          <option value="atualizar">Atualizar existente</option>
                        </select>
                      ) : (
                        <span
                          className={
                            x.decisao === "criar"
                              ? "text-emerald-600 dark:text-emerald-400 font-medium"
                              : x.decisao === "atualizar"
                                ? "text-sky-600 dark:text-sky-400 font-medium"
                                : "text-muted-foreground"
                          }
                        >
                          {x.decisao === "criar" ? "Criar" : x.decisao === "atualizar" ? "Atualizar" : "Ignorar"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground max-w-[260px]">
                      {x.motivo}
                      {x.alvoTitulo && x.decisao === "atualizar" && (
                        <div className="truncate">↳ {x.alvoTitulo}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setEtapa("mapeamento")} className="flex items-center gap-2 text-sm border rounded-md px-4 py-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              onClick={executar}
              disabled={contadores.pendente > 0}
              className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
            >
              Confirmar importação <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {etapa === "resultado" && resultado && (
        <div className="space-y-4">
          <ImportReport
            result={{
              inserted: resultado.criados + resultado.atualizados,
              failed: resultado.falhas,
              errors: (resultado.erros || []).map((e: any) => ({ row: e.i >= 0 ? e.i + 2 : 0, message: e.message })),
            }}
          />
          <div className="text-sm text-muted-foreground">
            {resultado.criados} criados · {resultado.atualizados} atualizados · {resultado.ignorados} ignorados
          </div>
          <button
            onClick={() => resetImportIa()}
            className="text-sm border rounded-md px-4 py-2"
          >
            Nova importação
          </button>
        </div>
      )}
    </div>
  );
}
