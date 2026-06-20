import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RealSaleRecord {
  id: string;
  propertyTitle: string;
  city: string;
  neighborhood: string;
  owner: string;
  type: string;
  segment: string;
  broker: string;
  price: number;
  date: string;
  empreendimento: string;
  edificio: string;
  condominio: string;
  bedrooms: number;
  seaView: boolean;
  isManual?: boolean;
  commission?: number;
  client?: string;
  platform?: string;
}

const SELECT_IMOVEL =
  "id, titulo, cidade, bairro, tipo_imovel, padrao, preco, corretor_id, responsavel_nome, dormitorios, vista_mar, updated_at, created_at, data_venda, plataforma_venda, status_imovel, edificio_id, condominio_id, empreendimento_id, edificios:edificio_id(nome), condominios:condominio_id(nome), empreendimentos:empreendimento_id(nome), corretores:corretor_id(nome)";

function mapImovel(row: any): RealSaleRecord {
  return {
    id: row.id,
    propertyTitle: row.titulo || "Sem título",
    city: row.cidade || "Sem cidade",
    neighborhood: row.bairro || "Sem bairro",
    owner: row.responsavel_nome || "Sem proprietário",
    type: row.tipo_imovel || "Outros",
    segment: row.padrao || "Médio Padrão",
    broker: row.corretores?.nome || "Sem corretor",
    price: Number(row.preco) || 0,
    date: row.data_venda || row.updated_at || row.created_at || new Date().toISOString(),
    empreendimento: row.empreendimentos?.nome || "",
    edificio: row.edificios?.nome || "",
    condominio: row.condominios?.nome || "",
    bedrooms: row.dormitorios || 0,
    seaView: row.vista_mar || false,
    isManual: false,
    platform: row.plataforma_venda || "",
  };
}

export function useReportData() {
  const [sales, setSales] = useState<RealSaleRecord[]>([]);
  const [manualSales, setManualSales] = useState<RealSaleRecord[]>([]);
  const [allImoveis, setAllImoveis] = useState<RealSaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [vendidosRes, todosRes, mvRes] = await Promise.all([
      supabase
        .from("imoveis")
        .select(SELECT_IMOVEL)
        .ilike("status_imovel", "%vendid%")
        .order("data_venda", { ascending: false, nullsFirst: false })
        .limit(5000),
      supabase
        .from("imoveis")
        .select(SELECT_IMOVEL)
        .or("arquivado.is.null,arquivado.eq.false")
        .limit(5000),
      (supabase as any)
        .from("agenciamentos")
        .select("*")
        .eq("status", "vendido")
        .order("data_atualizacao", { ascending: false })
        .limit(5000),
    ]);

    const real = (vendidosRes.data || []).map(mapImovel);
    const todos = (todosRes.data || []).map(mapImovel);

    const manual: RealSaleRecord[] = (mvRes.data || []).map((row: any) => ({
      id: row.id,
      propertyTitle: row.imovel || "Agenciamento",
      city: row.cidade || "Sem cidade",
      neighborhood: row.bairro || "Sem bairro",
      owner: row.proprietario || "—",
      type: row.tipo || "Outros",
      segment: row.padrao || "Médio Padrão",
      broker: "—",
      price: Number(row.valor) || 0,
      date: row.data_atualizacao || row.data_inclusao
        ? new Date(row.data_atualizacao || row.data_inclusao).toISOString()
        : new Date().toISOString(),
      empreendimento: row.imovel || "",
      edificio: row.imovel || "",
      condominio: "",
      bedrooms: parseInt(String(row.dormitorios || "0"), 10) || 0,
      seaView: false,
      isManual: true,
      commission: 0,
      client: "",
    }));

    setSales(real);
    setManualSales(manual);
    setAllImoveis(todos);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allSales = useMemo(() => [...sales, ...manualSales], [sales, manualSales]);

  const monthlyData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months.map((month, i) => {
      const monthSales = allSales.filter((s) => new Date(s.date).getMonth() === i);
      return {
        month,
        vendas: monthSales.length,
        receita: monthSales.reduce((sum, s) => sum + s.price, 0),
      };
    });
  }, [allSales]);

  // Opções de filtros: TODOS os imóveis cadastrados + agenciamentos + vendas,
  // para que os filtros funcionem mesmo antes de existir uma venda.
  const universe = useMemo(
    () => [...allImoveis, ...manualSales],
    [allImoveis, manualSales],
  );

  const allCities = useMemo(
    () => [...new Set(universe.map((s) => s.city).filter(Boolean))].sort(),
    [universe],
  );
  const allTypes = useMemo(
    () => [...new Set(universe.map((s) => s.type).filter(Boolean))].sort(),
    [universe],
  );
  const allSegments = useMemo(
    () => [...new Set(universe.map((s) => s.segment).filter(Boolean))].sort(),
    [universe],
  );
  const allYears = useMemo(() => {
    const years = new Set<number>(
      universe.map((s) => new Date(s.date).getFullYear()).filter((y) => !isNaN(y)),
    );
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [universe]);

  return {
    sales: allSales,
    realSales: sales,
    manualSales,
    allImoveis,
    monthlyData,
    allCities,
    allTypes,
    allSegments,
    allYears,
    loading,
    refetch: fetchAll,
  };
}
