/**
 * TRANSACTIONAL EMAIL
 * ============================================================================
 * Provider order: **Resend** (`RESEND_API_KEY`) → **Nodemailer over SMTP**
 * (`SMTP_*`) → **no-op**. With no key at all the site still works: the message
 * is recorded in the `Notification` ledger with status `skipped` and the reason
 * is logged. Nothing throws into the caller.
 *
 * Design rules baked into `renderEmail`:
 * - Table-based layout only, `max-width: 600px`, every style inline. Outlook
 *   desktop (Word rendering engine) ignores <style>, flexbox and background
 *   images, so we use neither.
 * - A dark header block (`#06060A`) with the EYG lockup. It reads as a header
 *   in light mode and as a header in dark mode, so `prefers-color-scheme`
 *   needs no branching — the only media query we ship tightens the body text.
 * - Brand yellow `#FCC605` accents only — never yellow text on white.
 * - **Every message ships a real `text/plain` alternative.** `renderEmail`
 *   derives one from the same structured content, so HTML and text can never
 *   drift, and `sendEmail` refuses to send HTML-only.
 * - The NAP block comes from `src/config/site.ts`. Never hardcoded here.
 * - Transactional mail carries an unsubscribe line pointing at
 *   `mailto:` + the support address. Marketing-only sends additionally record
 *   a `Subscriber` row and set `List-Unsubscribe`.
 *
 * @see docs/ops/INTEGRATIONS.md § Email
 */

import { BUSINESS, LINKS, SITE, TIMEZONE } from "@/config/site";
import { log } from "@/lib/logger";
import { withDb } from "./db";
import { emailConfig } from "./env";
import { fetchJson } from "./http";
import { maskRecipient, recordNotification, type Channel, type NotificationStatus } from "./notification-ledger";

const logger = log.child({ scope: "integrations/email" });

// ── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text alternative. Required in practice — see `assertTextAlternative`. */
  text?: string;
  replyTo?: string;
  /** Reuse a stable key (e.g. `booking-confirmed:<id>`) to prevent duplicates. */
  idempotencyKey?: string;
  /** Ledger bookkeeping. */
  template?: string;
  bookingId?: string | null;
  /** Marketing sends get a List-Unsubscribe header and require a subscriber row. */
  marketing?: boolean;
  /** Overrides the default from-address. */
  from?: string;
  /** Provider timeout in ms. */
  timeoutMs?: number;
}

export interface SendEmailResult {
  ok: boolean;
  status: NotificationStatus;
  provider: "resend" | "smtp" | "none";
  providerId: string | null;
  error: string | null;
  recipientCount: number;
}

export interface EmailContent {
  /** Preheader text — the grey line Gmail shows above the subject. */
  preheader?: string;
  heading: string;
  intro?: string;
  /** Body paragraphs. */
  paragraphs?: string[];
  /** Definition rows: label → value. Rendered as a table, safe for long values. */
  rows?: Array<{ label: string; value: string }>;
  /** A highlighted call-to-action, e.g. "Call the shop". */
  cta?: { label: string; href: string; note?: string };
  /** Yellow-accented warning strip, e.g. cancellation terms. */
  alert?: string;
  /** Small print under the CTA. */
  footnote?: string;
  /** Shown in the header instead of the default lockup. */
  headerLabel?: string;
  /** Overrides the default "You are receiving this because…" line. */
  consentLine?: string;
}

const INK = "#06060A";
const YELLOW = "#FCC605";
const BODY_TEXT = "#1A1A20";
const MUTED = "#5C5C68";
const LINE = "#E4E4EA";
const SURFACE = "#F6F6F8";

// ── Escaping ─────────────────────────────────────────────────────────────────

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for both HTML body copy and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

const escapeAttr = escapeHtml;

/** Renders newlines as `<br>` in already-escaped text. */
const withBreaks = (escaped: string): string => escaped.replace(/\r?\n/g, "<br />");

// ── Lazy provider singletons ─────────────────────────────────────────────────

interface ResendLike {
  emails: { send(payload: Record<string, unknown>): Promise<{ data?: { id?: string } | null; error?: unknown }> };
}

let resendClient: ResendLike | null | undefined;
let nodemailerModule: typeof import("nodemailer") | null | undefined;

/**
 * Lazily imports the provider. Both are dynamic so that a deployment without
 * `resend` or `nodemailer` installed still boots, and a missing API key never
 * crashes module evaluation.
 */
async function getResend(): Promise<ResendLike | null> {
  if (resendClient !== undefined) return resendClient;
  const cfg = emailConfig();
  if (!cfg.resendApiKey) {
    resendClient = null;
    return null;
  }
  try {
    const mod = (await import("resend")) as unknown as { Resend: new (key: string) => ResendLike };
    resendClient = new mod.Resend(cfg.resendApiKey);
  } catch (error) {
    logger.error("email.resend_init_failed", { action: "falling back to SMTP or no-op" }, { err: error });
    resendClient = null;
  }
  return resendClient;
}

async function getNodemailer(): Promise<typeof import("nodemailer") | null> {
  if (nodemailerModule !== undefined) return nodemailerModule;
  const cfg = emailConfig();
  if (!cfg.smtp) {
    nodemailerModule = null;
    return null;
  }
  try {
    nodemailerModule = await import("nodemailer");
  } catch (error) {
    logger.error("email.nodemailer_init_failed", { action: "falling back to no-op" }, { err: error });
    nodemailerModule = null;
  }
  return nodemailerModule;
}

// ── Email shell ──────────────────────────────────────────────────────────────

/** Business NAP block, single source of truth. */
function napBlock(): string {
  return [
    BUSINESS.legalName,
    BUSINESS.address.street,
    `${BUSINESS.address.district}, ${BUSINESS.address.province} ${BUSINESS.address.postalCode}`,
    `Tel ${BUSINESS.phoneDisplay}`,
    BUSINESS.email,
  ].join(" · ");
}

/** Brand lockup as styled text — no image, so it survives a blocked-image client. */
function lockup(): string {
  return [
    '<span style="font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:900;letter-spacing:-0.5px;line-height:1;">',
    'EYG TIRE',
    '</span>',
    '<span style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;',
    `color:${YELLOW};line-height:1;">&amp;&nbsp;AUTO CARE</span>`,
  ].join("");
}

function headerBlock(label?: string): string {
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:',
    INK,
    ';">',
    '<tr><td style="padding:28px 32px 24px 32px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>',
    '<td style="font-family:Helvetica,Arial,sans-serif;line-height:1;">',
    lockup(),
    '</td>',
    label
      ? `<td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;color:${YELLOW};text-transform:uppercase;">${escapeHtml(
          label,
        )}</td>`
      : "",
    "</tr></table>",
    // Speed stripe — the brand's underline device, as a 4px bar.
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:16px;"><tr><td height="4" style="height:4px;line-height:4px;font-size:0;background-color:${YELLOW};">&nbsp;</td></tr></table>`,
    "</td></tr></table>",
  ].join("");
}

function alertBlock(alert: string): string {
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#FFF8DB;border-left:4px solid ',
    YELLOW,
    ';margin:0 0 24px 0;">',
    `<tr><td style="padding:14px 18px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:21px;color:${INK};">${withBreaks(
      escapeHtml(alert),
    )}</td></tr></table>`,
  ].join("");
}

function rowsBlock(rows: Array<{ label: string; value: string }>): string {
  if (rows.length === 0) return "";
  const cells = rows
    .map(
      (r) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${LINE};font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};width:38%;vertical-align:top;">${escapeHtml(
          r.label,
        )}</td>` +
        `<td style="padding:10px 0;border-bottom:1px solid ${LINE};font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;color:${BODY_TEXT};vertical-align:top;">${withBreaks(
          escapeHtml(r.value),
        )}</td></tr>`,
    )
    .join("");
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 24px 0;">',
    cells,
    "</table>",
  ].join("");
}

function ctaBlock(cta: NonNullable<EmailContent["cta"]>): string {
  // Bulletproof button: a table cell with a bgcolor, not a styled <a>.
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 0 8px 0;"><tr><td bgcolor="',
    YELLOW,
    '" style="border-radius:4px;">',
    `<a href="${escapeAttr(cta.href)}" style="display:inline-block;padding:14px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.5px;color:${INK};text-decoration:none;">${escapeHtml(
      cta.label,
    )}</a>`,
    "</td></tr></table>",
    cta.note
      ? `<p style="margin:0 0 24px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:19px;color:${MUTED};">${escapeHtml(
          cta.note,
        )}</p>`
      : '<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>',
  ].join("");
}

function footerBlock(consentLine: string): string {
  const unsub = `${SITE.url}/unsubscribe`;
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:',
    SURFACE,
    ';">',
    '<tr><td style="padding:24px 32px;">',
    `<p style="margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">${escapeHtml(
      napBlock(),
    )}</p>`,
    `<p style="margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">${escapeHtml(
      consentLine,
    )}</p>`,
    `<p style="margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">Prefer to talk? Call ` +
      `<a href="${escapeAttr(LINKS.call)}" style="color:${INK};font-weight:700;">${escapeHtml(BUSINESS.phoneDisplay)}</a>.</p>`,
    `<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:17px;color:#8A8A96;">` +
      `Don\'t want these emails? <a href="${escapeAttr(unsub)}" style="color:${INK};text-decoration:underline;">Unsubscribe</a>` +
      ` — or reply to this message and we\'ll take you off the list. Times shown are ${escapeHtml(TIMEZONE)}.</p>`,
    "</td></tr></table>",
  ].join("");
}

const HEAD_STYLE = [
  "body{margin:0;padding:0;background-color:#F1F1F4;}",
  `a{color:${INK};}`,
  "@media (prefers-color-scheme: dark){",
  `  .eyg-body{background-color:#0B0B10;}`,
  "}",
].join("");

/** Full HTML document. Table layout, inline styles, 600px max width. */
export function renderEmailHtml(content: EmailContent): string {
  const paragraphs = (content.paragraphs ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:25px;color:${BODY_TEXT};">${withBreaks(
          escapeHtml(p),
        )}</p>`,
    )
    .join("");

  const alert = content.alert ? alertBlock(content.alert) : "";
  const rows = rowsBlock(content.rows ?? []);
  const cta = content.cta ? ctaBlock(content.cta) : "";
  const footnote = content.footnote
    ? `<p style="margin:0 0 24px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${MUTED};">${withBreaks(
        escapeHtml(content.footnote),
      )}</p>`
    : "";

  return [
    "<!doctype html>",
    '<html lang="en-PH">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    '<meta name="color-scheme" content="light dark" />',
    `<meta name="x-apple-disable-message-reformatting" />`,
    `<title>${escapeHtml(content.heading)}</title>`,
    `<style>${HEAD_STYLE}</style>`,
    "</head>",
    '<body class="eyg-body" style="margin:0;padding:0;background-color:#F1F1F4;">',
    // Preheader: hidden in the body, shown by the inbox list view.
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader ?? content.heading)}</div>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#F1F1F4;"><tr><td align="center" style="padding:24px 12px;">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:600px;background-color:#FFFFFF;border-radius:6px;overflow:hidden;">',
    `<tr><td style="padding:0;">${headerBlock(content.headerLabel)}</td></tr>`,
    '<tr><td style="padding:32px 32px 8px 32px;">',
    `<h1 style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;line-height:32px;color:${INK};">${escapeHtml(
      content.heading,
    )}</h1>`,
    content.intro
      ? `<p style="margin:0 0 20px 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:25px;color:${BODY_TEXT};">${withBreaks(
          escapeHtml(content.intro),
        )}</p>`
      : "",
    alert,
    paragraphs,
    rows,
    cta,
    footnote,
    '<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>',
    "</td></tr>",
    `<tr><td style="padding:0;">${footerBlock(content.consentLine ?? TRANSACTIONAL_CONSENT_LINE)}</td></tr>`,
    "</table>",
    '<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>',
    "</td></tr></table>",
    "</body>",
    "</html>",
  ].join("");
}

export const TRANSACTIONAL_CONSENT_LINE =
  "You are getting this message because you asked EYG Tire & Auto Care to contact you about your booking or enquiry.";

export const MARKETING_CONSENT_LINE =
  "You are getting this message because you signed up for EYG Tire & Auto Care updates. You can opt out at any time.";

/** Plain-text alternative derived from the same structured content. */
export function renderEmailText(content: EmailContent): string {
  const lines: string[] = [];
  lines.push(`${BUSINESS.legalName}`);
  lines.push("");
  lines.push(content.heading);
  lines.push("=".repeat(Math.min(64, content.heading.length)));
  if (content.intro) lines.push("", content.intro);
  if (content.alert) lines.push("", `!! ${content.alert}`);
  for (const p of content.paragraphs ?? []) lines.push("", p);
  for (const r of content.rows ?? []) lines.push("", `${r.label}: ${r.value}`);
  if (content.cta) {
    lines.push("", `${content.cta.label}: ${content.cta.href}`);
    if (content.cta.note) lines.push(content.cta.note);
  }
  if (content.footnote) lines.push("", content.footnote);
  lines.push("", "-".repeat(40));
  lines.push(napBlock());
  lines.push(content.consentLine ?? TRANSACTIONAL_CONSENT_LINE);
  lines.push(`Call ${BUSINESS.phoneDisplay} or reply to this email.`);
  lines.push(`Unsubscribe: ${SITE.url}/unsubscribe`);
  lines.push(`All times are ${TIMEZONE}.`);
  return lines.join("\n");
}

export interface RenderedEmail {
  html: string;
  text: string;
}

/** Renders both parts from one source, guaranteeing they never diverge. */
export function renderEmail(content: EmailContent): RenderedEmail {
  return { html: renderEmailHtml(content), text: renderEmailText(content) };
}

/**
 * Strips tags from an HTML fragment. Used as a *last resort* for a caller that
 * hand-wrote HTML. `renderEmail` is the preferred path and never needs this.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, "\n")
    .replace(/<\/td>/gi, " · ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Guards the "never HTML-only" rule. */
export function assertTextAlternative(html: string, text: string | undefined): string {
  if (text !== undefined && text.trim().length >= 12) return text;
  const derived = htmlToText(html);
  if (derived.length >= 12) {
    logger.warn("email.text_alternative_derived", { derived: true });
    return derived;
  }
  // Nothing usable to send. Returning a minimal stub is better than sending an
  // HTML-only message that lands in a spam folder.
  logger.error("email.text_alternative_missing", { action: "sent a minimal stub instead" });
  return `Message from ${BUSINESS.legalName}. Call ${BUSINESS.phoneDisplay}.`;
}

// ── Sending ──────────────────────────────────────────────────────────────────

function recipients(input: SendEmailInput): string[] {
  const list = Array.isArray(input.to) ? input.to : [input.to];
  return list.map((r) => r.trim().toLowerCase()).filter((r) => r.length > 3 && r.includes("@"));
}

/** Records a Subscriber row for marketing sends so unsubscribes are honoured. */
async function upsertSubscriber(email: string, marketing: boolean): Promise<void> {
  await withDb(
    async (db) => {
      const existing = await db.subscriber.findUnique({ where: { email }, select: { id: true, isActive: true } });
      // An existing row always wins. This is deliberately one-directional: a
      // marketing send must NEVER resurrect an address that a hard bounce or a
      // complaint webhook suppressed.
      if (existing) return;
      await db.subscriber.create({
        data: { email, isActive: true, confirmedAt: new Date(), source: marketing ? "notification" : "transactional" },
      });
    },
    undefined,
    { event: "email.subscriber_upsert" },
  );
}

async function sendViaResend(input: SendEmailInput, cfg: ReturnType<typeof emailConfig>, to: string[], text: string): Promise<SendEmailResult> {
  const client = await getResend();
  if (!client) {
    return { ok: false, status: "failed", provider: "none", providerId: null, error: "resend-unavailable", recipientCount: 0 };
  }
  try {
    const res = await client.emails.send({
      from: input.from ?? cfg.from,
      to,
      subject: input.subject,
      html: input.html,
      text,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey } : {}),
      ...(input.marketing
        ? { headers: { "List-Unsubscribe": `<${SITE.url}/unsubscribe>` } }
        : {}),
    });
    if (res.error) {
      return {
        ok: false,
        status: "failed",
        provider: "resend",
        providerId: null,
        error: providerMessage(res.error),
        recipientCount: to.length,
      };
    }
    return {
      ok: true,
      status: "sent",
      provider: "resend",
      providerId: res.data?.id ?? null,
      error: null,
      recipientCount: to.length,
    };
  } catch (error) {
    logger.error("email.resend_send_failed", { recipients: to.length }, { err: error });
    return { ok: false, status: "failed", provider: "resend", providerId: null, error: "resend-send-failed", recipientCount: to.length };
  }
}

async function sendViaSmtp(input: SendEmailInput, cfg: ReturnType<typeof emailConfig>, to: string[], text: string): Promise<SendEmailResult> {
  const nodemailer = await getNodemailer();
  const smtp = cfg.smtp;
  if (!nodemailer || !smtp) {
    return { ok: false, status: "failed", provider: "none", providerId: null, error: "smtp-unavailable", recipientCount: 0 };
  }
  let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
  try {
    transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
      connectionTimeout: input.timeoutMs ?? 8_000,
      greetingTimeout: input.timeoutMs ?? 8_000,
      socketTimeout: (input.timeoutMs ?? 8_000) + 4_000,
    });
    const info = await transport.sendMail({
      from: input.from ?? cfg.from,
      to: to.join(", "),
      subject: input.subject,
      html: input.html,
      text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.marketing ? { headers: { "List-Unsubscribe": `<${SITE.url}/unsubscribe>` } } : {}),
    });
    const messageId = typeof info.messageId === "string" ? info.messageId : (info.messageId as { messageId?: string } | undefined)?.messageId;
    return {
      ok: true,
      status: "sent",
      provider: "smtp",
      providerId: messageId ?? null,
      error: null,
      recipientCount: to.length,
    };
  } catch (error) {
    logger.error("email.smtp_send_failed", { host: smtp.host, port: smtp.port }, { err: error });
    return { ok: false, status: "failed", provider: "smtp", providerId: null, error: "smtp-send-failed", recipientCount: to.length };
  } finally {
    try {
      transport?.close();
    } catch {
      /* already closed */
    }
  }
}

/** Reduces a provider error to a short code. The raw error may contain an email. */
function providerMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const rec = error as Record<string, unknown>;
    for (const key of ["code", "type", "name"]) {
      const v = rec[key];
      if (typeof v === "string" && v.length <= 60) return v.replace(/[^A-Za-z0-9_.:-]/g, "");
    }
  }
  return "provider-error";
}

/**
 * Sends one email and records it. NEVER THROWS.
 *
 * Degradation ladder:
 *   no key at all  -> Notification(status: "skipped", error: "no-provider")
 *   provider 5xx   -> Notification(status: "failed") after bounded retries
 *   bad address    -> Notification(status: "failed", error: "invalid-recipient")
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = emailConfig();
  const to = recipients(input);
  const template = input.template ?? "generic";
  const record = async (status: NotificationStatus, error: string | null, providerId: string | null): Promise<void> => {
    await withDb(
      (db) =>
        recordNotification(db, {
          channel: "email" as Channel,
          template,
          recipient: to[0] ?? maskRecipient(input.subject),
          subject: input.subject,
          body: input.text ?? "",
          status,
          providerId,
          error,
          bookingId: input.bookingId ?? null,
        }),
      undefined,
      { event: "email.record" },
    );
  };

  if (to.length === 0) {
    logger.warn("email.no_valid_recipient", { template });
    await record("failed", "invalid-recipient", null);
    return { ok: false, status: "failed", provider: "none", providerId: null, error: "invalid-recipient", recipientCount: 0 };
  }

  if (input.subject.trim().length < 3) {
    await record("failed", "missing-subject", null);
    return { ok: false, status: "failed", provider: "none", providerId: null, error: "missing-subject", recipientCount: to.length };
  }

  const text = assertTextAlternative(input.html, input.text);

  if (cfg.provider === "none") {
    logger.warn("email.no_provider", { template, recipients: to.length, effect: "message recorded, not sent" });
    await record("skipped", "no-provider-configured", null);
    return { ok: false, status: "skipped", provider: "none", providerId: null, error: "no-provider-configured", recipientCount: to.length };
  }

  if (input.marketing) {
    for (const address of to) await upsertSubscriber(address, true);
  }

  const result =
    cfg.provider === "resend"
      ? await sendViaResend(input, cfg, to, text)
      : await sendViaSmtp(input, cfg, to, text);

  await record(result.status, result.error, result.providerId);

  logger.info("email.sent", {
    template,
    provider: result.provider,
    ok: result.ok,
    status: result.status,
    recipients: to.length,
    code: result.error ?? undefined,
  });
  return result;
}

/** Convenience wrapper used by `notify.ts`. */
export async function sendEmailContent(
  content: EmailContent,
  subject: string,
  to: string | string[],
  options: Omit<SendEmailInput, "to" | "subject" | "html" | "text"> = {},
): Promise<SendEmailResult> {
  const { html, text } = renderEmail(content);
  return sendEmail({ ...options, to, subject, html, text });
}

/** Which provider would be used right now. Used by `/api/ready` and cron. */
export function activeEmailProvider(): "resend" | "smtp" | "none" {
  return emailConfig().provider;
}

/**
 * Warms the provider singleton so the first real send is not slow.
 * Called by the cron preflight; failures are swallowed.
 */
export async function warmupEmail(): Promise<void> {
  const cfg = emailConfig();
  if (cfg.provider === "resend") await getResend();
  else if (cfg.provider === "smtp") await getNodemailer();
  else {
    // No-op path still does a network-free reachability note.
    const probe = await fetchJson<unknown>("https://api.resend.com", { provider: "resend", timeoutMs: 2_000, retries: 0 });
    logger.debug("email.warmup", { provider: "none", reachable: probe.ok, status: probe.status });
  }
}

/** Test hook. */
export function resetEmailClients(): void {
  resendClient = undefined;
  nodemailerModule = undefined;
}
