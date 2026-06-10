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
  "/imoveis": [], // visualização para todos autenticados
  "/central": [], // Central de Imóveis — todos autenticados
  "/favoritos": [], // Favoritos — todos autenticados
  "/registros": ["super_admin", "secretaria", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"],
  "/imobiliarias": ["super_admin"],
  "/edificios": ["super_admin", "secretaria"],
  "/condominios": ["super_admin", "secretaria"],
  "/empreendimentos": ["super_admin", "secretaria"],
  "/biblioteca": ["super_admin", "secretaria"],
  "/corretores": ["super_admin", "imobiliaria"],
  "/usuarios": ["super_admin"],
  "/clientes": ["super_admin"],
  "/relatorios": ["super_admin", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"],
  "/exportacoes": ["super_admin", "secretaria", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"],
  "/carteiras": ["super_admin", "secretaria", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"],
  "/auditoria": ["super_admin"],
  "/configuracoes": ["super_admin"],
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
