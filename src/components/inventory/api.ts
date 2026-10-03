/**
 * INVENTORY API CLIENT
 * ============================================================================
 * A3 owns this file. It is the ONLY place in the inventory UI that touches the
 * network, and it adds nothing to the wire contract — every payload type is
 * imported from `src/lib/inventory-types.ts`.
 *
 * ── THE WIRE SHAPE THIS EXPECTS (A2 must match) ────────────────────────────
 * Every route answers with the site's `ApiResult<T>` envelope from
 * `src/lib/types.ts`.
 *
 *   GET    /api/inventory/products
 *          ?q=&kind=&lowStock=&includeInactive=&page=&pageSize=
 *          → ApiResult<{ rows: ProductDto[]; total: number; page: number;
 *                         pageSize: number }>
 *          Also returns an `X-Total-Count` header. There is no server-side sort
 *          and no server-side out-of-stock filter yet, so those two are applied to
 *          the returned PAGE and labelled as such wherever they are shown — see
 *          the report. A catalogue-wide low count is read honestly by asking for
 *          `?lowStock=true&pageSize=1` and reading `total` off the response.
 *
 *   GET    /api/inventory/products/[id]         → ApiResult<ProductDto>
 *   PATCH  /api/inventory/products/[id]         (UpdateProductInput minus id)
 *                                                → ApiResult<ProductDto>
 *
 *   GET    /api/inventory/movements             ?productId=&bookingId=&kind=&from=&to=&page=&pageSize=
 *                                                → ApiResult<{ movements: MovementDto[]; total: number }>
 *
 *   POST   /api/inventory/movements             (PostMovementInput)
 *          → 200 ApiResult<PostMovementResult>
 *          → refusal: a `PostMovementRejection` — `{ ok:false, reason, available,
 *            requested, message }`. `readRefusal()` accepts that shape at the
 *            body root, under `data`, or under `error`, because a refusal is the
 *            one response where losing the numbers loses the whole message.
 *
 *   GET    /api/inventory/counts                → ApiResult<{ counts: StockCountDto[] }>
 *   POST   /api/inventory/counts                (CreateCountInput) → ApiResult<StockCountDto>
 *   GET    /api/inventory/counts/[id]           → ApiResult<StockCountDto>
 *   POST   /api/inventory/counts/lines          (RecordCountInput)  → ApiResult<CountLineDto>
 *   POST   /api/inventory/counts/[id]/post      → ApiResult<StockCountDto>
 *
 *   GET    /api/inventory/reorder ?sort=&dir=   → ApiResult<{ rows: ReorderRowDto[] }>
 *   GET    /api/inventory/aging                 → ApiResult<{ products: ProductDto[] }>
 *
 * ── WHY ALL OF IT IS `fetch` AND NOT A SERVER ACTION ────────────────────────
 * Instant search must be cancellable. A Server Action cannot be aborted
 * mid-flight, so a mechanic typing "205/5" would get three responses landing in
 * an unknown order and the list would flicker back through stale results. Every
 * read here takes an `AbortSignal` and the newest request always wins.
 * ============================================================================
 */

import type {
  CountLineDto,
  CreateCountInput,
  MovementDto,
  MovementQuery,
  MovementRefusalReason,
  PostMovementInput,
  ReserveInput,
  ReserveResult,
  PostMovementResult,
  ProductDto,
  RecordCountInput,
  ReorderRowDto,
  StockCountDto,
  UpdateProductInput,
} from "@/lib/inventory-types";
import type { SortDir, StockQuery } from "./types";

// ── Endpoints ────────────────────────────────────────────────────────────────

const enc = (id: string): string => encodeURIComponent(id);

export const INVENTORY_ENDPOINTS = {
  products: "/api/inventory/products",
  product: (id: string) => `/api/inventory/products/${enc(id)}`,
  movements: "/api/inventory/movements",
  reservations: "/api/inventory/reservations",
  /** The single write path for every stock change. One endpoint, one ledger row. */
  movement: "/api/inventory/movements",
  counts: "/api/inventory/counts",
  count: (id: string) => `/api/inventory/counts/${enc(id)}`,
  countLines: "/api/inventory/counts/lines",
  countPost: (id: string) => `/api/inventory/counts/${enc(id)}/post`,
  reorder: "/api/inventory/reorder",
  aging: "/api/inventory/aging",
} as const;

/** Readable CSRF cookie name. Mirrors `CSRF_COOKIE` in `src/lib/session-cookie.ts`. */
const CSRF_COOKIE = "eyg_csrf";
const CSRF_HEADER = "x-csrf-token";

/**
 * The double-submit token, read from the cookie the sign-in route set.
 *
 * That cookie is deliberately NOT `httpOnly` — the server cannot read a cookie
 * the browser refuses to expose to script, so a client-side POST has to echo it
 * back in the `x-csrf-token` header. A missing token is reported honestly as a
 * session problem rather than as a mystery 403.
 */
/**
 * Hold stock for a booking, or for a walk-in when `bookingId` is omitted.
 *
 * Deliberately NOT `postMovement` with kind RESERVE. A hold moves the *promise*,
 * not the shelf, and it only expires correctly if a `Reservation` row with a TTL
 * exists — otherwise the cron sweep has nothing to release and the parts are
 * invisible to every other customer, permanently.
 *
 * The movements endpoint refuses RESERVE for exactly that reason.
 */
export async function postReservation(
  input: ReserveInput,
  signal?: AbortSignal,
): Promise<MovementOutcome> {
  const raw = await request(INVENTORY_ENDPOINTS.reservations, {
    method: "POST",
    body: JSON.stringify(input),
    ...(signal !== undefined ? { signal } : {}),
  });

  if ("kind" in raw) return { kind: "offline" };

  const refusal = readRefusal(raw.body);
  if (refusal !== null) return { kind: "refused", refusal };

  if (raw.httpStatus >= 200 && raw.httpStatus < 300) {
    const data = readData<ReserveResult>(raw);
    if (data !== undefined) return { kind: "ok", result: data as unknown as PostMovementResult };
  }

  const described = describeError(raw, "That hold did not save");
  return {
    kind: "error",
    title: described.title,
    message: described.message,
    code: described.code,
    httpStatus: raw.httpStatus,
  };
}

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(CSRF_COOKIE.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * A key generated ONCE per opened dialog.
 *
 * `crypto.randomUUID` is available in every browser that can run this app and in
 * Node 20; the fallback keeps the function total rather than throwing, because a
 * stock write must never be lost to a missing Web Crypto method.
 */
export function newIdempotencyKey(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();
  if (typeof webCrypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `k-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// ── Transport ────────────────────────────────────────────────────────────────

/** Mirrors A2's `ProductListDto` exactly. Nothing is added to it. */
export interface ProductListPayload {
  rows: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MovementListPayload {
  movements: MovementDto[];
  total: number;
}

/** A move the server refused. Never silently clamped into a success. */
export interface MovementRefusal {
  reason: MovementRefusalReason;
  available: number;
  requested: number;
  message: string;
}

export type ReadOutcome<T> =
  | { kind: "ok"; data: T }
  | {
      kind: "error";
      title: string;
      message: string;
      code: string;
      httpStatus: number;
      /** True when trying again could plausibly work. */
      retryable: boolean;
    }
  | { kind: "offline" };

export type MovementOutcome =
  | { kind: "ok"; result: PostMovementResult }
  | { kind: "refused"; refusal: MovementRefusal }
  | { kind: "error"; title: string; message: string; code: string; httpStatus: number }
  | { kind: "offline" };

const MOVEMENT_REFUSAL_REASONS = [
  "INSUFFICIENT_STOCK",
  "NEGATIVE_QUANTITY",
  "ZERO_QUANTITY",
  "PRODUCT_INACTIVE",
  "OPENING_ALREADY_SET",
  "INSUFFICIENT_AVAILABLE",
] as const satisfies ReadonlyArray<MovementRefusalReason>;

function isRefusalReason(value: string): value is MovementRefusalReason {
  return (MOVEMENT_REFUSAL_REASONS as ReadonlyArray<string>).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface RawResponse {
  httpStatus: number;
  body: unknown;
  isJson: boolean;
}

async function request(path: string, init: RequestInit = {}): Promise<RawResponse | { kind: "offline" }> {
  const method = (init.method ?? "GET").toUpperCase();
  const mutating = method !== "GET" && method !== "HEAD";
  const csrf = mutating ? readCsrfToken() : null;

  try {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(csrf !== null ? { [CSRF_HEADER]: csrf } : {}),
        ...init.headers,
      },
    });

    const raw = await response.text();
    let body: unknown = null;
    let isJson = false;
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw);
        isJson = true;
      } catch {
        isJson = false;
      }
    }
    return { httpStatus: response.status, body, isJson };
  } catch {
    return { kind: "offline" };
  }
}

/**
 * Pull the refusal out of a non-2xx body.
 *
 * A refusal is the one response where dropping the numbers destroys the
 * message: "INSUFFICIENT_STOCK" alone makes the UI say "failed", when what the
 * operator needs is "3 available". `PostMovementRejection` puts those numbers at
 * the body root; a wrapped envelope would put them under `data` or `error`. All
 * three are read here so a reasonable server shape does not produce a useless
 * error.
 */
function readRefusal(body: unknown): MovementRefusal | null {
  const candidates: unknown[] = [body];
  if (isRecord(body)) {
    candidates.push(body["data"], body["error"]);
    if (isRecord(body["error"])) candidates.push(body["error"]["data"]);
  }

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const reason = candidate["reason"];
    if (typeof reason !== "string" || !isRefusalReason(reason)) continue;

    const available = readNumber(candidate["available"]);
    const requested = readNumber(candidate["requested"]);
    const message = typeof candidate["message"] === "string" ? candidate["message"] : "";

    return {
      reason,
      available: available ?? 0,
      requested: requested ?? 0,
      message: message || "The server refused this move.",
    };
  }
  return null;
}

function describeError(raw: RawResponse, fallbackTitle: string): Extract<ReadOutcome<never>, { kind: "error" }> {
  if (!raw.isJson || !isRecord(raw.body)) {
    return {
      kind: "error",
      title: fallbackTitle,
      message: `The inventory service answered with HTTP ${raw.httpStatus} and no readable body. Nothing was changed.`,
      code: "UNREADABLE_RESPONSE",
      httpStatus: raw.httpStatus,
      retryable: true,
    };
  }

  const error = isRecord(raw.body["error"]) ? raw.body["error"] : null;
  const code = error && typeof error["code"] === "string" ? error["code"] : "INTERNAL_ERROR";
  const message =
    error && typeof error["message"] === "string" && error["message"].trim() !== ""
      ? error["message"]
      : "The inventory service could not complete that request. Nothing was changed.";

  const authProblem = raw.httpStatus === 401 || code === "UNAUTHENTICATED" || code === "FORBIDDEN";

  return {
    kind: "error",
    title: authProblem
      ? "Your staff session has ended"
      : raw.httpStatus >= 500 || code === "SERVICE_UNAVAILABLE"
        ? "The inventory service is not answering"
        : fallbackTitle,
    message: authProblem
      ? "Sign in again on the staff area. Stock was not changed."
      : message,
    code,
    httpStatus: raw.httpStatus,
    retryable: !authProblem,
  };
}

/** Unwraps the `ApiResult<T>` success envelope. Returns `undefined` on failure. */
function readData<T>(raw: RawResponse): T | undefined {
  if (!raw.isJson || !isRecord(raw.body)) return undefined;
  if (raw.body["ok"] !== true || !("data" in raw.body)) return undefined;
  return raw.body["data"] as T;
}

async function readRequest<T>(path: string, signal: AbortSignal | undefined, title: string): Promise<ReadOutcome<T>> {
  const raw = await request(path, signal !== undefined ? { signal } : {});
  if ("kind" in raw) return { kind: "offline" };
  if (raw.httpStatus >= 200 && raw.httpStatus < 300) {
    const data = readData<T>(raw);
    if (data !== undefined) return { kind: "ok", data };
  }
  return describeError(raw, title);
}

async function writeRequest<T>(
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  title: string,
): Promise<ReadOutcome<T>> {
  const raw = await request(path, {
    method: "POST",
    body: JSON.stringify(body),
    ...(signal !== undefined ? { signal } : {}),
  });
  if ("kind" in raw) return { kind: "offline" };
  if (raw.httpStatus >= 200 && raw.httpStatus < 300) {
    const data = readData<T>(raw);
    if (data !== undefined) return { kind: "ok", data };
  }
  return describeError(raw, title);
}

async function patchRequest<T>(
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  title: string,
): Promise<ReadOutcome<T>> {
  const raw = await request(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    ...(signal !== undefined ? { signal } : {}),
  });
  if ("kind" in raw) return { kind: "offline" };
  if (raw.httpStatus >= 200 && raw.httpStatus < 300) {
    const data = readData<T>(raw);
    if (data !== undefined) return { kind: "ok", data };
  }
  return describeError(raw, title);
}

// ── Products ─────────────────────────────────────────────────────────────────

/**
 * The stock list read. `q` is searched by the SERVER across SKU, name, brand,
 * size and barcode — the reason a mechanic types a rim size or scans a barcode
 * and expects the tyre to appear, and the reason a client-side filter over one
 * cached page can never be correct.
 *
 * `filter`, `sort` and `dir` are UI state, not wire state: A2's list endpoint
 * does not accept them yet, so `StockList` applies them to the returned page and
 * says so on screen. Once the endpoint grows `sort`/`dir`/`inStock=`, the fix is
 * three lines in this function and three in `StockList`.
 */
export function fetchProducts(
  query: Pick<StockQuery, "q" | "kind" | "filter" | "page" | "pageSize">,
  signal?: AbortSignal,
): Promise<ReadOutcome<ProductListPayload>> {
  const params = new URLSearchParams();
  params.set("q", query.q.trim());
  if (query.kind !== "ALL") params.set("kind", query.kind);
  // `LOW` is the only stock filter the server has, and it is exactly the one a
  // mechanic cares about. `OUT` is applied to the page instead.
  if (query.filter === "LOW") params.set("lowStock", "true");
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  return readRequest<ProductListPayload>(
    `${INVENTORY_ENDPOINTS.products}?${params.toString()}`,
    signal,
    "The stock list did not load",
  );
}

/**
 * The catalogue-wide low-stock count, read honestly.
 *
 * There is no aggregate endpoint, so this asks for ONE low product and reads the
 * `total` the server counted anyway. It is a real number over the whole
 * catalogue rather than a guess from the rows that happen to be on screen — which
 * is the whole point of putting it in the page title.
 */
export function fetchLowStockCount(signal?: AbortSignal): Promise<ReadOutcome<number>> {
  const params = new URLSearchParams({ lowStock: "true", page: "1", pageSize: "1" });
  return readRequest<ProductListPayload>(
    `${INVENTORY_ENDPOINTS.products}?${params.toString()}`,
    signal,
    "The low stock count did not load",
  ).then((outcome) => (outcome.kind === "ok" ? { kind: "ok", data: outcome.data.total } : outcome));
}

/**
 * A known set of products, for the cycle-count review to put a peso value on
 * each variance. `CountLineDto` carries no cost and the list endpoint has no
 * `ids` filter, so this reads them one at a time and stops after `limit` so a
 * badly-drifted count cannot turn the review step into fifty requests.
 *
 * Capped deliberately: the review screen degrades to unit differences plus the
 * server's own total rather than hanging. It says so when that happens.
 */
export async function fetchProductsByIds(
  ids: readonly string[],
  signal?: AbortSignal,
  limit = 25,
): Promise<ReadOutcome<ProductDto[]>> {
  const wanted = Array.from(new Set(ids)).slice(0, Math.max(1, limit));
  if (wanted.length === 0) return { kind: "ok", data: [] };

  const outcomes = await Promise.all(wanted.map((id) => fetchProduct(id, signal)));

  const products: ProductDto[] = [];
  let anyFailed = false;
  for (const outcome of outcomes) {
    if (outcome.kind === "ok") products.push(outcome.data);
    else if (outcome.kind !== "offline") anyFailed = true;
  }

  if (products.length === 0 && anyFailed) {
    return {
      kind: "error",
      title: "The cost of the counted lines did not load",
      message: "Stock was not changed. The unit differences are still correct; the peso values are not shown.",
      code: "COSTS_UNAVAILABLE",
      httpStatus: 502,
      retryable: true,
    };
  }

  return { kind: "ok", data: products };
}

export function fetchProduct(id: string, signal?: AbortSignal): Promise<ReadOutcome<ProductDto>> {
  return readRequest<ProductDto>(INVENTORY_ENDPOINTS.product(id), signal, "This product did not load");
}

/**
 * Catalogue edits that are not stock movements — today only the reorder level.
 * It is a `PATCH` on the product, deliberately NOT a movement: raising a reorder
 * point moves no stock and must not appear in the ledger.
 */
export function patchProduct(
  id: string,
  input: Omit<UpdateProductInput, "id">,
  signal?: AbortSignal,
): Promise<ReadOutcome<ProductDto>> {
  return patchRequest<ProductDto>(
    INVENTORY_ENDPOINTS.product(id),
    input,
    signal,
    "That change did not save",
  );
}

// ── Movements ────────────────────────────────────────────────────────────────

export function fetchMovements(
  query: MovementQuery,
  signal?: AbortSignal,
): Promise<ReadOutcome<MovementListPayload>> {
  const params = new URLSearchParams();
  if (query.productId) params.set("productId", query.productId);
  if (query.bookingId) params.set("bookingId", query.bookingId);
  if (query.kind) params.set("kind", query.kind);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 25));

  return readRequest<MovementListPayload>(
    `${INVENTORY_ENDPOINTS.movements}?${params.toString()}`,
    signal,
    "The movement history did not load",
  );
}

/**
 * The single stock write.
 *
 * NO OPTIMISTIC UI. This returns only what the server confirmed — the movement
 * row and the `onHand`/`reserved`/`available` triple it left behind. A caller
 * that wants to update a number does it from `result.stock`, never from the
 * quantity it asked for. A mechanic acting on a phantom number is how stock
 * becomes fiction.
 */
export async function postMovement(
  input: PostMovementInput,
  signal?: AbortSignal,
): Promise<MovementOutcome> {
  const raw = await request(INVENTORY_ENDPOINTS.movement, {
    method: "POST",
    body: JSON.stringify(input),
    ...(signal !== undefined ? { signal } : {}),
  });

  if ("kind" in raw) return { kind: "offline" };

  const refusal = readRefusal(raw.body);
  if (refusal !== null) return { kind: "refused", refusal };

  if (raw.httpStatus >= 200 && raw.httpStatus < 300) {
    const data = readData<PostMovementResult>(raw);
    if (data !== undefined) return { kind: "ok", result: data };
  }

  const described = describeError(raw, "That stock change did not save");
  return {
    kind: "error",
    title: described.title,
    message: described.message,
    code: described.code,
    httpStatus: described.httpStatus,
  };
}

// ── Cycle counts ─────────────────────────────────────────────────────────────

export function fetchCounts(signal?: AbortSignal): Promise<ReadOutcome<{ counts: StockCountDto[] }>> {
  return readRequest<{ counts: StockCountDto[] }>(INVENTORY_ENDPOINTS.counts, signal, "The count list did not load");
}

export function createCount(
  input: CreateCountInput,
  signal?: AbortSignal,
): Promise<ReadOutcome<StockCountDto>> {
  return writeRequest<StockCountDto>(INVENTORY_ENDPOINTS.counts, input, signal, "That count did not start");
}

export function fetchCount(id: string, signal?: AbortSignal): Promise<ReadOutcome<StockCountDto>> {
  return readRequest<StockCountDto>(INVENTORY_ENDPOINTS.count(id), signal, "This stock count did not load");
}

/**
 * Records one counted line. Returns the server's own `CountLineDto`, including
 * the variance and `isSignificant` it computed — the counting screen applies THAT
 * and never its own guess.
 */
export function recordCountLine(
  input: RecordCountInput,
  signal?: AbortSignal,
): Promise<ReadOutcome<CountLineDto>> {
  return writeRequest<CountLineDto>(INVENTORY_ENDPOINTS.countLines, input, signal, "That line did not save");
}

/** Posts a reviewed count. Irreversible — the ledger rows it writes stay forever. */
export function postCount(id: string, signal?: AbortSignal): Promise<ReadOutcome<StockCountDto>> {
  return writeRequest<StockCountDto>(INVENTORY_ENDPOINTS.countPost(id), {}, signal, "That count did not post");
}

// ── Reorder and ageing ───────────────────────────────────────────────────────

export type ReorderSort = "urgency" | "cost" | "sku";

export function fetchReorder(
  sort: ReorderSort,
  dir: SortDir,
  signal?: AbortSignal,
): Promise<ReadOutcome<{ rows: ReorderRowDto[] }>> {
  const params = new URLSearchParams({ sort, dir });
  return readRequest<{ rows: ReorderRowDto[] }>(
    `${INVENTORY_ENDPOINTS.reorder}?${params.toString()}`,
    signal,
    "The reorder list did not load",
  );
}

/**
 * Everything worth watching for age: tyres carrying a DOT code, plus anything
 * with a shelf life. Filtering is the client's job here because both facts are
 * already on `ProductDto` and inventing a server DTO for a screen this size
 * would be a contract change nobody asked for.
 */
export function fetchAging(signal?: AbortSignal): Promise<ReadOutcome<{ products: ProductDto[] }>> {
  return readRequest<{ products: ProductDto[] }>(
    INVENTORY_ENDPOINTS.aging,
    signal,
    "The ageing watch list did not load",
  );
}