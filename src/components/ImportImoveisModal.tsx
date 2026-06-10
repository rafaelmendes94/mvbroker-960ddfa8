import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client-any";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const COLUMN_MAP: Record<string, string> = {
  EMPREENDIMENTO: "empreendimento",
  TIPO: "tipo",
  "N° APTO QUADRA   LOTE": "unidade",
  "N° APTO QUADRA LOTE": "unidade",
  BOX: "box",
  DORMITORIOS: "quartos",
  "M²": "area",
  "ANO CONSTRUÇÃO": "ano_construcao",
  "FRENTE   FUNDOS LATERAL": "posicao_predio",
  "FRENTE FUNDOS LATERAL": "posicao_predio",
  "MOBILIADO DECORADO": "decorado",
  BAIRRO: "bairro",
  RUA: "endereco",
  VALOR: "preco",
  "CONDIÇÃO PAGAMENTO": "condicoes_pagamento",
  "CHAVES         OBRA": "local_chaves",
  "CHAVES OBRA": "local_chaves",
  "PROPRIETARIO NUMERO": "proprietario",
  "NUMERO PROPRIETARIO": "proprietario_telefone",
  "CIDADE DO PROPRIETARIO": "cidade",
};

const parseQuartos = (s: string) => {
  const m = String(s || "").match(/(\d+)\s*D/i);
  return m ? parseInt(m[1]) : 0;
};

const parseArea = (s: any) => {
  const n = parseFloat(String(s || "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const parsePreco = (s: any) => {
  const n = parseFloat(String(s || "").replace(/\./g, "").replace(",", "."));
  if (isNaN(n)) return 0;
  // Valores na planilha vêm em milhares (ex: 650 = R$ 650.000)
  return n < 10000 ? n * 1000 : n;
};

const normalizeTipo = (t: string) => {
  const v = String(t || "").trim().toUpperCase();
  if (v === "AP" || v.includes("APART")) return "Apartamento";
  if (v.includes("CASA")) return "Casa";
  if (v.includes("SOBRADO")) return "Sobrado";
  if (v.includes("LOTE") || v.includes("TERRENO")) return "Terreno";
  if (v.includes("COMERC")) return "Comercial";
  return v || "Apartamento";
};

const mapRow = (row: any, userId: string) => {
  const get = (col: string) => row[col] ?? "";
  const tipo = normalizeTipo(get("TIPO"));
  const emp = String(get("EMPREENDIMENTO") || "").trim();
  const unidade = String(get("N° APTO QUADRA   LOTE") || get("N° APTO QUADRA LOTE") || "").trim();
  const decoradoRaw = String(get("MOBILIADO DECORADO") || "").toUpperCase();
  const condPag = String(get("CONDIÇÃO PAGAMENTO") || "").trim();
  const ano = String(get("ANO CONSTRUÇÃO") || "").trim();

  return {
    user_id: userId,
    titulo: emp || `${tipo} ${unidade}`.trim() || "Imóvel importado",
    tipo,
    empreendimento: emp,
    unidade,
    box: String(get("BOX") || "").trim(),
    quartos: parseQuartos(get("DORMITORIOS")),
    banheiros: 0,
    area: parseArea(get("M²")),
    area_privativa: 0,
    vagas: 0,
    lavabo: 0,
    posicao_predio: String(get("FRENTE   FUNDOS LATERAL") || get("FRENTE FUNDOS LATERAL") || "").trim(),
    decorado: decoradoRaw.includes("DEC") || decoradoRaw.includes("MOB"),
    bairro: String(get("BAIRRO") || "").trim(),
    endereco: String(get("RUA") || "").trim() || "—",
    preco: parsePreco(get("VALOR")),
    condicoes_pagamento: condPag ? [condPag] : [],
    local_chaves: String(get("CHAVES         OBRA") || get("CHAVES OBRA") || "").trim(),
    proprietario: String(get("PROPRIETARIO NUMERO") || "").trim(),
    proprietario_telefone: String(get("NUMERO PROPRIETARIO") || "").trim(),
    cidade: String(get("CIDADE DO PROPRIETARIO") || "").trim() || "—",
    descricao: ano ? `Ano de construção: ${ano}` : "",
    status: "Disponível",
    ativo_site: false,
    vista_mar: false,
    aceita_permuta: false,
    destaque_home: false,
  };
};

export function ImportImoveisModal({ open, onClose, onImported }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doImport = async () => {
    setConfirmOpen(false);
    if (!user || rows.length === 0) return;
    setImporting(true);
    let ok = 0, fail = 0;
    const batch = rows.map(r => mapRow(r, user.id)).filter(r => r.titulo);
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50);
      const { error } = await supabase.from("imoveis").insert(chunk);
      if (error) { console.error("Import error:", error); fail += chunk.length; }
      else { ok += chunk.length; }
    }
    setResult({ ok, fail });
    setImporting(false);
    if (ok > 0) { toast.success(`${ok} imóveis importados`); onImported(); }
    if (fail > 0) toast.error(`${fail} falhas na importação`);
  };

  if (!open) return null;

  const handleFile = async (file: File) => {
    setResult(null);
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    setRows(json);
    toast.success(`${json.length} linhas detectadas`);
  };

  const handleImport = () => {
    if (!user || rows.length === 0) return;
    setConfirmOpen(true);
  };

  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-card-foreground">Importar Imóveis (Excel)</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
            <p className="font-semibold mb-1">Mapeamento esperado:</p>
            <p>EMPREENDIMENTO, TIPO, N° APTO QUADRA LOTE, BOX, DORMITORIOS, M², ANO CONSTRUÇÃO, FRENTE FUNDOS LATERAL, MOBILIADO DECORADO, BAIRRO, RUA, VALOR, CONDIÇÃO PAGAMENTO, CHAVES OBRA, PROPRIETARIO NUMERO, NUMERO PROPRIETARIO, CIDADE DO PROPRIETARIO</p>
            <p className="mt-2">⚠️ Valores são multiplicados por 1.000 quando menores que 10.000 (ex: 650 → R$ 650.000).</p>
          </div>

          <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-input rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {fileName || "Selecionar arquivo .xlsx"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          {rows.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground border-b border-border">
                Pré-visualização (primeiras 5 linhas de {rows.length})
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="text-xs w-full">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      {headers.map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0">
                          {h}
                          {COLUMN_MAP[h] && (
                            <span className="block text-[9px] text-primary">→ {COLUMN_MAP[h]}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {headers.map(h => (
                          <td key={h} className="px-2 py-1 whitespace-nowrap border-r border-border last:border-r-0 text-foreground">
                            {String(r[h] ?? "").slice(0, 30)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.fail === 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
              {result.fail === 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{result.ok} importados, {result.fail} falhas</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors">
            Fechar
          </button>
          <button
            onClick={handleImport}
            disabled={importing || rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-gold text-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar {rows.length > 0 && `(${rows.length})`}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-foreground/60 z-[60] flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border">
              <h3 className="text-base font-bold text-card-foreground">Confirmar importação</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Serão importadas <strong className="text-foreground">{rows.length}</strong> linhas. Confira o mapeamento de colunas antes de continuar.
              </p>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="text-xs w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-r border-border">Coluna da planilha</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-r border-border">Campo no sistema</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map(h => {
                      const mapped = COLUMN_MAP[h];
                      return (
                        <tr key={h} className="border-t border-border">
                          <td className="px-3 py-1.5 text-foreground border-r border-border">{h}</td>
                          <td className="px-3 py-1.5 border-r border-border">
                            {mapped ? <span className="text-primary font-medium">{mapped}</span> : <span className="text-muted-foreground italic">—</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            {mapped
                              ? <span className="text-emerald-600">✓ Importado</span>
                              : <span className="text-amber-600">⚠ Ignorado</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Colunas não mapeadas serão ignoradas. Valores menores que 10.000 em VALOR serão multiplicados por 1.000.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={doImport} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-gold text-primary text-sm font-semibold hover:opacity-90 transition-opacity">
                <CheckCircle2 className="w-4 h-4" /> Confirmar e importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
