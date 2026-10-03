/**
 * EYG — CONTACT FORM SERVER ACTION
 * ============================================================================
 * ⚠️  A `"use server"` module may export ONLY async functions. Types and the
 *     initial state live in `ContactState.ts`. Exporting a plain object from
 *     here compiles, then throws on the first client render.
 *
 * Posts `LeadInput` with `kind: "contact"` to `POST /api/leads`.
 * Every response branch is mapped to a named outcome the form can design for:
 * sent, ratelimited, invalid, offline, or error. The form never sees a raw
 * status code and the customer never sees a raw JSON body.
 * ============================================================================
 */

"use server";

import { headers } from "next/headers";
import { isValidEmail, isValidPhPhone, normalisePhone } from "@/lib/utils";
import { SITE } from "@/config/site";
import type { ContactFormState } from "@/components/pages/contact/ContactState";

/** Builds an absolute origin for internal API calls without hardcoding localhost. */
async function internalOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return SITE.url;
}

export async function submitContactLead(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const website = String(formData.get("website") ?? "");

  const fields: Record<string, string> = {};
  if (name.length < 2) fields["name"] = "Please put a name we can call you by.";
  if (!isValidPhPhone(phoneRaw)) {
    fields["phone"] = "That does not look like a PH mobile number. Try 0917 123 4567.";
  }
  if (email && !isValidEmail(email)) {
    fields["email"] = "Check the email address — it looks incomplete.";
  }
  if (message.length < 5) {
    fields["message"] = "Tell us a little about what you need, even in one line.";
  }

  const keep = { name, phone: phoneRaw, email, topic, message };

  // Honeypot. Report success, send nothing.
  if (website) return { outcome: "sent", fields: {}, ...keep };

  if (Object.keys(fields).length > 0) return { outcome: "invalid", fields, ...keep };

  const origin = await internalOrigin();
  try {
    const res = await fetch(`${origin}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        kind: "contact",
        name,
        phone: normalisePhone(phoneRaw),
        ...(email ? { email } : {}),
        message: [topic ? `Topic: ${topic}` : "", message].filter(Boolean).join("\n"),
        website: "",
      }),
    });

    if (res.status === 429) return { outcome: "ratelimited", fields: {}, ...keep };
    if (res.status === 400) return { outcome: "invalid", fields, ...keep };
    if (!res.ok) return { outcome: "error", fields: {}, ...keep };
    return { outcome: "sent", fields: {}, ...keep };
  } catch {
    return { outcome: "offline", fields: {}, ...keep };
  }
}
