import { Property } from "@/data/mockData";

async function imageToBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function generatePropertyPdf(property: Property) {
  const html2pdf = (await import("html2pdf.js")).default;

  // Collect all images (main + gallery), de-duped
  const allUrls = Array.from(new Set([property.image, ...(property.images || [])].filter(Boolean) as string[]));
  const imagesB64 = (await Promise.all(allUrls.map((u) => imageToBase64(u)))).filter(Boolean) as string[];

  const html = `
<div style="font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;">
  <h1 style="font-size:22px;font-weight:800;margin:0 0 4px;color:#1e3a5f;text-align:center;">${escHtml(property.title)}</h1>
  ${property.code ? `<p style="text-align:center;font-size:11px;color:#6b7280;margin:0 0 16px;">Código: ${escHtml(property.code)}</p>` : `<div style="margin-bottom:16px;"></div>`}
  ${imagesB64.length === 0
    ? `<p style="text-align:center;color:#9ca3af;font-size:12px;">Sem fotos cadastradas.</p>`
    : imagesB64.map((b64) => `<div style="page-break-inside:avoid;margin-bottom:12px;text-align:center;"><img src="${b64}" style="max-width:100%;max-height:240mm;object-fit:contain;border-radius:6px;" /></div>`).join("")}
</div>`;

  const container = document.createElement("div");
  container.style.width = "210mm";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await (html2pdf() as any)
      .set({
        margin: [10, 10, 10, 10],
        filename: `${property.code || property.id}_${property.title.replace(/\s+/g, "_")}_fotos.pdf`,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
