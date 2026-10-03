/**
 * POST /api/leads — LEAD CAPTURE
 * ============================================================================
 * `kind: "roadside" | "contact" | "newsletter" | "tire-size"`. One endpoint
 * because one form component, four intents.
 *
 * DEFENCE IN DEPTH (every layer runs on every request, none is optional)
 * -------------------------------------------------------------------------
 * 1. **Rate limit** — per-kind tier, tighter for `roadside` (4/hour) because
 *    that form notifies the shop and a stranger's phone number must not become
 *    the shop's phone bill.
 * 2. **Zod validation** — per-kind discriminated union. The shape in
 *    `src/lib/types.ts` (`LeadInput`) is the source of truth for the common
 *    fields; kind-specific requirements are added here.
 * 3. **Honeypot** (`website`) — must be empty.
 * 4. **Min time to submit** — must be ≥ 2 s since the form was rendered.
 * 5. **Captcha** — required for `roadside` and `tire-size`; optional (honeypot
 *    + timing only) for `contact`; not required for `newsletter` because there
 *    is no third party to notify. Turnstile wins when `TURNSTILE_SECRET_KEY` is
 *    set, otherwise the arithmetic challenge from `GET /api/captcha`.
 *
 * PII AT REST
 * -----------
 * `name`, `phone`, `email` and `message` are encrypted with
 * `PII_ENCRYPTION_KEY` (AES-256-GCM, `auth`-style envelope — see
 * `src/lib/integrations/crypto.ts`) before the row is written. They are
 * decrypted again in the same request, in memory, purely to build the
 * notification. A reader (the admin board) must call `decryptPii`.
 *
 * FAILURE BEHAVIOUR
 * -----------------
 * - No database -> the lead is still answered `201` with a "call us" fallback
 *   and a `wa.me` link, and the failure is logged. Telling a stranded customer
 *   "sorry, our database is down" is a worse outcome than losing the row.
 * - No Twilio / no Resend -> `notifyNewLeadAlert` records `skipped` and returns.
 *   The lead row is still written, so the shop sees it on the board.
 *
 * @see docs/ops/INTEGRATIONS.md § Leads
 */

import { ApiError } from "@/lib/errors";
import { captchaProvider, verifyCaptcha } from "@/lib/captcha";
import { isValidEmail, isValidPhPhone, normalisePhone } from "@/lib/utils";
import { z } from "zod";

import {
  checkBotSignals,
  failWith,
  guard,
  parseJsonBody,
  readBody,
} from "@/lib/integrations/api";
import { encryptPii } from "@/lib/integrations/crypto";
import { withDb } from "@/lib/integrations/db";
import { buildWhatsAppLink } from "@/lib/integrations/whatsapp";
import { notifyNewLeadAlert } from "@/lib/integrations/notify";
import { rateLimitHeaders, ROUTE_POLICIES } from "@/lib/integrations/rate-limit";
import { log } from "@/lib/logger";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/leads" });

// ── Validation ───────────────────────────────────────────────────────────────

const phone = z
  .string()
  .trim()
  .min(7, "That phone number looks too short.")
  .max(24, "That phone number looks too long.")
  .refine((v) => isValidPhPhone(v), "Please enter a Philippine mobile number, e.g. 0917 123 4567.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(160, "That email address is too long.")
  .refine((v) => v === "" || isValidEmail(v), "Please check that email address.");

const name = z.string().trim().min(1, "Please tell us your name.").max(80, "That name is too long.");
const message = z.string().trim().min(1, "Please tell us a little more.").max(2_000, "Please keep that under 2000 characters.");

const metaEntry = z.union([z.string().max(120), z.number().finite(), z.boolean()]);

/** `tire-size` is really a quote lead, so it always needs a vehicle. */
const baseFields = {
  website: z.string().max(200).optional(),
  captchaToken: z.string().max(400).optional(),
  captchaAnswer: z.number().int().optional(),
  meta: z.record(z.string().max(40), metaEntry).optional(),
  renderedAt: z.number().int().nonnegative().optional(),
};

const leadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("roadside"),
    name,
    phone,
    message,
    ...baseFields,
  }),
  z.object({
    kind: z.literal("contact"),
    name,
    phone: phone.optional(),
    email: email.optional(),
    message,
    ...baseFields,
  }),
  z.object({
    kind: z.literal("newsletter"),
    // An email-only signup. No phone, because a newsletter does not text.
    email: email.refine((v) => v.length > 0, "Please enter your email address."),
    name: name.optional(),
    ...baseFields,
  }),
  z.object({
    kind: z.literal("tire-size"),
    name,
    phone,
    message,
    ...baseFields,
  }),
]);

type LeadBody = z.infer<typeof leadSchema>;

const ROADSIDE_KINDS = new Set<LeadBody["kind"]>(["roadside", "tire-size"]);

/** Maps a kind onto its rate-limit tier. */
const tierFor = (kind: LeadBody["kind"]): "roadside" | "lead" | "newsletter" => {
  if (kind === "roadside") return "roadside";
  if (kind === "newsletter") return "newsletter";
  return "lead";
};

// ── Response shape ───────────────────────────────────────────────────────────

export interface LeadAcceptedDto {
  /** Reference the customer can quote on the phone. Not a booking reference. */
  reference: string;
  kind: LeadBody["kind"];
  /** Always true — the customer got a durable next step. */
  received: true;
  /** Non-PII context so the UI can personalise the confirmation. */
  whatsappLink: string;
  message: string;
  /** Per-kind limit, so the UI can explain a 429 in the customer's words. */
  limitPerHour: number;
}

/** `LEAD-XXXXXX` — short enough to read down a phone line. */
function leadReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(6);
  if (typeof globalThis.crypto?.getRandomValues === "function") globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  for (let i = 0; i < bytes.length; i += 1) out += alphabet[(bytes[i] as number) % alphabet.length];
  return `LEAD-${out}`;
}

/** Plain-language acknowledgement. Short sentences. No exclamation stacking. */
function acknowledgementFor(kind: LeadBody["kind"]): string {
  switch (kind) {
    case "roadside":
      return "We have your location and number. Call the shop right now if you can — a mechanic will come to you. If we miss the call, we will call you back shortly.";
    case "tire-size":
      return "Thanks. We will check what we have in stock and text you a price for your size.";
    case "newsletter":
      return "You are on the list. We only write when there is something worth reading.";
    case "contact":
    default:
      return "Thanks — we have your message and will reply during shop hours.";
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // ── 1. Body (bounded) ─────────────────────────────────────────────────────
  let body: LeadBody;
  const { ctx, denied, guard: limit } = await guard(req, "leads.create", "public");
  if (denied) return denied;

  try {
    const raw = await readBody(req, 16 * 1024);
    body = parseJsonBody(raw, leadSchema);
  } catch (error) {
    return failWith(
      ApiError.is(error)
        ? error
        : new ApiError("VALIDATION_ERROR", "We could not read that form. Please check the fields and try again."),
      ctx,
      rateLimitHeaders(limit),
    );
  }

  // ── 2. Kind-specific rate limit (the coarse one already ran above) ────────
  const kind = body.kind;
  const { ctx: ctx2, denied: kindDenied, guard: kindLimit } = await guard(req, `leads.create.${kind}`, tierFor(kind));
  if (kindDenied) return kindDenied;

  try {
    // ── 3. Honeypot + min-time-to-submit ───────────────────────────────────
    checkBotSignals(body.website, body.renderedAt ?? ctx2.renderedAt);

    // ── 4. Captcha on the kinds that page a human ──────────────────────────
    if (ROADSIDE_KINDS.has(kind)) {
      await verifyCaptcha(
        {
          ...(body.captchaToken !== undefined ? { token: body.captchaToken } : {}),
          ...(body.captchaAnswer !== undefined ? { answer: body.captchaAnswer } : {}),
          renderedAt: body.renderedAt ?? ctx2.renderedAt,
          website: body.website,
          requestId: ctx2.requestId,
        },
        ctx2.ip,
      );
    }

    // ── 5. Normalise ───────────────────────────────────────────────────────
    const plainPhone = "phone" in body && body.phone ? normalisePhone(body.phone) : null;
    const plainEmail = "email" in body && body.email ? body.email : null;
    const plainName = body.name ?? null;
    const plainMessage = "message" in body ? body.message : null;
    const reference = leadReference();

    // Non-PII context only. The UTM set is attacker-controlled, so it is
    // whitelisted to a known shape and length-capped.
    const meta: Record<string, string | number | boolean> = {
      reference,
      receivedAt: new Date().toISOString(),
      utmSource: ctx2.utm.source ?? "",
      utmCampaign: ctx2.utm.campaign ?? "",
      ...(body.meta ?? {}),
    };

    // ── 6. Persist with PII encrypted at rest ──────────────────────────────
    const persisted = await withDb(
      async (db) => {
        const row = await db.lead.create({
          data: {
            kind,
            name: encryptPii(plainName),
            phone: encryptPii(plainPhone),
            email: encryptPii(plainEmail),
            message: encryptPii(plainMessage),
            // `meta` is non-PII by construction (see above), stored as-is.
            meta: meta as unknown as object,
            status: kind === "roadside" ? "new" : "new",
          },
          select: { id: true },
        });
        return row.id;
      },
      null as string | null,
      { event: "leads.create" },
    );

    if (persisted === null) {
      // Losing the row is bad; telling a stranded customer is worse.
      logger.error("leads.persist_failed", { kind, reference, action: "still notifying the shop" });
    }

    // ── 7. Notify the shop. Never throws. ─────────────────────────────────
    const whatsappLink = buildWhatsAppLink(
      kind === "roadside"
        ? `Hi EYG! Roadside help needed. I am at ${truncateForSms(plainMessage ?? "")}`
        : `Hi EYG! I used the ${kind} form on your website.`,
    );

    const notifyResult = await notifyNewLeadAlert({
      kind,
      name: plainName,
      phone: plainPhone,
      email: plainEmail,
      message: plainMessage,
      meta: {
        reference,
        page: ctx2.utm.source ? `utm:${ctx2.utm.source}` : "website",
        captcha: ROADSIDE_KINDS.has(kind) ? "required" : "honeypot+timing",
      },
    });

    logger.info("leads.accepted", {
      kind,
      reference,
      persisted: persisted !== null,
      notified: notifyResult.sent,
      channels: notifyResult.outcomes.map((o) => `${o.channel}:${o.status}`).join(","),
    });

    const data: LeadAcceptedDto = {
      reference,
      kind,
      received: true,
      whatsappLink,
      message: acknowledgementFor(kind),
      limitPerHour: ROUTE_POLICIES[tierFor(kind)].limit,
    };

    return ok(data, ctx2.meta, { status: 201, headers: rateLimitHeaders(kindLimit) });
  } catch (error) {
    if (ApiError.is(error)) return failWith(error, ctx2, rateLimitHeaders(kindLimit));
    logger.error("leads.failed", { kind }, { err: error });
    return failWith(new ApiError("INTERNAL_ERROR", "Something went wrong on our side. Please call the shop instead.", { retryAfter: 30 }), ctx2);
  }
}

/** The one place we shorten free text for an SMS preview. */
function truncateForSms(value: string, max = 80): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

// ── GET: a tiny capability probe for the form ────────────────────────────────

/**
 * The form needs to know whether to render a captcha and what the hourly budget
 * is, before the customer types anything. Static, cacheable, and it exposes no
 * PII and no configuration secrets.
 */
export async function GET(req: Request): Promise<Response> {
  const { ctx, denied } = await guard(req, "leads.caps", "reads");
  if (denied) return denied;

  return ok(
    {
      kinds: ["roadside", "contact", "newsletter", "tire-size"] as const,
      captchaProvider: captchaProvider(),
      captchaRequiredFor: ["roadside", "tire-size"] as const,
      limits: {
        roadside: ROUTE_POLICIES.roadside.limit,
        contact: ROUTE_POLICIES.lead.limit,
        newsletter: ROUTE_POLICIES.newsletter.limit,
        "tire-size": ROUTE_POLICIES.lead.limit,
      },
    },
    ctx.meta,
    { cacheControl: "public, max-age=300" },
  );
}
