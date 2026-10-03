/**
 * EYG — NO-JAVASCRIPT BOOKING FALLBACK — SERVER ACTION
 * ============================================================================
 * ⚠️  A `"use server"` module may export ONLY async functions. Types, constants
 *     and helpers live in `NoJsBookingState.ts`. Getting that wrong compiles but
 *     fails at render, because every export becomes a server reference.
 *
 * WHY A SERVER ACTION AND NOT `POST /api/booking`
 * A Server Action renders as a real `<form method="post">`. Submit it with
 * JavaScript disabled and the browser performs a genuine form POST, the action
 * runs on the server, and React re-renders the page with the returned state.
 * That is the only way to keep the "customer with JS off is never stranded"
 * promise without shipping a second, divergent booking endpoint.
 *
 * IT DOES NOT CREATE A BOOKING. It posts to `POST /api/leads` with
 * `kind: "contact"`, which routes to a human who then agrees the time, the work
 * and the price. The copy on the form says exactly that — no pretending.
 * ============================================================================
 */

"use server";

import { headers } from "next/headers";
import { isValidPhPhone, normalisePhone } from "@/lib/utils";
import { SITE } from "@/config/site";
import { INITIAL_FALLBACK_STATE, type SubmitFallbackState } from "@/components/pages/booking/NoJsBookingState";

/** Builds an absolute origin for internal API calls without hardcoding localhost. */
async function internalOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return SITE.url;
}

export async function submitBookingFallback(
  _previous: SubmitFallbackState,
  formData: FormData,
): Promise<SubmitFallbackState> {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const day = String(formData.get("day") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const website = String(formData.get("website") ?? "");

  const fields: Record<string, string> = {};
  if (name.length < 2) fields["name"] = "Please put a name we can call you by.";
  if (!isValidPhPhone(phoneRaw)) {
    fields["phone"] = "That does not look like a PH mobile number. Try 0917 123 4567.";
  }

  // Honeypot. Report success and send nothing, so a bot gets no signal at all.
  if (website) return { ...INITIAL_FALLBACK_STATE, outcome: "sent" };

  const keep = { name, phone: phoneRaw, day, message };

  if (Object.keys(fields).length > 0) {
    return { outcome: "invalid", fields, ...keep };
  }

  const origin = await internalOrigin();
  try {
    const res = await fetch(`${origin}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        kind: "contact",
        name,
        phone: normalisePhone(phoneRaw),
        message: [
          "BOOKING REQUEST — customer could not use the step-by-step booker.",
          day ? `Preferred day: ${day}` : "Preferred day: not given, earliest available is fine.",
          message ? `What they need: ${message}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        meta: { source: "book-fallback-form" },
        website: "",
      }),
    });

    if (res.status === 429) return { outcome: "ratelimited", fields: {}, ...keep };
    if (res.status === 400) return { outcome: "invalid", fields, ...keep };
    if (!res.ok) return { outcome: "error", fields: {}, ...keep };
    return { outcome: "sent", fields: {}, ...keep };
  } catch {
    return { outcome: "error", fields: {}, ...keep };
  }
}
