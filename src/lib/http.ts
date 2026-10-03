/**
 * HTTP LAYER — every response is an `ApiResult<T>`.
 * ============================================================================
 * Contract enforced here, not by convention:
 *  - Body is ALWAYS `{ ok: true, data, meta }` or `{ ok: false, error, meta }`.
 *  - `meta.requestId` is ALWAYS present (so a support ticket can be traced).
 *  - 429/503 carry `Retry-After`; 429 also carries the `RateLimit-*` headers.
 *  - In production an unexpected throw becomes a generic `INTERNAL_ERROR`; the
 *    real cause (stack, SQL, Prisma code) is logged with the requestId and never
 *    serialised.
 *
 * This module must stay runtime-agnostic enough for `middleware.ts` (edge), so
 * it only imports `next/server`, which is supported there.
 */
import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError, STATUS_BY_CODE } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { REQUEST_ID_HEADER } from "@/lib/request";
import type { ApiErrorCode, ApiMeta, ApiResult } from "@/lib/types";

// ── Prisma ──────────────────────────────────────────────────────────────────

/** Subset of `Prisma.PrismaClientKnownRequestError` we inspect. */
interface PrismaLikeError {
  name?: unknown;
  code?: unknown;
  meta?: { target?: unknown; field_name?: unknown; cause?: unknown };
  message?: unknown;
}

/** Prisma's own error codes, by name so we do not need a generated enum import. */
const PRISMA_P2002 = "P2002";
const PRISMA_P2025 = "P2025";
const PRISMA_P2034 = "P2034";

function prismaCode(err: unknown): string | null {
  const e = err as PrismaLikeError;
  if (!e || typeof e !== "object") return null;
  if (e.name !== "PrismaClientKnownRequestError" && e.name !== "PrismaClientUnknownRequestError") return null;
  return typeof e.code === "string" ? e.code : null;
}

/**
 * Translates a Prisma failure into an `ApiError`.
 *
 * - `P2002` unique violation → 409 CONFLICT. `meta.target` is a *schema
 *   identifier*, not user data, so it is safe to include.
 * - `P2025` record not found → 404 NOT_FOUND.
 * - `P2034` transaction conflict / write-write deadlock → 409 CONFLICT with
 *   `retryable: true` so the client (or `withTransactionRetry`) can retry.
 */
export function fromPrismaError(err: unknown): ApiError | null {
  const code = prismaCode(err);
  if (!code) return null;
  switch (code) {
    case PRISMA_P2002: {
      const target = (err as PrismaLikeError).meta?.target;
      const label = Array.isArray(target) ? target.join(", ") : typeof target === "string" ? target : undefined;
      return new ApiError("CONFLICT", "That record already exists. Please refresh and try again.", {
        details: label ? { uniqueField: label } : undefined,
        cause: err,
      });
    }
    case PRISMA_P2025:
      return new ApiError("NOT_FOUND", "We could not find what you were looking for.", { cause: err });
    case PRISMA_P2034:
      return new ApiError("CONFLICT", "Two people updated this at the same time. Please try again.", {
        details: { retryable: true },
        cause: err,
      });
    default:
      return new ApiError("INTERNAL_ERROR", "Something went wrong on our side. Please try again.", { cause: err });
  }
}

// ── Zod ─────────────────────────────────────────────────────────────────────

/** Field-path → messages, ready for `ApiFailure.error.fields`. */
export function zodFields(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    const list = out[key] ?? [];
    list.push(issue.message);
    out[key] = list;
  }
  return out;
}

// ── Meta ────────────────────────────────────────────────────────────────────

export interface MetaInput {
  requestId: string;
  page?: number;
  pageSize?: number;
  total?: number;
  retryAfter?: number;
}

function buildMeta(input: MetaInput): ApiMeta {
  const meta: ApiMeta = { requestId: input.requestId };
  if (input.page !== undefined) meta.page = input.page;
  if (input.pageSize !== undefined) meta.pageSize = input.pageSize;
  if (input.total !== undefined) meta.total = input.total;
  if (input.retryAfter !== undefined) meta.retryAfter = input.retryAfter;
  return meta;
}

export interface ResponseInitExtra {
  status?: number;
  headers?: Record<string, string>;
  /** `Cache-Control` value; availability GETs set this. */
  cacheControl?: string;
  /** Set `true` for staff-only payloads so they are never cached by a CDN. */
  private?: boolean;
}

function withHeaders(headers: Headers, extra: ResponseInitExtra, status: number): Headers {
  for (const [k, v] of Object.entries(extra.headers ?? {})) headers.set(k, v);
  if (extra.cacheControl) headers.set("Cache-Control", extra.cacheControl);
  else if (extra.private) headers.set("Cache-Control", "no-store, max-age=0");
  if ((status === 429 || status === 503) && !headers.has("Retry-After")) headers.set("Retry-After", "30");
  return headers;
}

// ── Success ─────────────────────────────────────────────────────────────────

export function ok<T>(
  data: T,
  meta: MetaInput,
  extra: ResponseInitExtra = {},
): NextResponse<ApiResult<T>> {
  const body: ApiResult<T> = { ok: true, data, meta: buildMeta(meta) };
  const status = extra.status ?? 200;
  const headers = withHeaders(new Headers(), { ...extra, headers: { ...extra.headers, [REQUEST_ID_HEADER]: meta.requestId } }, status);
  return NextResponse.json(body, { status, headers });
}

/** 201 with a `Location`-friendly body. */
export function created<T>(data: T, meta: MetaInput, extra: ResponseInitExtra = {}): NextResponse<ApiResult<T>> {
  return ok(data, meta, { ...extra, status: 201 });
}

// ── Failure ─────────────────────────────────────────────────────────────────

/**
 * Renders an `ApiError` as an `ApiFailure`. `details` is included only for
 * machine-readable codes the client is expected to branch on (for example
 * `promoStatus`); free-form internals never appear.
 */
export function fail(error: ApiError, meta: MetaInput): NextResponse<ApiResult<never>> {
  const status = error.status || STATUS_BY_CODE[error.code] || 500;
  const retryAfter = error.retryAfter ?? meta.retryAfter;
  const failure: ApiResult<never> = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
    meta: buildMeta(retryAfter === undefined ? meta : { ...meta, retryAfter }),
  };
  const headers: Record<string, string> = { [REQUEST_ID_HEADER]: meta.requestId };
  if (retryAfter !== undefined) headers["Retry-After"] = String(Math.max(1, Math.ceil(retryAfter)));

  // Internals go to the log, keyed by requestId — never to the client.
  const shouldLog = status >= 500 || error.code === "CONFLICT";
  if (shouldLog) {
    logger.error(
      "api.error",
      { ...error.logMeta, code: error.code, status },
      error.cause === undefined ? undefined : { err: error.cause },
    );
  }

  return NextResponse.json(failure, { status, headers: withHeaders(new Headers(), { headers }, status) });
}

/**
 * Wraps a handler so *any* throw becomes a safe `ApiResult`.
 *
 * Prisma errors are mapped by code; `ApiError`s pass through untouched;
 * everything else becomes an opaque 500 in production (the real error is logged
 * with the requestId so the response is still traceable).
 */
export function withApi<T>(
  meta: MetaInput,
  handler: () => Promise<NextResponse<ApiResult<T>>>,
): Promise<NextResponse<ApiResult<T>>> {
  return handler().catch((err: unknown) => {
    if (ApiError.is(err)) return fail(err, meta);
    const mapped = fromPrismaError(err);
    if (mapped) return fail(mapped, meta);
    logger.error(
      "api.unhandled",
      { requestId: meta.requestId },
      { err },
    );
    const safe =
      process.env.NODE_ENV === "production"
        ? new ApiError("INTERNAL_ERROR", "Something went wrong on our side. Please try again.")
        : new ApiError("INTERNAL_ERROR", "Internal error (development only).", { logMeta: { err: String(err) } });
    return fail(safe, meta);
  });
}

/** Converts an untrusted JSON body into a validated value or a 400. */
export async function parseBody<T>(req: Request, schema: { parse: (v: unknown) => T }): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  try {
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError("VALIDATION_ERROR", "Please check the highlighted fields.", { fields: zodFields(err) });
    }
    throw err;
  }
}

export const ERROR_CODES = STATUS_BY_CODE as Record<ApiErrorCode, number>;
