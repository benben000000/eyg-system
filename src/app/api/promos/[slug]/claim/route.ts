/**
 * POST /api/promos/[slug]/claim — CLAIM AN OFFER
 * ============================================================================
 * Funnel Lane C: someone arrived from a promo and wants the deal held for them.
 * Creates a `PromoClaim`, increments `claimCount`, and enqueues a `PROMO_BLURB`
 * notification carrying the offer **and its terms**.
 *
 * DEFENCE IN DEPTH
 *   1. Rate limit — 5/hour per IP, tighter than a general lead. A claim fires an
 *      SMS, so it must not be a cheap way to text arbitrary numbers.
 *   2. Zod validation — exactly the `PromoClaimInput` shape from
 *      `src/lib/types.ts`. Unknown fields are stripped, not forwarded.
 *   3. Honeypot (`website`).
 *   4. Min time to submit.
 *   5. Captcha — required. This endpoint always messages a third party, so it
 *      is the one place we do not make the captcha conditional on the kind.
 *
 * LIVE CHECK
 * ----------
 * A claim on an expired, pre-armed or deactivated promo is a `409 CONFLICT` with
 * `details: { promoStatus }` so the UI can say "that offer ended" rather than
 * "something went wrong". This is deliberate: quietly accepting a claim on a
 * dead promo creates a promise the counter cannot honour.
 *
 * TERMS ARE MANDATORY IN THE RESPONSE
 * -----------------------------------
 * `terms` is returned in the body of the 201 and is also pushed into the
 * notification. `notifyPromoBlurb` refuses to build a message without them.
 *
 * @see docs/ops/INTEGRATIONS.md § Promotions
 */

import { ApiError, notFound } from "@/lib/errors";
import { captchaProvider, verifyCaptcha } from "@/lib/captcha";
import { isValidEmail, isValidPhPhone, normalisePhone,  formatPeso } from "@/lib/utils";
import { z } from "zod";

import {
  checkBotSignals,
  failWith,
  guard,
  parseJsonBody,
  readBody,
} from "@/lib/integrations/api";
import { withDb } from "@/lib/integrations/db";
import { notifyPromoBlurb } from "@/lib/integrations/notify";
import { rateLimitHeaders } from "@/lib/integrations/rate-limit";
import { buildWhatsAppLink } from "@/lib/integrations/whatsapp";
import { log } from "@/lib/logger";
import { created } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/promos/claim" });

// ── Params (Next 15 hands route params over as a Promise) ────────────────────

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const claimSchema = z.object({
  name: z.string().trim().min(1, "Please tell us your name.").max(80, "That name is too long."),
  phone: z
    .string()
    .trim()
    .min(7, "That phone number looks too short.")
    .max(24, "That phone number looks too long.")
    .refine((v) => isValidPhPhone(v), "Please enter a Philippine mobile number, e.g. 0917 123 4567."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .refine((v) => v === "" || isValidEmail(v), "Please check that email address.")
    .optional(),
  website: z.string().max(200).optional(),
  captchaToken: z.string().max(400).optional(),
  captchaAnswer: z.number().int().optional(),
  renderedAt: z.number().int().nonnegative().optional(),
});

type ClaimBody = z.infer<typeof claimSchema>;

interface PromoRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  kind: "PERCENT_OFF" | "FIXED_OFF" | "BUNDLE" | "CLEARANCE" | "SEASONAL" | "TIRES";
  code: string | null;
  valuePct: number | null;
  valueOff: number | null;
  terms: string[];
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  claimCount: number;
  priority: number;
}

export type PromoStatus = "live" | "upcoming" | "expired" | "inactive";

export interface PromoClaimDto {
  slug: string;
  title: string;
  valueLabel: string;
  /** MANDATORY. Always non-empty. */
  terms: string[];
  promoStatus: PromoStatus;
  /** Where the customer goes next. Carries the code so the booking applies it. */
  bookUrl: string;
  whatsappLink: string;
  message: string;
  /** `true` when the blurb actually went out; `false` when it was recorded as skipped. */
  notified: boolean;
}

function statusOf(row: PromoRow, now: Date): PromoStatus {
  if (!row.isActive) return "inactive";
  const t = now.getTime();
  if (row.startsAt !== null && row.startsAt.getTime() > t) return "upcoming";
  if (row.endsAt !== null && row.endsAt.getTime() < t) return "expired";
  return "live";
}

function valueLabelOf(row: PromoRow): string {
  if (row.valuePct !== null && row.valuePct > 0) return `${row.valuePct}% off`;
  if (row.valueOff !== null && row.valueOff > 0) return `${formatPeso(row.valueOff)} off`;
  return row.kind === "BUNDLE" ? "Bundle price" : "Ask us for the price";
}

export async function POST(req: Request, route: RouteContext): Promise<Response> {
  const { ctx, denied, guard: limit } = await guard(req, "promos.claim", "promoClaim");
  if (denied) return denied;

  try {
    const params = await route.params;
    const slug = params.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw notFound("We could not find that offer.");

    let body: ClaimBody;
    try {
      const raw = await readBody(req, 16 * 1024);
      body = parseJsonBody(raw, claimSchema);
    } catch (error) {
      return failWith(
        ApiError.is(error) ? error : new ApiError("VALIDATION_ERROR", "Please check the highlighted fields."),
        ctx,
        rateLimitHeaders(limit),
      );
    }

    // ── Anti-bot: all three layers, always ─────────────────────────────────
    checkBotSignals(body.website, body.renderedAt ?? ctx.renderedAt);
    await verifyCaptcha(
      {
        ...(body.captchaToken !== undefined ? { token: body.captchaToken } : {}),
        ...(body.captchaAnswer !== undefined ? { answer: body.captchaAnswer } : {}),
        renderedAt: body.renderedAt ?? ctx.renderedAt,
        website: body.website,
        requestId: ctx.requestId,
      },
      ctx.ip,
    );

    // ── Load the promo ──────────────────────────────────────────────────────
    const promo = await withDb<PromoRow | null>(
      (db) =>
        db.promotion.findUnique({
          where: { slug },
          select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            kind: true,
            code: true,
            valuePct: true,
            valueOff: true,
            terms: true,
            isActive: true,
            startsAt: true,
            endsAt: true,
            claimCount: true,
            priority: true,
          },
        }),
      null,
      { event: "promos.claim_load" },
    );

    if (!promo) throw notFound("We could not find that offer.");

    const now = new Date();
    const promoStatus = statusOf(promo, now);
    if (promoStatus !== "live") {
      logger.info("promos.claim_rejected", { slug, promoStatus });
      throw new ApiError("CONFLICT", "That offer is not running right now.", {
        details: { promoStatus },
      });
    }

    // ── Terms are mandatory. This is the field we refuse to omit. ──────────
    const terms =
      promo.terms.length > 0
        ? promo.terms
        : ["Ask us for the full terms before you book. Prices are confirmed after inspection."];
    const valueLabel = valueLabelOf(promo);

    const phone = normalisePhone(body.phone);
    const emailAddress = body.email && body.email.length > 0 ? body.email : null;

    // ── Persist + increment, in one transaction-ish sequence ────────────────
    // `updateMany` with the status guard makes the counter increment safe
    // against a promo being deactivated between the read and the write.
    const claimId = await withDb<string | null>(
      async (db) => {
        const claim = await db.promoClaim.create({
          data: { promotionId: promo.id, name: body.name, phone, email: emailAddress },
          select: { id: true },
        });
        await db.promotion.updateMany({ where: { id: promo.id, isActive: true }, data: { claimCount: { increment: 1 } } });
        return claim.id;
      },
      null,
      { event: "promos.claim_create" },
    );

    if (claimId === null) {
      logger.error("promos.claim_persist_failed", { slug, action: "still sending the blurb" });
    }

    // ── Notify. Never throws. ──────────────────────────────────────────────
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const bookUrl = `${siteUrl}/book${promo.code ? `?promo=${encodeURIComponent(promo.code)}` : ""}`;

    const result = await notifyPromoBlurb(
      {
        slug: promo.slug,
        title: promo.title,
        valueLabel,
        endsAt: promo.endsAt,
        terms,
      },
      {
        name: body.name,
        phone,
        email: emailAddress,
        // A claim form is an explicit request for information about this offer.
        // That is opt-in for THIS offer; it is not blanket marketing consent,
        // so we pass it explicitly and the template still carries the opt-out.
        consentMarketing: true,
        consentSms: true,
        recipientSuppliedByCustomer: true,
      },
    );

    logger.info("promos.claimed", {
      slug,
      promoStatus,
      persisted: claimId !== null,
      notified: result.sent,
      channels: result.outcomes.map((o) => `${o.channel}:${o.status}`).join(","),
    });

    const data: PromoClaimDto = {
      slug: promo.slug,
      title: promo.title,
      valueLabel,
      terms,
      promoStatus,
      bookUrl,
      whatsappLink: result.whatsappLink || buildWhatsAppLink(`Hi EYG! I want to claim "${promo.title}".`),
      message: `Noted — we will hold "${promo.title}" for you. Mention it at the counter or book online.`,
      notified: result.sent,
    };

    return created(data, ctx.meta, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    if (ApiError.is(error)) return failWith(error, ctx, rateLimitHeaders(limit));
    logger.error("promos.claim_failed", {}, { err: error });
    return failWith(new ApiError("INTERNAL_ERROR", "We could not hold that offer right now. Please call the shop.", { retryAfter: 30 }), ctx);
  }
}

/**
 * `GET` on a claim URL is a person who followed an old link. Rather than a 405
 * with a dead end, send them to the offer itself.
 */
export async function GET(_req: Request, route: RouteContext): Promise<Response> {
  const params = await route.params;
  const slug = params.slug.trim().toLowerCase();
  return Response.json(
    {
      ok: true,
      data: { slug, next: `/deals#${encodeURIComponent(slug)}`, captchaProvider: captchaProvider() },
    },
    { status: 200, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
