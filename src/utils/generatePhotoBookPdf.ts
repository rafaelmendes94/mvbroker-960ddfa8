import { toast } from "sonner";

type BookImovel = {
  id: string;
  titulo?: string | null;
  codigo_interno?: string | null;
  tipo_imovel?: string | null;
  status_imovel?: string | null;
  preco?: number | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  dormitorios?: number | null;
  suites?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  area_privativa?: number | string | null;
  area_total?: number | string | null;
  descricao?: string | null;
  infraestrutura?: string[] | null;
  outras_caracteristicas?: string[] | null;
};

function brl(n?: number | null) {
  if (n == null) return "Sob consulta";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `R$ ${n}`;
  }
}

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 4, h: 3 });
      img.src = data;
    });
    return { data, ...dims };
  } catch {
    return null;
  }
}

export async function generatePhotoBookPdf(imovel: BookImovel, images: string[]) {
  const tid = toast.loading("Gerando book de fotos…");
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const W = 297;
    const H = 210;
    const M = 12;

    const titulo = imovel.titulo || "Imóvel";
    const codigo = imovel.codigo_interno || imovel.id.slice(0, 8).toUpperCase();
    const endereco = [imovel.logradouro, imovel.numero, imovel.bairro, imovel.cidade, imovel.estado]
      .filter(Boolean)
      .join(", ");

    const loaded = (await Promise.all(images.slice(0, 40).map(loadImage))).filter(Boolean) as {
      data: string;
      w: number;
      h: number;
    }[];

    // ---------- Capa ----------
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, W, H, "F");
    if (loaded[0]) {
      const ratio = loaded[0].w / loaded[0].h;
      const cw = W;
      const ch = cw / ratio;
      doc.addImage(loaded[0].data, "JPEG", 0, Math.max(0, (H - ch) / 2), cw, ch, undefined, "FAST");
      doc.setFillColor(15, 23, 42);
      doc.setGState(new (doc as any).GState({ opacity: 0.55 }));
      doc.rect(0, 0, W, H, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(doc.splitTextToSize(titulo, W - M * 2), M, H / 2 - 8);
    doc.setFontSize(18);
    doc.setFont("helvetica", "normal");
    doc.text(brl(imovel.preco), M, H / 2 + 8);
    doc.setFontSize(11);
    if (endereco) doc.text(doc.splitTextToSize(endereco, W - M * 2), M, H / 2 + 18);
    doc.setFontSize(9);
    doc.text(`Código: ${codigo}`, M, H - M);

    // ---------- Ficha ----------
    doc.addPage();
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Informações do imóvel", M, M + 6);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const rows: [string, string][] = [
      ["Código", String(codigo)],
      ["Tipo", String(imovel.tipo_imovel || "—")],
      ["Status", String(imovel.status_imovel || "—")],
      ["Valor", brl(imovel.preco)],
      ["Endereço", endereco || "—"],
      ["Dormitórios", imovel.dormitorios != null ? String(imovel.dormitorios) : "—"],
      ["Suítes", imovel.suites != null ? String(imovel.suites) : "—"],
      ["Banheiros", imovel.banheiros != null ? String(imovel.banheiros) : "—"],
      ["Vagas", imovel.vagas != null ? String(imovel.vagas) : "—"],
      ["Área privativa", imovel.area_privativa ? `${imovel.area_privativa} m²` : "—"],
      ["Área total", imovel.area_total ? `${imovel.area_total} m²` : "—"],
    ];
    let y = M + 16;
    rows.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${k}:`, M, y);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(v, W / 2 - M * 2), M + 32, y);
      y += 7;
    });

    let ry = M + 16;
    const rx = W / 2 + 4;
    if (imovel.descricao) {
      doc.setFont("helvetica", "bold");
      doc.text("Descrição", rx, ry);
      ry += 6;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(String(imovel.descricao), W / 2 - M - 4).slice(0, 22);
      doc.text(lines, rx, ry);
      ry += lines.length * 5 + 4;
    }
    const feats = [
      ...(Array.isArray(imovel.infraestrutura) ? imovel.infraestrutura : []),
      ...(Array.isArray(imovel.outras_caracteristicas) ? imovel.outras_caracteristicas : []),
    ];
    if (feats.length && ry < H - 30) {
      doc.setFont("helvetica", "bold");
      doc.text("Características", rx, ry);
      ry += 6;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(feats.join(" • "), W / 2 - M - 4).slice(0, 10);
      doc.text(lines, rx, ry);
    }

    // ---------- Fotos ----------
    loaded.forEach((img, i) => {
      doc.addPage();
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(titulo, M, 10);
      doc.text(`Foto ${i + 1} de ${loaded.length}`, W - M, 10, { align: "right" });

      const boxW = W - M * 2;
      const boxH = H - 34;
      const ratio = img.w / img.h;
      let w = boxW;
      let h = w / ratio;
      if (h > boxH) {
        h = boxH;
        w = h * ratio;
      }
      doc.addImage(img.data, "JPEG", (W - w) / 2, 16 + (boxH - h) / 2, w, h, undefined, "FAST");
    });

    // ---------- Rodapé/numeração ----------
    const total = doc.getNumberOfPages();
    for (let p = 2; p <= total; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`MV Broker • ${codigo}`, M, H - 6);
      doc.text(`${p} / ${total}`, W - M, H - 6, { align: "right" });
    }

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${codigo}_${titulo.replace(/\s+/g, "_")}_book.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    toast.success("Book de fotos gerado", { id: tid });
  } catch (e: any) {
    toast.error(e?.message || "Não foi possível gerar o book", { id: tid });
  }
}
