export type AppRole =
  | "super_admin"
  | "secretaria"
  | "imobiliaria"
  | "corretor_imobiliaria"
  | "corretor_autonomo"
  | "admin"
  | "manager"
  | "user";

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  secretaria: "Secretária",
  imobiliaria: "Imobiliária",
  corretor_imobiliaria: "Corretor da Imobiliária",
  corretor_autonomo: "Corretor Autônomo",
  admin: "Administrador",
  manager: "Gerente",
  user: "Usuário",
};

// Each route → list of roles allowed (empty = open to all authenticated)
export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  "/dashboard": [],
  "/oportunidades": [],
  "/imoveis": [], // visualização para todos autenticados
  "/favoritos": [], // Favoritos — todos autenticados
  "/notificacoes": [], // Notificações — todos autenticados
  "/registros": ["super_admin", "secretaria", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"],
  
  "/edificios": [],
  "/condominios": [],
  "/loteamentos": [],
  "/biblioteca": ["super_admin", "secretaria"],
  
  "/usuarios": ["super_admin"],
  "/clientes": ["super_admin", "secretaria"],
  "/relatorios": ["super_admin", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"],
  "/relatorios-admin": ["super_admin"],
  "/imoveis/exportacao": ["super_admin", "secretaria", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"],
  "/carteiras": ["super_admin", "secretaria", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"],
  "/portais": ["super_admin"],
  "/auditoria": ["super_admin"],
  "/seguranca": ["super_admin"],
  "/configuracoes": ["super_admin"],
  "/importacoes": ["super_admin", "secretaria"],
  "/tabela": ["super_admin", "secretaria"],
  "/perfil": [],
};

export const WRITE_IMOVEL_ROLES: AppRole[] = ["super_admin", "secretaria"];

export function canAccess(path: string, roles: AppRole[]): boolean {
  const allowed = ROUTE_ACCESS[path];
  if (!allowed || allowed.length === 0) return true;
  return roles.some((r) => allowed.includes(r));
}

export function canWriteImovel(roles: AppRole[]): boolean {
  return roles.some((r) => WRITE_IMOVEL_ROLES.includes(r));
}

export function primaryRole(roles: AppRole[]): AppRole {
  const priority: AppRole[] = [
    "super_admin", "imobiliaria", "secretaria",
    "corretor_imobiliaria", "corretor_autonomo",
    "admin", "manager", "user",
  ];
  for (const r of priority) if (roles.includes(r)) return r;
  return "corretor_autonomo";
}
