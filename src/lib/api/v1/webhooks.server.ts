// Disparo de webhooks para integrações externas.
// Cada entrega é assinada com HMAC-SHA256 do corpo, usando o segredo do webhook.
import { createHmac } from "crypto";
import { getFeedSupabase } from "@/lib/feed-supabase.server";

export const WEBHOOK_EVENTS = [
  "development.created",
  "development.updated",
  "building.created",
  "building.updated",
  "unit.created",
  "unit.updated",
  "unit.status_changed",
  "unit.price_changed",
  "unit.reserved",
  "unit.sold",
  "unit.rented",
  "unit.archived",
  "lead.created",
  "offer.created",
  "offer.updated",
  "offer.price_changed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function deliver(webhook: any, event: string, payload: unknown, db: any) {
  const body = JSON.stringify({ event, sent_at: new Date().toISOString(), data: payload });
  const signature = signPayload(webhook.secret, body);
  let responseStatus: number | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MVB-Event": event,
        "X-MVB-Signature": `sha256=${signature}`,
      },
      body,
    });
    responseStatus = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e: any) {
    error = e?.message ?? "network_error";
  }

  const okDelivery = !error;
  try {
    await db.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event,
      payload: payload as any,
      status: okDelivery ? "success" : "failed",
      attempts: 1,
      response_status: responseStatus,
      error,
      delivered_at: okDelivery ? new Date().toISOString() : null,
    });
    await db
      .from("webhooks")
      .update({
        last_delivery_at: new Date().toISOString(),
        failure_count: okDelivery ? 0 : (webhook.failure_count ?? 0) + 1,
      })
      .eq("id", webhook.id);
  } catch {
    /* histórico não deve derrubar a requisição principal */
  }
}

/** Dispara um evento para todos os webhooks ativos que o assinam. Nunca lança. */
export async function emitWebhook(event: WebhookEvent, payload: unknown, agencyId?: string | null) {
  try {
    const { client } = getFeedSupabase();
    if (!client) return;
    const db = client as any;
    let query = db.from("webhooks").select("*").eq("active", true).contains("events", [event]);
    if (agencyId) query = query.or(`agency_id.eq.${agencyId},agency_id.is.null`);
    const { data } = await query;
    await Promise.all((data ?? []).map((w: any) => deliver(w, event, payload, db)));
  } catch (e) {
    console.error("[webhooks] emit falhou", e);
  }
}

/** Envia um payload de teste para um webhook específico. */
export async function sendTestWebhook(webhookId: string) {
  const { client } = getFeedSupabase();
  if (!client) return { ok: false, error: "Backend indisponível" };
  const db = client as any;
  const { data: webhook } = await db.from("webhooks").select("*").eq("id", webhookId).maybeSingle();
  if (!webhook) return { ok: false, error: "Webhook não encontrado" };
  await deliver(webhook, "development.updated", { test: true, webhook_id: webhookId }, db);
  return { ok: true };
}
