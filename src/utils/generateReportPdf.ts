import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/data/mockData";
import type { RealSaleRecord } from "@/hooks/useReportData";
import logoUrl from "@/assets/logo-mv.png";

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface RankRow { name: string; count: number; vgv: number }

interface ReportData {
  filtered: RealSaleRecord[];
  vgvYear: number;
  vgvMonth: number;
  vgvWeek: number;
  totalSalesYear: number;
  avgTicket: number;
  currentYear: number;
  rankings: {
    byType: RankRow[];
    bySegment: RankRow[];
    byCity: RankRow[];
    byBroker: RankRow[];
    byOwner: RankRow[];
    byNeighborhood: RankRow[];
    byEmpreendimento: RankRow[];
    byEdificio: RankRow[];
    byCondominio: RankRow[];
  };
  filters: {
    city: string; type: string; segment: string; seaView: string;
    period: string; month: number | null; year: number | null;
  };
}

export async function generateReportPdf(data: ReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  doc.setFillColor(20, 40, 80);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFillColor(30, 58, 120);
  doc.rect(0, 22, pageWidth, 6, "F");

  const logoData = await loadImageAsDataUrl(logoUrl);
  if (logoData) {
    try { doc.addImage(logoData, "PNG", margin, 5, 18, 18); } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Vendas", margin + 22, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("MV Broker", margin + 22, 19);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth - margin, 13, { align: "right" });
  y = 36;

  const fp: string[] = [];
  if (data.filters.city !== "Todas") fp.push(`Cidade: ${data.filters.city}`);
  if (data.filters.type !== "Todos") fp.push(`Tipo: ${data.filters.type}`);
  if (data.filters.segment !== "Todos") fp.push(`Segmento: ${data.filters.segment}`);
  if (data.filters.seaView !== "Todos") fp.push(`Vista mar: ${data.filters.seaView}`);
  if (data.filters.period !== "Todos") fp.push(`Período: ${data.filters.period}`);
  if (data.filters.year) fp.push(`Ano: ${data.filters.year}`);
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.text(fp.length ? `Filtros: ${fp.join(" | ")}` : "Sem filtros aplicados", margin, y);
  y += 6;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Indicadores", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y + 1,
    theme: "grid",
    head: [["Indicador", "Valor"]],
    body: [
      [`VGV ${data.currentYear}`, formatCurrency(data.vgvYear)],
      ["VGV do Mês", formatCurrency(data.vgvMonth)],
      ["VGV da Semana", formatCurrency(data.vgvWeek)],
      [`Vendas ${data.currentYear}`, String(data.totalSalesYear)],
      ["Ticket Médio", formatCurrency(data.avgTicket)],
    ],
    headStyles: { fillColor: [30, 58, 95], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  const drawRanking = (title: string, rows: RankRow[]) => {
    if (!rows.length) return;
    if (y > 250) { doc.addPage(); y = 16; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(title, margin, y);
    autoTable(doc, {
      startY: y + 2,
      theme: "striped",
      head: [["#", "Nome", "Vendas", "VGV"]],
      body: rows.slice(0, 10).map((r, i) => [String(i + 1), r.name, String(r.count), formatCurrency(r.vgv)]),
      headStyles: { fillColor: [30, 58, 95], fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 40, halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  drawRanking("Top Cidades", data.rankings.byCity);
  drawRanking("Top Segmentos", data.rankings.bySegment);
  drawRanking("Top Tipos de Imóvel", data.rankings.byType);
  drawRanking("Top Bairros", data.rankings.byNeighborhood);
  drawRanking("Top Corretores", data.rankings.byBroker);
  drawRanking("Top Proprietários", data.rankings.byOwner);
  drawRanking("Top Empreendimentos", data.rankings.byEmpreendimento);
  drawRanking("Top Edifícios", data.rankings.byEdificio);
  drawRanking("Top Condomínios", data.rankings.byCondominio);

  if (y > 240) { doc.addPage(); y = 16; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Detalhamento de Vendas (${data.filtered.length})`, margin, y);
  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    head: [["Data", "Imóvel", "Cidade", "Tipo", "Corretor", "Valor"]],
    body: data.filtered
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(s => [
        new Date(s.date).toLocaleDateString("pt-BR"),
        s.propertyTitle || "—",
        s.city || "—",
        s.type || "—",
        s.broker || "—",
        formatCurrency(s.price),
      ]),
    headStyles: { fillColor: [30, 58, 95], fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    margin: { left: margin, right: margin },
    columnStyles: { 5: { halign: "right" } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    doc.text("MV Broker — Relatório de Vendas", margin, doc.internal.pageSize.getHeight() - 6);
  }

  const filename = `relatorio-vendas-${new Date().toISOString().slice(0, 10)}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}
