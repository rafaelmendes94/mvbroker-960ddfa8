import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SystemOption = {
  id: string;
  categoria: string;
  nome: string;
  slug: string;
  ativo: boolean;
  ordem: number;
};

export const CATEGORIAS = [
  { key: "tipo_imovel", label: "Tipo de Imóvel" },
  { key: "status_imovel", label: "Status do Imóvel" },
  { key: "posicao_solar", label: "Posição Solar" },
  { key: "vista", label: "Vista" },
  { key: "posicao_predio", label: "Posição no Prédio" },
  { key: "infraestrutura", label: "Infraestrutura" },
  { key: "destaque_categoria", label: "Destaque Categoria" },
  { key: "condicoes_pagamento", label: "Condições de Pagamento" },
  { key: "tipo_proprietario", label: "Tipo Proprietário" },
  { key: "padrao_imovel", label: "Padrão Imóvel" },
  { key: "condicao_imovel", label: "Condição do Imóvel" },
] as const;

export type CategoriaKey = (typeof CATEGORIAS)[number]["key"];

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function useSystemOptions(categoria?: CategoriaKey | string) {
  const [options, setOptions] = useState<SystemOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("system_options").select("*").order("categoria").order("ordem");
    if (categoria) q = q.eq("categoria", categoria);
    const { data } = await q;
    setOptions((data ?? []) as SystemOption[]);
    setLoading(false);
  }, [categoria]);

  useEffect(() => { load(); }, [load]);

  /** Apenas opções ativas — uso em formulários */
  const active = options.filter((o) => o.ativo);

  /** Agrupado por categoria */
  const byCategory = options.reduce<Record<string, SystemOption[]>>((acc, o) => {
    (acc[o.categoria] ??= []).push(o);
    return acc;
  }, {});

  /** Adiciona uma nova opção no catálogo global (persistente). */
  const addOption = useCallback(
    async (nome: string, cat?: CategoriaKey | string): Promise<SystemOption | null> => {
      const targetCat = cat || categoria;
      if (!targetCat) return null;
      const trimmed = nome.trim();
      if (!trimmed) return null;
      // Evita duplicata case-insensitive
      const existing = options.find(
        (o) => o.categoria === targetCat && o.nome.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        if (!existing.ativo) {
          await supabase.from("system_options").update({ ativo: true }).eq("id", existing.id);
          await load();
        }
        return existing;
      }
      const maxOrd = options
        .filter((o) => o.categoria === targetCat)
        .reduce((m, o) => Math.max(m, o.ordem || 0), 0);
      const { data, error } = await supabase
        .from("system_options")
        .insert({
          categoria: targetCat,
          nome: trimmed,
          slug: slugify(trimmed),
          ativo: true,
          ordem: maxOrd + 1,
        })
        .select()
        .single();
      if (error || !data) return null;
      await load();
      return data as SystemOption;
    },
    [categoria, options, load],
  );

  return { options, active, byCategory, loading, reload: load, addOption };
}
