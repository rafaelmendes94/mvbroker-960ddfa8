import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  email: z.string().trim().email().max(255),
  modo: z.enum(["senha", "convite"]),
  nome: z.string().trim().min(1).max(200).optional(),
  tipo: z.enum(["imobiliaria", "corretor"]),
  redirectTo: z.string().url().optional(),
});

function gerarSenha(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export const criarAcessoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    // Autoriza: somente super_admin ou secretaria
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    const { data: isSec } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "secretaria",
    });
    if (!isAdmin && !isSec) {
      throw new Error("Sem permissão para criar acessos de cliente.");
    }

    const { getNodeSafeSupabaseAdmin } = await import("@/lib/supabase-node-safe");
    const supabaseAdmin = await getNodeSafeSupabaseAdmin();
    const role = data.tipo === "imobiliaria" ? "imobiliaria" : "corretor_autonomo";

    // Procura por email já existente
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existing?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );

    let userId: string;
    let senha: string | undefined;
    let jaExistia = false;

    if (found) {
      userId = found.id;
      jaExistia = true;
    } else if (data.modo === "senha") {
      senha = gerarSenha(12);
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: senha,
        email_confirm: true,
        user_metadata: { full_name: data.nome ?? data.email },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
      userId = created.user.id;
    } else {
      const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: data.redirectTo,
        data: { full_name: data.nome ?? data.email },
      });
      if (error || !inv.user) throw new Error(error?.message ?? "Falha ao enviar convite");
      userId = inv.user.id;
    }

    // Garante role apropriada (idempotente via unique(user_id, role))
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

    return { user_id: userId, senha, jaExistia };
  });
