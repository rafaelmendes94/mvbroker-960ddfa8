// Roteador da API MV Broker v1 (modelo Órulo: Developer → Building → Typology → Unit).
// Um único ponto de dispatch, usado por /api/v1/* (interno) e /api/public/v1/* (integrações).
import { ApiError, JSON_HEADERS, fail, ok } from "./response";
import { requireScope, resolvePrincipal, type Principal } from "./auth.server";
import * as catalog from "./catalog.server";
import { buildOpenApiSpec } from "./openapi";
import { checkRateLimit, logApiRequest, newRequestId } from "./ratelimit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_ID_RE = /^(dev|bld|typ|unt|med|led)_[A-Za-z0-9]{6,}$/;

function assertId(value: string, label: string) {
  if (!UUID_RE.test(value) && !PUBLIC_ID_RE.test(value)) {
    throw new ApiError("VALIDATION_ERROR", `${label} inválido`);
  }
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

function rateHeaders(info: { limit: number; remaining: number; reset: number }): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(info.limit),
    "X-RateLimit-Remaining": String(info.remaining),
    "X-RateLimit-Reset": String(info.reset),
  };
}

async function dispatch(
  request: Request,
  url: URL,
  segments: string[],
  principal: Principal,
  extraHeaders: Record<string, string>,
): Promise<Response> {
  const method = request.method.toUpperCase();
  const [resource, id, sub] = segments;
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  const send = (data: unknown, meta?: any, status = 200) => {
    const res = ok(data, meta, status);
    for (const [k, v] of Object.entries(extraHeaders)) res.headers.set(k, v);
    return res;
  };
  const notAllowed = () => {
    throw new ApiError("METHOD_NOT_ALLOWED", `${method} não suportado nesta rota`);
  };

  // ---------- developers ----------
  if (resource === "developers") {
    if (!id) {
      if (method !== "GET") notAllowed();
      requireScope(principal, "developers:read");
      const { data, meta } = await catalog.listDevelopers(url, principal);
      return send(data, meta);
    }
    assertId(id, "developer_id");
    if (sub === "buildings") {
      if (method !== "GET") notAllowed();
      requireScope(principal, "buildings:read");
      const developer: any = await catalog.getDeveloper(id, principal);
      const { data, meta } = await catalog.listBuildings(url, principal, { developerId: developer.internal_id ?? developer.id });
      return send(data, meta);
    }
    if (sub) throw new ApiError("NOT_FOUND", "Rota não encontrada");
    if (method !== "GET") notAllowed();
    requireScope(principal, "developers:read");
    return send(await catalog.getDeveloper(id, principal));
  }

  // ---------- buildings (aceita o alias legado "developments") ----------
  if (resource === "buildings" || resource === "developments") {
    if (!id) {
      if (method !== "GET") notAllowed();
      requireScope(principal, "buildings:read");
      const { data, meta } = await catalog.listBuildings(url, principal);
      return send(data, meta);
    }
    assertId(id, "building_id");
    if (sub === "typologies") {
      if (method !== "GET") notAllowed();
      requireScope(principal, "typologies:read");
      const building = await catalog.getBuildingRow(id, principal);
      const { data, meta } = await catalog.listTypologies(url, principal, building.id);
      return send(data, meta);
    }
    if (sub === "units") {
      if (method !== "GET") notAllowed();
      requireScope(principal, "units:read");
      const building = await catalog.getBuildingRow(id, principal);
      const { data, meta } = await catalog.listUnits(url, principal, { buildingId: building.id });
      return send(data, meta);
    }
    if (sub) throw new ApiError("NOT_FOUND", "Rota não encontrada");
    if (method !== "GET") notAllowed();
    requireScope(principal, "buildings:read");
    return send(await catalog.getBuilding(id, principal));
  }

  // ---------- typologies ----------
  if (resource === "typologies") {
    if (!id) {
      if (method !== "GET") notAllowed();
      requireScope(principal, "typologies:read");
      const buildingParam = url.searchParams.get("building_id") ?? url.searchParams.get("development_id");
      const buildingId = buildingParam ? (await catalog.getBuildingRow(buildingParam, principal)).id : undefined;
      const { data, meta } = await catalog.listTypologies(url, principal, buildingId);
      return send(data, meta);
    }
    assertId(id, "typology_id");
    if (sub === "units") {
      if (method !== "GET") notAllowed();
      requireScope(principal, "units:read");
      const typology = await catalog.getTypologyRow(id, principal);
      const { data, meta } = await catalog.listUnits(url, principal, { typologyId: typology.id });
      return send(data, meta);
    }
    if (sub) throw new ApiError("NOT_FOUND", "Rota não encontrada");
    if (method !== "GET") notAllowed();
    requireScope(principal, "typologies:read");
    return send(await catalog.getTypology(id, principal));
  }

  // ---------- units (também exposto como "properties") ----------
  if (resource === "units" || resource === "properties") {
    if (!id) {
      if (method === "GET") {
        requireScope(principal, "units:read");
        const { data, meta } = await catalog.listUnits(url, principal);
        return send(data, meta);
      }
      if (method === "POST") {
        requireScope(principal, "units:write");
        return send(await catalog.createUnit(await readBody(request), principal), undefined, 201);
      }
      notAllowed();
    }
    assertId(id!, "unit_id");
    if (sub === "media") {
      if (method !== "GET") notAllowed();
      requireScope(principal, "media:read");
      return send(await catalog.listUnitMedia(id!, principal, url.origin));
    }
    if (sub) throw new ApiError("NOT_FOUND", "Rota não encontrada");
    if (method === "GET") {
      requireScope(principal, "units:read");
      return send(await catalog.getUnit(id!, principal, url.origin));
    }
    if (method === "PATCH" || method === "PUT") {
      requireScope(principal, "units:write");
      return send(await catalog.updateUnit(id!, await readBody(request), principal));
    }
    if (method === "DELETE") {
      requireScope(principal, "units:write");
      return send(await catalog.archiveUnit(id!, principal));
    }
    notAllowed();
  }

  // ---------- leads ----------
  if (resource === "leads" && !id) {
    if (method === "POST") {
      requireScope(principal, "leads:write");
      return send(await catalog.createLead(await readBody(request), principal, ip), undefined, 201);
    }
    if (method === "GET") {
      requireScope(principal, "leads:read");
      const { data, meta } = await catalog.listLeads(url, principal);
      return send(data, meta);
    }
    notAllowed();
  }

  throw new ApiError("NOT_FOUND", "Rota não encontrada");
}

export async function handleApiV1(request: Request, splat: string): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });

  const startedAt = Date.now();
  const requestId = newRequestId();
  const url = new URL(request.url);
  const segments = (splat ?? "").split("/").filter(Boolean);
  const endpoint = `/${segments.join("/")}`;
  let principal: Principal | null = null;
  let response: Response;
  let errorCode: string | null = null;

  try {
    // Rotas abertas (sem credencial)
    if (segments.length === 0) {
      response = ok({
        name: "MV Broker API",
        version: "v1",
        docs: `${url.origin}/api/public/v1/openapi.json`,
        resources: ["developers", "buildings", "typologies", "units", "leads"],
      });
    } else if (segments[0] === "health") {
      response = ok({ status: "ok", time: new Date().toISOString() });
    } else if (segments[0] === "openapi.json") {
      response = new Response(JSON.stringify(buildOpenApiSpec(url.origin)), {
        status: 200,
        headers: { ...JSON_HEADERS, "Cache-Control": "public, max-age=300" },
      });
    } else {
      principal = await resolvePrincipal(request);
      const rate = await checkRateLimit(principal);
      const headers = { ...rateHeaders(rate), "X-Request-Id": requestId };
      if (rate.remaining <= 0) {
        throw Object.assign(new ApiError("RATE_LIMITED", "Limite de requisições excedido"), { headers });
      }
      response = await dispatch(request, url, segments, principal, headers);
    }
  } catch (e: any) {
    if (e instanceof ApiError) {
      errorCode = e.code;
      response = fail(e.code, e.message, e.details, { "X-Request-Id": requestId, ...(e.headers ?? {}) });
    } else {
      errorCode = "INTERNAL_ERROR";
      console.error("[api/v1]", requestId, e);
      response = fail("INTERNAL_ERROR", "Erro interno", undefined, { "X-Request-Id": requestId });
    }
  }

  response.headers.set("X-Request-Id", requestId);

  await logApiRequest({
    requestId,
    principal,
    endpoint,
    method: request.method.toUpperCase(),
    statusCode: response.status,
    errorCode,
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    responseTimeMs: Date.now() - startedAt,
  });

  return response;
}
