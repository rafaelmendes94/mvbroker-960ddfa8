// Envelope padrão da API MV Broker v1.

export const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export type Meta = {
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
};

export function ok(data: unknown, meta?: Meta, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }), {
    status,
    headers: JSON_HEADERS,
  });
}

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "FORBIDDEN_SCOPE"
  | "NOT_FOUND"
  | "DEVELOPER_NOT_FOUND"
  | "BUILDING_NOT_FOUND"
  | "DEVELOPMENT_NOT_FOUND"
  | "TYPOLOGY_NOT_FOUND"
  | "UNIT_NOT_FOUND"
  | "MEDIA_NOT_FOUND"
  | "LEAD_NOT_FOUND"
  | "OFFER_NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "METHOD_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "CONFIG_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  FORBIDDEN_SCOPE: 403,
  NOT_FOUND: 404,
  DEVELOPER_NOT_FOUND: 404,
  BUILDING_NOT_FOUND: 404,
  DEVELOPMENT_NOT_FOUND: 404,
  TYPOLOGY_NOT_FOUND: 404,
  UNIT_NOT_FOUND: 404,
  MEDIA_NOT_FOUND: 404,
  LEAD_NOT_FOUND: 404,
  OFFER_NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  METHOD_NOT_ALLOWED: 405,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  CONFIG_ERROR: 500,
};

export function fail(code: ApiErrorCode, message: string, details?: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code, message, ...(details ? { details } : {}) } }),
    { status: STATUS_BY_CODE[code] ?? 400, headers: { ...JSON_HEADERS, ...(extraHeaders ?? {}) } },
  );
}

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function paginationMeta(page: number, perPage: number, total: number): Meta {
  return {
    page,
    per_page: perPage,
    total,
    total_pages: perPage > 0 ? Math.ceil(total / perPage) : 0,
  };
}

export function parsePagination(url: URL): { page: number; perPage: number; from: number; to: number } {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page") ?? 25) || 25));
  const from = (page - 1) * perPage;
  return { page, perPage, from, to: from + perPage - 1 };
}
