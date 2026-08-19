// Roteador interno da API v1. Um único ponto de dispatch usado tanto por
// /api/v1/* (consumo interno) quanto por /api/public/v1/* (integrações externas).
import { ApiError, JSON_HEADERS, fail, ok } from "./response";
import { requireScope, resolvePrincipal } from "./auth.server";
import * as svc from "./services.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string) {
  if (!UUID_RE.test(value)) throw new ApiError("VALIDATION_ERROR", `${label} inválido`);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ApiError("VALIDATION_ERROR", "Corpo da requisição deve ser um objeto JSON");
    }
    return body as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("VALIDATION_ERROR", "JSON inválido");
  }
}

export async function handleApiV1(request: Request, splat: string): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });

  const url = new URL(request.url);
  const segments = (splat ?? "").split("/").filter(Boolean);
  const method = request.method.toUpperCase();

  try {
    if (segments.length === 0) {
      return ok({ name: "MV Broker API", version: "v1", resources: ["developments", "typologies", "units", "offers", "properties"] });
    }
    if (segments[0] === "health") return ok({ status: "ok", time: new Date().toISOString() });

    const principal = await resolvePrincipal(request);
    const [resource, id, sub] = segments;

    // ---------- developments ----------
    if (resource === "developments") {
      if (!id) {
        if (method === "GET") {
          requireScope(principal, "developments:read");
          const { data, meta } = await svc.listDevelopments(url, principal);
          return ok(data, meta);
        }
        if (method === "POST") {
          requireScope(principal, "developments:write");
          return ok(await svc.createDevelopment(await readBody(request), principal), undefined, 201);
        }
        throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado`);
      }
      assertUuid(id, "development_id");
      if (sub === "typologies" && method === "GET") {
        requireScope(principal, "typologies:read");
        await svc.getDevelopment(id, principal);
        const { data, meta } = await svc.listTypologies(url, principal, id);
        return ok(data, meta);
      }
      if (sub === "units" && method === "GET") {
        requireScope(principal, "units:read");
        await svc.getDevelopment(id, principal);
        const { data, meta } = await svc.listUnits(url, principal, { developmentId: id });
        return ok(data, meta);
      }
      if (sub) throw new ApiError("NOT_FOUND", "Rota não encontrada");
      if (method === "GET") {
        requireScope(principal, "developments:read");
        return ok(await svc.getDevelopment(id, principal));
      }
      if (method === "PATCH" || method === "PUT") {
        requireScope(principal, "developments:write");
        return ok(await svc.updateDevelopment(id, await readBody(request), principal));
      }
      throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado`);
    }

    // ---------- typologies ----------
    if (resource === "typologies") {
      if (!id) {
        if (method === "GET") {
          requireScope(principal, "typologies:read");
          const { data, meta } = await svc.listTypologies(url, principal, url.searchParams.get("development_id") ?? undefined);
          return ok(data, meta);
        }
        if (method === "POST") {
          requireScope(principal, "typologies:write");
          return ok(await svc.createTypology(await readBody(request), principal), undefined, 201);
        }
        throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado`);
      }
      assertUuid(id, "typology_id");
      if (sub === "units" && method === "GET") {
        requireScope(principal, "units:read");
        const { data, meta } = await svc.listUnits(url, principal, { typologyId: id });
        return ok(data, meta);
      }
      if (sub) throw new ApiError("NOT_FOUND", "Rota não encontrada");
      if (method === "GET") {
        requireScope(principal, "typologies:read");
        return ok(await svc.getTypology(id));
      }
      if (method === "PATCH" || method === "PUT") {
        requireScope(principal, "typologies:write");
        return ok(await svc.updateTypology(id, await readBody(request), principal));
      }
      throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado`);
    }

    // ---------- units ----------
    if (resource === "units") {
      if (!id) {
        if (method === "GET") {
          requireScope(principal, "units:read");
          const { data, meta } = await svc.listUnits(url, principal);
          return ok(data, meta);
        }
        if (method === "POST") {
          requireScope(principal, "units:write");
          return ok(await svc.createUnit(await readBody(request), principal), undefined, 201);
        }
        throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado`);
      }
      assertUuid(id, "unit_id");
      if (sub === "offers") {
        if (method === "GET") {
          requireScope(principal, "offers:read");
          return ok(await svc.listOffers(id, principal));
        }
        if (method === "POST") {
          requireScope(principal, "offers:write");
          return ok(await svc.createOffer(id, await readBody(request), principal), undefined, 201);
        }
        throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado`);
      }
      if (sub) throw new ApiError("NOT_FOUND", "Rota não encontrada");
      if (method === "GET") {
        requireScope(principal, "units:read");
        return ok(await svc.getUnit(id, principal));
      }
      if (method === "PATCH" || method === "PUT") {
        requireScope(principal, "units:write");
        return ok(await svc.updateUnit(id, await readBody(request), principal));
      }
      throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado`);
    }

    // ---------- offers ----------
    if (resource === "offers" && id) {
      assertUuid(id, "offer_id");
      if (method === "PATCH" || method === "PUT") {
        requireScope(principal, "offers:write");
        return ok(await svc.updateOffer(id, await readBody(request), principal));
      }
      throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado`);
    }

    // ---------- properties (visão agregada) ----------
    if (resource === "properties" && !id && method === "GET") {
      requireScope(principal, "units:read");
      const { data, meta } = await svc.listProperties(url, principal);
      return ok(data, meta);
    }

    throw new ApiError("NOT_FOUND", "Rota não encontrada");
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.details);
    console.error("[api/v1]", e);
    return fail("INTERNAL_ERROR", "Erro interno");
  }
}
