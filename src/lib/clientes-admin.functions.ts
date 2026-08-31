import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  _token: z.string().min(1),
  tipo: z.enum(["imobiliaria", "corretor"]),
  modo: z.enum(["senha", "convite"]),
  nome: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().max(40).optional().nullable(),
  cnpj: z.string().trim().max(40).optional().nullable(),
  razao_social: z.string().trim().max(200).optional().nullable(),
  creci: z.string().trim().max(60).optional().nullable(),
  plano_id: z.string().uuid(),
  ciclo: z.enum(["mensal", "anual"]),
  redirectTo: z.string().url().optional(),
});

function gerarSenha(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i]! % chars.length]!;
  return out;
}

/**
 * Cria o cliente completo (acesso + registro + assinatura) numa única
 * operação no servidor, com rollback manual se qualquer etapa falhar.
 */
export const criarClienteCompleto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { createNodeSafeSupabaseClient, getNodeSafeSupabaseAdmin } = await import(
      "@/lib/supabase-node-safe"
    );

    const supabase = await createNodeSafeSupabaseClient(
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      data._token,
    );

    // ── Autentica o chamador ────────────────────────────────────────────
    let callerId: string | undefined;
    try {
      const { data: claimsData, error } = await supabase.auth.getClaims(data._token);
      if (!error && claimsData?.claims?.sub) callerId = claimsData.claims.sub as string;
    } catch {
      /* fallback abaixo */
    }
    if (!callerId) {
      const { data: u, error } = await supabase.auth.getUser(data._token);
      if (error || !u?.user?.id) throw new Error("Unauthorized: token inválido");
      callerId = u.user.id;
    }

    const [{ data: isAdmin }, { data: isSec }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: callerId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: callerId, _role: "secretaria" }),
    ]);
    if (!isAdmin && !isSec) throw new Error("Sem permissão para cadastrar clientes.");

    const admin = await getNodeSafeSupabaseAdmin();

    // ── Plano (valor calculado no servidor) ─────────────────────────────
    const { data: plano, error: planoErr } = await admin
      .from("planos")
      .select("id, nome, tipo, preco_mensal, preco_anual, ativo")
      .eq("id", data.plano_id)
      .maybeSingle();
    if (planoErr) throw new Error(planoErr.message);
    if (!plano) throw new Error("Plano não encontrado.");
    if (plano.ativo === false) throw new Error("Plano inativo.");
    const esperado = data.tipo === "imobiliaria" ? "imobiliaria" : "individual";
    if (plano.tipo !== esperado) {
      throw new Error(`Plano incompatível: selecione um plano do tipo "${esperado}".`);
    }
    const valor =
      data.ciclo === "anual"
        ? Number(plano.preco_anual ?? Number(plano.preco_mensal) * 12)
        : Number(plano.preco_mensal);

    // ── Usuário de acesso ───────────────────────────────────────────────
    const email = data.email.toLowerCase();
    const found = await findUserByEmail(admin, email);

    let userId: string;
    let senha: string | undefined;
    let jaExistia = false;
    let criouUsuario = false;

    if (found) {
      userId = found;
      jaExistia = true;
    } else if (data.modo === "senha") {
      senha = gerarSenha(12);
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { full_name: data.nome },
      });
      if (error || !created?.user) throw new Error(error?.message ?? "Falha ao criar usuário");
      userId = created.user.id;
      criouUsuario = true;
    } else {
      const { data: inv, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: data.redirectTo,
        data: { full_name: data.nome },
      });
      if (error || !inv?.user) throw new Error(error?.message ?? "Falha ao enviar convite");
      userId = inv.user.id;
      criouUsuario = true;
    }

    const role = data.tipo === "imobiliaria" ? "imobiliaria" : "corretor_autonomo";
    let clienteId: string | null = null;
    let assinaturaId: string | null = null;

    const rollback = async () => {
      if (assinaturaId) await admin.from("assinaturas").delete().eq("id", assinaturaId);
      if (clienteId) {
        await admin
          .from(data.tipo === "imobiliaria" ? "imobiliarias" : "corretores")
          .delete()
          .eq("id", clienteId);
      }
      if (criouUsuario) {
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch {
          /* ignora */
        }
      }
    };

    try {
      // papéis: garante o correto e remove o padrão indevido
      await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (role === "imobiliaria") {
        await admin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "corretor_autonomo");
      }

      if (data.tipo === "imobiliaria") {
        const { data: imob, error } = await admin
          .from("imobiliarias")
          .insert({
            nome_fantasia: data.nome,
            razao_social: data.razao_social || null,
            cnpj: data.cnpj || null,
            email,
            telefone: data.telefone || null,
            owner_id: userId,
          })
          .select("id")
          .single();
        if (error || !imob) throw new Error(error?.message ?? "Falha ao criar imobiliária");
        clienteId = imob.id;

        const { data: ass, error: e2 } = await admin
          .from("assinaturas")
          .insert({
            plano_id: plano.id,
            imobiliaria_id: imob.id,
            ciclo: data.ciclo,
            valor,
            status: "ativa",
          })
          .select("id")
          .single();
        if (e2 || !ass) throw new Error(e2?.message ?? "Falha ao criar assinatura");
        assinaturaId = ass.id;
      } else {
        const { data: corr, error } = await admin
          .from("corretores")
          .insert({
            nome: data.nome,
            email,
            telefone: data.telefone || null,
            creci: data.creci || null,
            status: "ativo",
            imobiliaria_id: null,
            user_id: userId,
          })
          .select("id")
          .single();
        if (error || !corr) throw new Error(error?.message ?? "Falha ao criar corretor");
        clienteId = corr.id;

        const { data: ass, error: e2 } = await admin
          .from("assinaturas")
          .insert({
            plano_id: plano.id,
            usuario_id: userId,
            ciclo: data.ciclo,
            valor,
            status: "ativa",
          })
          .select("id")
          .single();
        if (e2 || !ass) throw new Error(e2?.message ?? "Falha ao criar assinatura");
        assinaturaId = ass.id;
      }

      // Confirma que o vínculo é legível pelo mesmo caminho usado no login
      const { data: check } = await admin
        .from("assinaturas")
        .select("id")
        .eq("id", assinaturaId)
        .maybeSingle();
      if (!check) throw new Error("Assinatura não confirmada após gravação.");

      return { user_id: userId, cliente_id: clienteId, assinatura_id: assinaturaId, senha, jaExistia };
    } catch (err) {
      await rollback();
      throw err instanceof Error ? err : new Error("Erro ao cadastrar cliente");
    }
  });

/** Repara clientes já existentes sem assinatura vinculada. */
export const vincularPlanoCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        _token: z.string().min(1),
        tipo: z.enum(["imobiliaria", "corretor"]),
        cliente_id: z.string().uuid(),
        plano_id: z.string().uuid(),
        ciclo: z.enum(["mensal", "anual"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createNodeSafeSupabaseClient, getNodeSafeSupabaseAdmin } = await import(
      "@/lib/supabase-node-safe"
    );
    const supabase = await createNodeSafeSupabaseClient(
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      data._token,
    );
    const { data: u, error: uErr } = await supabase.auth.getUser(data._token);
    if (uErr || !u?.user?.id) throw new Error("Unauthorized: token inválido");
    const [{ data: isAdmin }, { data: isSec }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: u.user.id, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: u.user.id, _role: "secretaria" }),
    ]);
    if (!isAdmin && !isSec) throw new Error("Sem permissão.");

    const admin = await getNodeSafeSupabaseAdmin();
    const { data: plano } = await admin
      .from("planos")
      .select("id, tipo, preco_mensal, preco_anual")
      .eq("id", data.plano_id)
      .maybeSingle();
    if (!plano) throw new Error("Plano não encontrado.");
    const tipoEsperado = data.tipo === "imobiliaria" ? "imobiliaria" : "individual";
    if (plano.tipo !== tipoEsperado) {
      throw new Error(`Plano incompatível: selecione um plano do tipo "${tipoEsperado}".`);
    }
    const valor =
      data.ciclo === "anual"
        ? Number(plano.preco_anual ?? Number(plano.preco_mensal) * 12)
        : Number(plano.preco_mensal);

    let usuarioId: string | null = null;
    if (data.tipo === "corretor") {
      const { data: c } = await admin
        .from("corretores")
        .select("user_id")
        .eq("id", data.cliente_id)
        .maybeSingle();
      usuarioId = c?.user_id ?? null;
      if (!usuarioId) throw new Error("Este corretor ainda não tem login vinculado.");
    }

    const filtro =
      data.tipo === "imobiliaria"
        ? { imobiliaria_id: data.cliente_id }
        : { usuario_id: usuarioId! };

    const { data: existente } = await admin
      .from("assinaturas")
      .select("id")
      .match(filtro)
      .maybeSingle();

    if (existente) {
      const { error } = await admin
        .from("assinaturas")
        .update({ plano_id: plano.id, ciclo: data.ciclo, valor, status: "ativa" })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
      return { assinatura_id: existente.id, criada: false };
    }

    const { data: ass, error } = await admin
      .from("assinaturas")
      .insert({ ...filtro, plano_id: plano.id, ciclo: data.ciclo, valor, status: "ativa" })
      .select("id")
      .single();
    if (error || !ass) throw new Error(error?.message ?? "Falha ao vincular plano");
    return { assinatura_id: ass.id, criada: true };
  });

async function findUserByEmail(
  admin: Awaited<ReturnType<typeof import("@/lib/supabase-node-safe")["getNodeSafeSupabaseAdmin"]>>,
  email: string,
): Promise<string | null> {
  const alvo = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const hit = users.find((x) => (x.email ?? "").toLowerCase() === alvo);
    if (hit) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}
