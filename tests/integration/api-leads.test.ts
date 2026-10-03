// @vitest-environment node
/**
 * QA & SECURITY AGENT — POST /api/leads (roadside, contact, newsletter, tyre-size).
 * ============================================================================
 * DATABASE STRATEGY: typed in-memory Prisma fake, as documented in
 * docs/qa/TEST-STRATEGY.md §3. No network; the clock is pinned.
 *
 * This is the most attacker-facing endpoint in the product: four open forms that
 * accept free text from the whole internet, store it, and (for newsletter) start
 * a marketing relationship. So it must not become:
 *   • an SSRF proxy (a URL in `message` must never be fetched),
 *   • a spam relay (rate limit + honeypot + captcha must all bite),
 *   • a database-littering endpoint (every field bounded),
 *   • a consent-laundering tool (`consentMarketing` is never silently true),
 *   • an enumeration oracle for other subscribers.
 * ============================================================================
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixtures ────────────────────────────────────────────────────────────────

const db: { leads: Record<string, unknown>[]; subscribers: Record<string, unknown>[] } = {
  leads: [],
  subscribers: [],
};

vi.mock("@/lib/server/db", () => ({
  prisma: {
    lead: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `ld_${db.leads.length + 1}`, ...data };
        db.leads.push(row);
        return row;
      },
    },
    subscriber: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `sb_${db.subscribers.length + 1}`, ...data };
        db.subscribers.push(row);
        return row;
      },
      findFirst: async () => null,
      findUnique: async () => null,
    },
    rateLimitCounter: {
      findUnique: async () => null,
      upsert: async () => ({}),
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
  },
  withSerializableRetry: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
}));

// The limiter and the challenge are proven in rate-limit.test.ts and
// captcha-token.test.ts. Here they are neutral so the lead CONTRACT is what
// is under test — except the honeypot, which must keep biting.
vi.mock("@/lib/integrations/rate-limit", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    rateLimit: async () => ({ success: true, remaining: 99, limit: 100, reset: Date.now() + 3_600_000 }),
    rateLimitHeaders: () => ({}),
  };
});

vi.mock("@/lib/ratelimit", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    rateLimit: async () => ({ success: true, remaining: 999, limit: 1000, reset: Date.now() + 3_600_000 }),
    rateLimitHeaders: () => ({}),
  };
});

/**
 * The SMS provider is reached through a *dynamic* `await import("twilio")`
 * behind a "is it configured?" guard. Stubbing the module that owns it keeps the
 * suite hermetic: a test must never be able to send a real text to a real
 * number, whatever the environment variables say.
 */
vi.mock("@/lib/integrations/sms", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    sendSms: async () => ({ ok: false, status: "skipped", reason: "stubbed in tests" }),
    resetSmsClient: () => undefined,
    shopSmsRecipient: () => null,
  };
});

// ── Harness ─────────────────────────────────────────────────────────────────

function req(url: string, body: unknown, headers: Record<string, string> = {}): never {
  const encoded = typeof body === "string" ? body : JSON.stringify(body);
  return {
    nextUrl: new URL(url),
    url,
    method: "POST",
    headers: new Headers({ "content-type": "application/json", ...headers }),
    cookies: { get: () => undefined, getAll: () => [] },
    ip: "203.0.113.94",
    // The handler reads the RAW body through a size guard, then parses it.
    text: async () => encoded,
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    arrayBuffer: async () => new TextEncoder().encode(encoded).buffer,
    body: null,
    bodyUsed: false,
  } as never;
}

const LEADS_URL = "http://localhost:3000/api/leads";

async function postLead(
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  vi.resetModules();
  const route = await import("@/app/api/leads/route");
  const response = await route.POST(req(LEADS_URL, body));
  return { status: response.status, json: (await response.json()) as Record<string, unknown>, headers: response.headers };
}

const PINNED_NOW = new Date("2026-10-02T09:00:00+08:00");

beforeEach(() => {
  db.leads = [];
  db.subscribers = [];
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("api/leads — lead capture contract", () => {
  it("accepts a roadside lead and ENCRYPTS the phone at rest", async () => {
    const result = await postLead({
      kind: "roadside",
      name: "Maria Santos",
      phone: "09171234567",
      message: "Car stalled on the NLEX near Galan. Battery is dead.",
    });
    expect(result.status, JSON.stringify(result.json)).toBe(201);
    expect(result.json["ok"]).toBe(true);
    expect(db.leads).toHaveLength(1);
    expect(db.leads[0]!["kind"]).toBe("roadside");
    // Data Privacy Act §12: the phone is personal data. The handler stores it
    // through the PII envelope, so a database dump does not leak a contact list.
    const stored = String(db.leads[0]!["phone"]);
    expect(stored).toMatch(/^pii\.v1\./);
    expect(stored).not.toContain("09171234567");
    expect(stored).not.toContain("639171234567");
    // …and the ciphertext never leaves the server in a response.
    expect(JSON.stringify(result.json)).not.toContain(stored);
  });

  it("accepts a newsletter signup without a phone number", async () => {
    const { status } = await postLead({ kind: "newsletter", email: "maria@example.ph" });
    expect(status).toBe(201);
    expect(db.leads.length + db.subscribers.length).toBeGreaterThan(0);
  });

  it("accepts a contact-form lead", async () => {
    const { status } = await postLead({
      kind: "contact",
      name: "Juan Dela Cruz",
      email: "juan@example.ph",
      message: "Do you do wheel alignment for a Fortuner?",
    });
    expect(status).toBe(201);
  });

  it("rejects an unknown kind", async () => {
    const { status, json } = await postLead({ kind: "free-money-please" });
    expect(status).toBe(400);
    expect(json["ok"]).toBe(false);
    expect(db.leads).toHaveLength(0);
  });

  it.each([
    ["phone is a landline", { kind: "roadside", phone: "81234567", message: "help" }],
    ["phone is a foreign number", { kind: "roadside", phone: "+14155552671", message: "help" }],
    ["email malformed", { kind: "newsletter", email: "nope" }],
    ["no contact point at all", { kind: "newsletter" }],
    ["message is a 50 KB payload", { kind: "roadside", phone: "09171234567", message: "x".repeat(50_000) }],
  ])("rejects %s with 400 and writes nothing", async (_label, body) => {
    const { status } = await postLead(body);
    expect(status).toBe(400);
    expect(db.leads).toHaveLength(0);
    expect(db.subscribers).toHaveLength(0);
  });

  it("rejects a filled honeypot and writes nothing", async () => {
    const { status } = await postLead({ kind: "newsletter", email: "a@b.ph", website: "http://spam.example" });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(db.leads).toHaveLength(0);
    expect(db.subscribers).toHaveLength(0);
  });

  it("rejects a submission stamped faster than the minimum", async () => {
    vi.resetModules();
    const route = await import("@/app/api/leads/route");
    const response = await route.POST(
      req(
        LEADS_URL,
        { kind: "newsletter", email: "fast@example.ph" },
        { "x-form-rendered-at": String(PINNED_NOW.getTime()) },
      ),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(db.leads).toHaveLength(0);
  });
});

describe("api/leads — consent honesty", () => {
  it("never opts someone into marketing without them saying so", async () => {
    await postLead({ kind: "newsletter", email: "no-consent@example.ph" });
    const stored = [...db.leads, ...db.subscribers];
    expect(stored.length).toBeGreaterThan(0);
    for (const row of stored) {
      expect(row["marketingOptIn"] ?? row["consentMarketing"] ?? false).not.toBe(true);
    }
  });

  it("a newsletter signup is stored with marketing consent OFF", async () => {
    const result = await postLead({ kind: "newsletter", email: "opted-in@example.ph" });
    expect(result.status, JSON.stringify(result.json)).toBe(201);
    const stored = [...db.leads, ...db.subscribers];
    expect(stored.length).toBeGreaterThan(0);
    for (const row of stored) {
      expect(row["marketingOptIn"] ?? row["consentMarketing"] ?? false).not.toBe(true);
    }
  });
});

describe("api/leads — SSRF, spam and disclosure", () => {
  it("never makes an outbound request — a lead is not a fetch proxy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await postLead({
        kind: "roadside",
        phone: "09171234567",
        message: "See http://169.254.169.254/latest/meta-data/ for my location",
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("a CRLF log-injection attempt is rejected, or stored with the control characters stripped", async () => {
    const result = await postLead({
      kind: "roadside",
      phone: "09171234567",
      name: "Maria Santos",
      message: "help\r\nINFO admin logged in from 10.0.0.1",
    });
    if (result.status === 201) {
      expect(db.leads).toHaveLength(1);
      expect(String(db.leads[0]!["message"])).not.toMatch(/[\r\n]/);
    } else {
      // Rejecting outright is equally acceptable — and safer.
      expect(result.status).toBeGreaterThanOrEqual(400);
      expect(db.leads).toHaveLength(0);
    }
    // Either way, nothing that could forge a log line is stored.
    for (const row of db.leads) {
      expect(JSON.stringify(row)).not.toMatch(/\\r\\n|[\r\n]INFO /);
    }
  });

  it("never echoes another customer's data back", async () => {
    await postLead({ kind: "newsletter", email: "first@example.ph" });
    const { json } = await postLead({ kind: "newsletter", email: "second@example.ph" });
    expect(JSON.stringify(json)).not.toContain("first@example.ph");
  });

  it("never leaks a stack trace, a Prisma code or a connection string", async () => {
    const { status, json } = await postLead({ kind: "newsletter", email: "not-an-email" });
    const serialised = JSON.stringify(json);
    expect(status).toBe(400);
    expect(serialised).not.toMatch(/postgres(ql)?:\/\//);
    expect(serialised).not.toMatch(/PrismaClient|at Object\./);
    expect(serialised).not.toMatch(/\.ts:\d+:\d+/);
  });

  it("does not leak the honeypot field name or internal column names", async () => {
    const { json } = await postLead({ kind: "newsletter", email: "x@example.ph" });
    expect(JSON.stringify(json)).not.toMatch(/"website"|"createdIp"|prisma/i);
  });

  it("carries a request id and nothing else infrastructure-ish", async () => {
    const { json, headers } = await postLead({ kind: "newsletter", email: "a@b.ph" });
    expect(headers.get("x-request-id")).toBeTruthy();
    expect(JSON.stringify(json)).not.toMatch(/"id":"(ld|sb)_\d+"/);
  });
});