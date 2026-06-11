// Lista de módulos do sistema usada em /usuarios para configurar permissões granulares.
export type ModuloKey =
  | "dashboard" | "imoveis" | "oportunidades" | "edificios" | "condominios"
  | "loteamentos" | "biblioteca" | "favoritos" | "notificacoes" | "registros"
  | "clientes" | "carteiras" | "relatorios" | "exportacao" | "importacoes"
  | "portais" | "planos" | "assinaturas" | "pagamentos" | "auditoria"
  | "seguranca" | "configuracoes" | "usuarios";

export const MODULOS: { key: ModuloKey; label: string; grupo: string }[] = [
  { key: "dashboard", label: "Dashboard", grupo: "Geral" },
  { key: "oportunidades", label: "Oportunidades", grupo: "Geral" },
  { key: "notificacoes", label: "Notificações", grupo: "Geral" },
  { key: "favoritos", label: "Favoritos", grupo: "Geral" },

  { key: "imoveis", label: "Imóveis", grupo: "Imóveis" },
  { key: "edificios", label: "Edifícios", grupo: "Imóveis" },
  { key: "condominios", label: "Condomínios", grupo: "Imóveis" },
  { key: "loteamentos", label: "Loteamentos", grupo: "Imóveis" },
  { key: "registros", label: "Registros", grupo: "Imóveis" },
  { key: "exportacao", label: "Exportação", grupo: "Imóveis" },

  { key: "carteiras", label: "Carteiras", grupo: "Comercial" },
  { key: "clientes", label: "Clientes", grupo: "Comercial" },
  { key: "portais", label: "Portais", grupo: "Comercial" },

  { key: "relatorios", label: "Relatórios", grupo: "Análises" },
  { key: "biblioteca", label: "Biblioteca", grupo: "Análises" },
  { key: "importacoes", label: "Importações", grupo: "Análises" },

  { key: "planos", label: "Planos", grupo: "Administração" },
  { key: "assinaturas", label: "Assinaturas", grupo: "Administração" },
  { key: "pagamentos", label: "Pagamentos", grupo: "Administração" },
  { key: "auditoria", label: "Auditoria", grupo: "Administração" },
  { key: "seguranca", label: "Segurança", grupo: "Administração" },
  { key: "configuracoes", label: "Configurações", grupo: "Administração" },
  { key: "usuarios", label: "Usuários", grupo: "Administração" },
];
