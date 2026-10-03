// @vitest-environment node
/**
 * QA & SECURITY AGENT — transactional email HTML shell.
 * ============================================================================
 * Contract under test: `renderEmail`, `renderEmailHtml`, `renderEmailText`,
 * `assertTextAlternative`, `escapeHtml` in `src/lib/integrations/email.ts`.
 *
 * Two or three booking emails a day go out from this shop. The shell has to
 * survive Gmail, Outlook (the Word engine — no flexbox, no grid) and a ₱3,000
 * Android mail client on 3G, and it has to carry the legally-required content:
 * the Data Privacy Act of 2012 (§12) and its implementing rules require the
 * controller's identity and the place of collection, and every message needs a
 * working opt-out.
 *
 * The NAP block is built from `src/config/site.ts` — it must never be restated
 * by hand, or it will drift from the Google Business Profile.
 * ============================================================================
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  assertTextAlternative,
  escapeHtml,
  htmlToText,
  renderEmail,
  renderEmailHtml,
  renderEmailText,
  type EmailContent,
} from "@/lib/integrations/email";
import { ADDRESS_ONE_LINE, BUSINESS, LINKS, SITE, TIMEZONE } from "@/config/site";

const SOURCE = readFileSync(
  join(resolve(fileURLToPath(new URL("../..", import.meta.url))), "src", "lib", "integrations", "email.ts"),
  "utf8",
);

const CONTENT: EmailContent = {
  preheader: "Wednesday 11 March, 9:00 AM. See you at EGSA Fourlanes.",
  heading: "Booking confirmed",
  intro: "Thanks — we have you down. Bring your plate and a valid ID.",
  paragraphs: ["If anything changes, call us and we will move it."],
  rows: [
    { label: "Reference", value: "EYG-7F3K9A" },
    { label: "Date", value: "Wednesday 11 March 2026" },
    { label: "Time", value: "9:00 AM" },
    { label: "Service", value: "PMS A (Oil + Filter)" },
  ],
  cta: { label: "View booking", href: "https://eygtireautocare.ph/book" },
  footnote: "All times are Asia/Manila.",
  alert: "Please arrive 10 minutes early.",
};

const rendered = () => renderEmail(CONTENT);

/** HTML-escaped form of a literal, for comparison against the HTML part. */
function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─────────────────────────────────────────────────────────────────────────────

describe("email-shell — table-based HTML", () => {
  it("uses a presentational table layout with Outlook-safe attributes", () => {
    const { html } = rendered();
    expect(html.toLowerCase()).toMatch(/<table[^>]*role="presentation"/);
    expect(html.toLowerCase()).toMatch(/cellpadding="0"/);
    expect(html.toLowerCase()).toMatch(/cellspacing="0"/);
    expect(html.toLowerCase()).toMatch(/border="0"/);
    expect(html.toLowerCase()).toMatch(/<table[^>]*width="600"/);
  });

  it("does not rely on flexbox or grid, which Outlook cannot render", () => {
    const { html } = rendered();
    expect(html).not.toMatch(/display:\s*flex/i);
    expect(html).not.toMatch(/display:\s*grid/i);
    expect(html).not.toMatch(/gap:\s*\d/i);
  });

  it("carries inline styles on the elements that matter", () => {
    const { html } = rendered();
    const styleCount = (html.match(/style="/g) ?? []).length;
    expect(styleCount, "inline styles are the only reliable path in email").toBeGreaterThan(20);
  });

  it("declares a document language, a charset and a <title>", () => {
    const { html } = rendered();
    expect(html).toMatch(/<html[^>]*lang="en-PH"/);
    expect(html).toMatch(/<meta charset="utf-8"/i);
    expect(html.toLowerCase()).toMatch(/<title>/);
    expect(html.toLowerCase()).toContain("<title>booking confirmed</title>");
  });

  it("contains no script, iframe, form or external stylesheet", () => {
    const { html } = rendered();
    expect(html.toLowerCase()).not.toMatch(/<script/);
    expect(html.toLowerCase()).not.toMatch(/<iframe/);
    expect(html.toLowerCase()).not.toMatch(/<form/);
    expect(html.toLowerCase()).not.toMatch(/<link[^>]+stylesheet/);
  });

  it("has no remote images at all (blocking images cost the open)", () => {
    const { html } = rendered();
    const remote = [...html.matchAll(/<img[^>]+src="((?:https?:)?\/\/[^"]+)"/gi)].map((m) => m[1]);
    expect(remote).toEqual([]);
  });

  it("the brand lockup is styled TEXT, not a logo image", () => {
    const { html } = rendered();
    expect(html).toContain("EYG TIRE");
    expect(html).toContain("AUTO CARE");
  });

  it("sets an explicit width/height on nothing that could shift (no images at all)", () => {
    const { html } = rendered();
    expect(html).not.toMatch(/<img/);
  });
});

describe("email-shell — plain-text alternative", () => {
  it("returns a non-empty text part", () => {
    const { text } = rendered();
    expect(typeof text).toBe("string");
    expect(text.trim().length).toBeGreaterThan(120);
  });

  it("mirrors every substantive fact from the HTML", () => {
    const { text } = rendered();
    expect(text).toContain("EYG-7F3K9A");
    expect(text).toContain("PMS A (Oil + Filter)");
    expect(text).toContain("View booking");
    expect(text).toContain("Please arrive 10 minutes early.");
  });

  it("contains no HTML tags or entities", () => {
    const { text } = rendered();
    expect(text).not.toMatch(/<[a-z/][^>]*>/i);
    expect(text).not.toMatch(/&nbsp;|&amp;|&#\d+;/);
  });

  it("is derived from the same structured content, so the two cannot diverge", () => {
    expect(renderEmailText(CONTENT)).toBe(renderEmail(CONTENT).text);
    expect(renderEmailHtml(CONTENT)).toBe(renderEmail(CONTENT).html);
  });

  it("htmlToText round-trips into readable text", () => {
    const text = htmlToText(rendered().html);
    expect(text).toContain("Booking confirmed");
    expect(text).not.toMatch(/<[a-z/][^>]*>/i);
  });

  it("assertTextAlternative never returns an empty or stub-only value for real content", () => {
    const { html, text } = rendered();
    expect(assertTextAlternative(html, text)).toBe(text);
    expect(assertTextAlternative(html, undefined).length).toBeGreaterThan(50);
    expect(assertTextAlternative(html, "   ").length).toBeGreaterThan(50);
  });
});

describe("email-shell — NAP block (Data Privacy Act §12)", () => {
  // `&` arrives HTML-escaped in the HTML part, so the fragments are compared
  // against the escaped form of each literal.
  const REQUIRED = [
    BUSINESS.legalName,
    BUSINESS.address.street,
    BUSINESS.address.district,
    BUSINESS.address.province,
    BUSINESS.address.postalCode,
  ] as const;

  it.each(REQUIRED)("the HTML contains %j", (fragment) => {
    expect(rendered().html).toContain(esc(fragment));
  });

  it.each(REQUIRED)("the text alternative contains %j", (fragment) => {
    expect(rendered().text).toContain(fragment);
  });

  it("contains the street, city and province on one line in both parts", () => {
    for (const part of [rendered().html, rendered().text]) {
      expect(part).toContain(BUSINESS.address.street);
      expect(part).toContain(BUSINESS.address.district);
      expect(part).toContain(BUSINESS.address.province);
    }
    // `ADDRESS_ONE_LINE` is the canonical form used by maps/GBP; the email must
    // carry the same components, not necessarily the same separator.
    const components = ADDRESS_ONE_LINE.split(", ").filter((c) => c !== "Philippines");
    for (const component of components) {
      expect(rendered().text, component).toContain(component);
    }
  });

  it("contains a working tel: link using the configured number", () => {
    const { html } = rendered();
    expect(html).toContain(`tel:${BUSINESS.phoneE164}`);
    expect(html).toContain(LINKS.call);
  });

  it("is NOT display:none — a stripped address block breaks the privacy notice", () => {
    const { html } = rendered();
    for (const row of html.split(/<tr[\s>]/i)) {
      if (!row.includes(esc(BUSINESS.address.street))) continue;
      expect(row).not.toMatch(/display\s*:\s*none/i);
      expect(row).not.toMatch(/mso-hide\s*:\s*all/i);
      expect(row).not.toMatch(/height\s*:\s*0\b/i);
      expect(row).not.toMatch(/opacity\s*:\s*0\b/i);
    }
  });

  it("is a visible <p> in a <td>, not a comment or a hidden block", () => {
    const { html } = rendered();
    expect(html).toContain(`<p style="margin:0 0 10px 0;`);
    expect(html).not.toMatch(/<!--[\s\S]*EGSA Fourlanes[\s\S]*-->/);
  });
});

describe("email-shell — opt-out and consent", () => {
  const OPT_OUT = /unsubscribe|opt out|off the list/i;

  it("renders an opt-out line in the HTML", () => {
    expect(rendered().html).toMatch(OPT_OUT);
  });

  it("renders an opt-out line in the text alternative", () => {
    expect(rendered().text).toMatch(OPT_OUT);
  });

  it("the opt-out link points at the site, over https", () => {
    const { html } = rendered();
    const href = /href="([^"]*unsubscribe[^"]*)"/i.exec(html)?.[1];
    expect(href).toBeTruthy();
    expect(href).toMatch(/^https:\/\//);
    expect(href).toContain(SITE.url);
  });

  it("the opt-out line is NOT display:none-only", () => {
    const { html } = rendered();
    const rows = html.split(/<tr[\s>]/i).filter((row) => OPT_OUT.test(row));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row, "an opt-out row a client strips is illegal").not.toMatch(/display\s*:\s*none/i);
      expect(row).not.toMatch(/mso-hide\s*:\s*all/i);
    }
  });

  it("defaults to the transactional consent line, which states WHY the email is sent", () => {
    expect(rendered().text).toMatch(/because you asked/i);
  });

  it("honours an explicit marketing consent line", () => {
    const { text } = renderEmail({ ...CONTENT, consentLine: "You signed up for EYG updates." });
    expect(text).toContain("You signed up for EYG updates.");
  });

  it("states the timezone so a customer never misreads 9:00 AM", () => {
    expect(rendered().text).toContain(TIMEZONE);
  });
});

describe("email-shell — contrast (WCAG 2.2 SC 1.4.3 in email clients)", () => {
  /** WCAG relative luminance. */
  const luminance = (hex: string): number => {
    const value = hex.replace("#", "");
    const channels = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255);
    const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  };
  const contrast = (a: string, b: string): number => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (l1 + 0.05) / (l2 + 0.05);
  };

  it("body text on the card surface meets 4.5:1", () => {
    expect(contrast("#1A1A20", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("muted footer text on the muted footer surface meets 4.5:1", () => {
    expect(contrast("#5C5C68", "#F6F6F8")).toBeGreaterThanOrEqual(4.5);
  });

  it("the brand yellow is used on INK in the header, never as text on white", () => {
    const { html } = rendered();
    // The lockup sits on `INK`. Assert the header table really is dark.
    expect(html).toMatch(/background-color:#06060A/);
    expect(contrast("#FCC605", "#06060A")).toBeGreaterThanOrEqual(4.5);
    // …and confirm the source never puts yellow text on a light surface.
    expect(SOURCE).not.toMatch(/color:\$\{YELLOW\}[\s\S]{0,80}background-color:#FFFFFF/);
  });

  it("the alert strip keeps ink text on the pale yellow tint", () => {
    expect(contrast("#06060A", "#FFF8DB")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("email-shell — header injection & hygiene", () => {
  it("never emits undefined, NaN, [object Object] or an unrendered placeholder", () => {
    const { html, text } = rendered();
    for (const blob of [html, text]) {
      expect(blob).not.toMatch(/undefined/);
      expect(blob).not.toMatch(/NaN/);
      expect(blob).not.toMatch(/\[object Object\]/);
      expect(blob).not.toMatch(/\{\{[^}]+\}\}/);
      expect(blob).not.toMatch(/\$\{[^}]+\}/);
    }
  });

  it("does not default to localhost", () => {
    const { html, text } = rendered();
    expect(html).not.toContain("localhost");
    expect(text).not.toContain("localhost");
    expect(html).toContain(SITE.url);
  });

  it("keeps CTA hrefs absolute https URLs to this site", () => {
    const { html } = rendered();
    const hrefs = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]!);
    for (const href of hrefs) {
      expect(href, `${href} is not https`).not.toMatch(/^http:\/\//);
    }
    expect(hrefs.some((h) => h.startsWith(SITE.url))).toBe(true);
  });

  it("renders an empty optional block as nothing rather than an empty tag", () => {
    const { html } = renderEmail({ heading: "Just a heading" });
    expect(html).toContain("Just a heading");
    expect(html).not.toMatch(/<p[^>]*><\/p>/);
    expect(html).not.toMatch(/<td[^>]*><\/td>\s*<tr><td[^>]*>\s*<\/td>/);
  });

  it("handles a very long value without breaking the table", () => {
    const long = "Brake pad replacement, tyre rotation, wheel alignment, undercoating, and a full brake fluid flush";
    const { html, text } = renderEmail({ heading: "Long value", rows: [{ label: "Services", value: long }] });
    expect(html).toContain(long);
    expect(text).toContain(long);
  });
});

describe("email-shell — escaping (XSS in a mail client)", () => {
  it("escapeHtml neutralises the five dangerous characters", () => {
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
  });

  it("every free-text field is escaped in the HTML part", () => {
    const payloads: ReadonlyArray<Partial<EmailContent>> = [
      { heading: '<script>alert(1)</script>' },
      { intro: '"><img src=x onerror=alert(1)>' },
      { footnote: "<iframe src=evil></iframe>" },
      { alert: "<svg onload=alert(1)>" },
      { rows: [{ label: "<b>label</b>", value: "<script>alert(2)</script>" }] },
      { paragraphs: ["<script>alert(3)</script>"] },
      { cta: { label: "<script>alert(4)</script>", href: "https://ok.example" } },
      { preheader: "<script>alert(5)</script>" },
    ];
    for (const payload of payloads) {
      const { html } = renderEmail({ heading: "Booking confirmed", ...payload });
      const label = JSON.stringify(payload);
      // No live element may be created from user input. The payload may survive
      // as escaped *text* (which is correct and desirable), but never as markup.
      expect(html.toLowerCase(), label).not.toContain("<script");
      expect(html.toLowerCase(), label).not.toContain("<iframe");
      expect(html.toLowerCase(), label).not.toContain("<svg");
      expect(html.toLowerCase(), label).not.toMatch(/<img[^>]*src=x/i);
      expect(html, label).not.toMatch(/<[^>]+\son[a-z]+\s*=/i); // no inline event handler
      expect(html, label).toMatch(/&lt;(script|iframe|svg|img|b)/i); // escaped, not dropped
    }
  });

  it("an attribute-breaking value in a CTA href cannot escape the attribute", () => {
    const { html } = renderEmail({
      heading: "x",
      cta: { label: "Click", href: '" onmouseover="alert(1)' },
    });
    // The payload survives as escaped *text inside* the attribute value, which
    // is safe. What must not survive is an unescaped quote that ends it.
    expect(html).not.toMatch(/href="" onmouseover/i);
    expect(html).toMatch(/href="[^"]*&quot;/);
  });

  it("the module never uses dangerouslySetInnerHTML", () => {
    expect(SOURCE).not.toMatch(/dangerouslySetInnerHTML/);
    expect(SOURCE).not.toMatch(/\.innerHTML\s*=/);
  });
});

describe("email-shell — no secret ever reaches an email", () => {
  it("no secret from the live environment appears in the rendered output", () => {
    const { html, text } = rendered();
    for (const key of [
      "AUTH_SECRET",
      "PII_ENCRYPTION_KEY",
      "WEBHOOK_SIGNING_SECRET",
      "RESEND_API_KEY",
      "SMTP_PASSWORD",
      "TWILIO_AUTH_TOKEN",
    ] as const) {
      const value = process.env[key];
      if (!value || value.length < 16) continue;
      expect(html, key).not.toContain(value);
      expect(text, key).not.toContain(value);
    }
  });

  it("rendering an email never needs provider credentials", () => {
    // The render path must be callable with no API keys set at all.
    const original = { ...process.env };
    try {
      for (const key of ["RESEND_API_KEY", "SMTP_PASSWORD", "SMTP_USER", "SMTP_HOST"]) delete process.env[key];
      const { html } = renderEmail(CONTENT);
      expect(html).toContain("Booking confirmed");
      expect(html).toContain(esc(BUSINESS.address.street));
    } finally {
      Object.assign(process.env, original);
    }
  });
});