import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { ImportField } from "./import-schemas";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, any>[];
};

export async function parseFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
  const headers = rows.length
    ? Object.keys(rows[0])
    : (XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] as string[]) || [];
  return { headers, rows };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function autoMatch(fields: ImportField[], headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const hNorm = headers.map((h) => ({ raw: h, n: normalize(h) }));
  for (const f of fields) {
    const candidates = [normalize(f.key), normalize(f.label.split("(")[0])];
    const found = hNorm.find((h) => candidates.includes(h.n));
    if (found) map[f.key] = found.raw;
  }
  return map;
}

function parseBool(v: any): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["sim", "s", "true", "1", "yes", "y", "x"].includes(s)) return true;
  if (["nao", "não", "n", "false", "0", "no"].includes(s)) return false;
  return null;
}

function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function parseArray(v: any): string[] {
  if (v === null || v === undefined || v === "") return [];
  if (Array.isArray(v)) return v.map(String);
  return String(v)
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function coerceValue(field: ImportField, raw: any): any {
  if (raw === null || raw === undefined || raw === "") {
    return field.type === "array" ? [] : null;
  }
  switch (field.type) {
    case "boolean": return parseBool(raw);
    case "date": return parseDate(raw);
    case "number": return parseNumber(raw);
    case "integer": {
      const n = parseNumber(raw);
      return n === null ? null : Math.trunc(n);
    }
    case "array": return parseArray(raw);
    default: return String(raw).trim();
  }
}

export type ImportError = { row: number; field?: string; message: string };
export type ImportResult = { inserted: number; failed: number; errors: ImportError[] };

async function resolveFK(field: ImportField, value: string): Promise<string | null> {
  if (!field.fkLookup || !value) return null;
  const v = String(value).trim();
  for (const col of field.fkLookup.matchColumns) {
    const { data } = await (supabase as any)
      .from(field.fkLookup.table)
      .select("id")
      .ilike(col, v)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

export async function buildRows(
  fields: ImportField[],
  mapping: Record<string, string>,
  rows: Record<string, any>[],
): Promise<{ records: any[]; errors: ImportError[] }> {
  const records: any[] = [];
  const errors: ImportError[] = [];
  // cache FK lookups
  const fkCache = new Map<string, string | null>();

  for (let i = 0; i < rows.length; i++) {
    const src = rows[i];
    const rec: Record<string, any> = {};
    let rowOk = true;
    for (const f of fields) {
      const header = mapping[f.key];
      if (!header) continue;
      const raw = src[header];
      const coerced = coerceValue(f, raw);

      if (f.fkLookup) {
        if (!coerced) continue;
        const cacheKey = `${f.fkLookup.table}::${String(coerced).toLowerCase()}`;
        let id: string | null;
        if (fkCache.has(cacheKey)) {
          id = fkCache.get(cacheKey)!;
        } else {
          id = await resolveFK(f, String(coerced));
          fkCache.set(cacheKey, id);
        }
        if (!id) {
          errors.push({ row: i + 2, field: f.label, message: `Não encontrado em ${f.fkLookup.table}: "${coerced}"` });
          rowOk = false;
          continue;
        }
        rec[f.fkLookup.targetColumn || f.key] = id;
      } else {
        if (f.required && (coerced === null || coerced === "" || (Array.isArray(coerced) && coerced.length === 0))) {
          errors.push({ row: i + 2, field: f.label, message: "Campo obrigatório vazio" });
          rowOk = false;
          continue;
        }
        if (coerced !== null) rec[f.key] = coerced;
      }
    }

    // checa obrigatórios não mapeados
    for (const f of fields.filter((x) => x.required)) {
      if (!mapping[f.key]) {
        errors.push({ row: i + 2, field: f.label, message: "Coluna obrigatória não mapeada" });
        rowOk = false;
      }
    }

    if (rowOk && Object.keys(rec).length > 0) records.push(rec);
  }
  return { records, errors };
}

export async function importBatch(
  table: string,
  records: any[],
  batchSize = 50,
): Promise<ImportResult> {
  let inserted = 0;
  let failed = 0;
  const errors: ImportError[] = [];
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error, data } = await supabase.from(table as any).insert(batch).select("id");
    if (error) {
      // tenta um por um para isolar
      for (let j = 0; j < batch.length; j++) {
        const { error: e1 } = await supabase.from(table as any).insert(batch[j]).select("id").maybeSingle();
        if (e1) {
          failed++;
          errors.push({ row: i + j + 2, message: e1.message });
        } else {
          inserted++;
        }
      }
    } else {
      inserted += data?.length || batch.length;
    }
  }
  return { inserted, failed, errors };
}

export function downloadTemplate(filename: string, fields: ImportField[], format: "csv" | "xlsx") {
  const headers = fields.map((f) => f.label);
  const example: Record<string, any> = {};
  for (const f of fields) {
    let v: any = "";
    if (f.type === "boolean") v = "sim";
    else if (f.type === "number" || f.type === "integer") v = 0;
    else if (f.type === "date") v = "01/01/2026";
    else if (f.type === "array") v = "valor1;valor2";
    else v = "";
    example[f.label] = v;
  }
  const ws = XLSX.utils.json_to_sheet([example], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, `${filename}.${format}`, { bookType: format });
}
