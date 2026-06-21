export interface VRSyncImovel {
  codigoInterno: string | null;
  tipoImovel: string | null;
  tipoTransacao: string | null;
  preco: number | null;
  valorCondominio: number | null;
  areaTotal: number | null;
  areaPrivativa: number | null;
  dormitorios: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  titulo: string;
  descricao: string | null;
  nomeCondominio: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  linkVideo: string | null;
  tour360: string | null;
  fotos: { url: string; capa: boolean }[];
}

export function parseVRSync(xmlText: string): VRSyncImovel[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("XML inválido: " + parseError.textContent);

  const imovelNodes = doc.querySelectorAll("Imovel");
  const results: VRSyncImovel[] = [];

  imovelNodes.forEach((node) => {
    const t = (tag: string) => node.querySelector(tag)?.textContent?.trim() || null;
    const n = (tag: string) => {
      const v = t(tag);
      return v ? parseFloat(v.replace(/\./g, "").replace(",", ".")) || null : null;
    };

    const tipoTransacao = t("TipoTransacao");
    const preco = tipoTransacao?.toLowerCase().includes("loca")
      ? n("PrecoLocacao")
      : n("PrecoVenda") ?? n("PrecoLocacao");

    const fotos: { url: string; capa: boolean }[] = [];
    node.querySelectorAll("Foto").forEach((f, i) => {
      const url = (f.querySelector("URLArquivo")?.textContent || f.textContent || "").trim();
      if (url && /^https?:\/\//i.test(url)) {
        fotos.push({ url, capa: i === 0 || f.getAttribute("Principal") === "1" });
      }
    });

    results.push({
      codigoInterno: t("CodigoImovel"),
      tipoImovel: t("TipoImovel"),
      tipoTransacao,
      preco,
      valorCondominio: n("PrecoCondominio"),
      areaTotal: n("AreaTotal"),
      areaPrivativa: n("AreaUtil") ?? n("AreaPrivativa"),
      dormitorios: n("Quartos") as number | null,
      suites: n("Suites") as number | null,
      banheiros: n("Banheiros") as number | null,
      vagas: n("Vagas") as number | null,
      titulo: t("Titulo") || t("TipoImovel") || "Imóvel importado",
      descricao: t("Descricao"),
      nomeCondominio: t("NomeCondominio") || t("NomeEdificio"),
      logradouro: t("Logradouro") || t("Endereco"),
      numero: t("Numero"),
      complemento: t("Complemento"),
      bairro: t("Bairro"),
      cidade: t("Cidade"),
      estado: t("UF") || t("Estado"),
      cep: t("CEP"),
      latitude: n("Latitude"),
      longitude: n("Longitude"),
      linkVideo: t("LinkVideo") || t("VideoURL"),
      tour360: t("TourVirtual") || t("Tour360"),
      fotos,
    });
  });

  return results;
}
