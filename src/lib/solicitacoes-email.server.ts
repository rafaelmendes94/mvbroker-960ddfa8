// Envio do e-mail "conta aprovada". Server-only.
// Enquanto a infraestrutura de e-mail não estiver publicada, o envio falha
// silenciosamente (retorna false) para não bloquear a aprovação.

type Args = {
  solicitacaoId: string;
  email: string;
  nome: string;
  plano: string;
};

export async function enviarEmailContaAprovada(args: Args): Promise<boolean> {
  const baseUrl = process.env.APP_BASE_URL || "https://app.sistemamvbroker.com.br";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return false;

  try {
    const res = await fetch(`${baseUrl}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName: "conta-aprovada",
        recipientEmail: args.email,
        idempotencyKey: `conta-aprovada-${args.solicitacaoId}`,
        templateData: { nome: args.nome, plano: args.plano, loginUrl: `${baseUrl}/auth` },
      }),
    });
    if (!res.ok) {
      console.error("[email] conta-aprovada falhou:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] conta-aprovada erro:", e);
    return false;
  }
}
