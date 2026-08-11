// Envio do e-mail "conta aprovada" via API HTTP do Resend. Server-only.
// Nunca lança erro: retorna false se não conseguir enviar, para não bloquear a aprovação.

type Args = {
  solicitacaoId: string;
  email: string;
  nome: string;
  plano: string;
};

const LOGIN_URL = "https://app.sistemamvbroker.com.br/auth";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(nome: string, plano: string) {
  const n = escapeHtml(nome);
  const p = escapeHtml(plano);
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:22px;margin:0 0 16px;">Sua conta foi aprovada 🎉</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Olá, ${n}!</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
        Seu cadastro no <strong>MV Broker</strong> foi aprovado e seu acesso já está liberado.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        Plano vinculado: <strong>${p}</strong>
      </p>
      <p style="margin:0 0 28px;">
        <a href="${LOGIN_URL}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;">
          Acessar o sistema
        </a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0;">
        Se o botão não funcionar, acesse: <a href="${LOGIN_URL}" style="color:#0f172a;">${LOGIN_URL}</a>
      </p>
    </div>
  </body>
</html>`;
}

export async function enviarEmailContaAprovada(args: Args): Promise<boolean> {
  try {
    const { getSupabaseAdmin } = await import("./solicitacoes.server");
    const admin = await getSupabaseAdmin();

    const { data: rows, error } = await admin
      .from("integration_settings")
      .select("key, value")
      .in("key", ["resend_api_key", "resend_from_email", "resend_from_name"]);
    if (error) {
      console.error("[email] falha ao ler integration_settings:", error.message);
      return false;
    }

    const cfg: Record<string, string> = {};
    for (const r of rows ?? []) {
      if (r?.key && typeof r.value === "string") cfg[r.key] = r.value.trim();
    }

    const apiKey = cfg["resend_api_key"];
    const fromEmail = cfg["resend_from_email"];
    const fromName = cfg["resend_from_name"] || "MV Broker";
    if (!apiKey || !fromEmail) {
      console.warn("[email] Resend não configurado (api key ou remetente ausente).");
      return false;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": `conta-aprovada-${args.solicitacaoId}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [args.email],
        subject: "Sua conta foi aprovada no MV Broker",
        html: buildHtml(args.nome, args.plano),
      }),
    });

    if (res.status === 200 || res.status === 202) return true;

    console.error("[email] conta-aprovada falhou:", res.status, await res.text());
    return false;
  } catch (e) {
    console.error("[email] conta-aprovada erro:", e);
    return false;
  }
}
