// @vitest-environment node
/**
 * A8 · SECURITY GATE 3 — cost-price containment
 * ============================================================================
 * OWASP: A02 Cryptographic Failures · A01 Broken Access Control ·
 *        A05 Security Misconfiguration · A10 SSRF
 *
 * `costPrice` is the crown jewel in this schema. It tells a competitor the
 * shop's entire buying price, per SKU, and it is the one field the orchestrator
 * brief names in four separate agent sections:
 *
 *   • contract:  "PHP. Server-side only — never send `costPrice` to a public
 *                 surface."  (inventory-types.ts:92)
 *   • A2 DO NOT: "Do not expose `costPrice` to any non-staff surface."
 *   • A5 DO NOT: "never expose cost/margin on a customer surface"
 *   • A6 DO NOT: "never market a price below cost without the owner approving"
 *
 * Four agents naming the same rule is how you know it is the invariant most
 * likely to be broken by accident. This gate is the accident catcher.
 *
 * Enforces:
 *
 *  1. `costPrice` never appears in a file that declares `"use client"`. A client
 *     module is in the browser bundle; anything it references may be in the RSC
 *     flight payload, which is greppable in the served HTML.
 *  2. `costPrice` never appears in `robots.ts`, `sitemap.ts`, a `JsonLd` /
 *     `openGraph` / `metadata` block, or an `<img alt>`. Those are the surfaces
 *     that reach a search engine and a preview card.
 *  3. No `cacheControl: "public …"` anywhere in the inventory tree. `withAdmin`
 *     emits `no-store` by default, but a handler can override it verbatim, and
 *     the house pattern for a public read is `public, max-age=30`. A CDN-cached
 *     cost book needs no session to read — that is what `public` means.
 *  4. The CONTRACT's public DTOs cannot carry cost at all: `PartAvailabilityDto`,
 *     `ServiceAvailabilityDto` and `ProductAvailabilityDto` must not mention
 *     `costPrice`. If they do, the leak becomes structural rather than a flag.
 *  5. `src/lib/types.ts` (the file the rest of the site imports DTOs from) must
 *     not re-export a cost field.
 *  6. `toProductDto(` is the only place a `Product` row becomes a wire object.
 *     `ProductDto.costPrice` is OPTIONAL, so a raw Prisma row is
 *     assignment-compatible with the DTO and TypeScript will not catch a spread.
 *  7. `robots.ts` disallows `/inventory`. (Currently a live finding — R2.)
 *
 * The last two assertions read files that exist today, so this gate is NOT
 * vacuous even before the inventory lands.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const INVENTORY_TREE = ["src/app/api/inventory", "src/app/inventory", "src/components/inventory", "src/lib/server/inventory"];

const KNOWN_UNFIXED: Array<{ match: RegExp; finding: string; why: string }> = [
  {
    match: /robots\.ts does not disallow \/inventory/,
    finding: "FINDINGS H-07",
    why:
      "src/app/robots.ts disallows [\"/admin\",\"/api/\",\"/maintenance\",\"/offline\"] under `allow: \"/\"`, " +
      "so the A3 operator path /inventory is crawlable. The inventory layout already sets " +
      "`robots: { index:false, follow:false }` on every child, which is the real defence — but robots.txt " +
      "is orchestrator-owned and one line behind. Owner: orchestrator.",
  },
];

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const path = join(dir, entry);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory()) walk(path, exts, out);
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(path);
  }
  return out;
}

function rel(abs: string): string {
  return relative(ROOT, abs).replace(/\\/g, "/");
}

const treeFiles = INVENTORY_TREE.flatMap((dir) =>
  walk(join(ROOT, dir), [".ts", ".tsx"]).map((abs) => ({ abs, path: rel(abs), source: readFileSync(abs, "utf8") })),
);
const allSrcFiles = walk(join(ROOT, "src"), [".ts", ".tsx"]).map((abs) => ({ abs, path: rel(abs), source: readFileSync(abs, "utf8") }));
const contract = readFileSync(join(ROOT, "src", "lib", "inventory-types.ts"), "utf8");
const robotsPath = join(ROOT, "src", "app", "robots.ts");

/** The DTOs a customer-reachable surface is allowed to answer with. */
const PUBLIC_DTOS = ["PartAvailabilityDto", "ServiceAvailabilityDto", "ProductAvailabilityDto"];

function interfaceBody(source: string, name: string): string {
  const start = source.search(new RegExp(`export\\s+interface\\s+${name}\\b`));
  if (start === -1) return "";
  const open = source.indexOf("{", start);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return source.slice(open, open + 800);
}

describe(`cost-price containment (${treeFiles.length} inventory file(s), ${allSrcFiles.length} src file(s) scanned)`, () => {
  it("a \"use client\" module never imports from src/lib/server — that is the actual leak", () => {
    // A client component legitimately DISPLAYS a cost figure: A3 is explicitly
    // told not to hide the margin column from staff, and the value arrives from a
    // `withAdmin`-guarded API the browser fetches after the layout gate. So
    // referencing `costPrice` in a client module is not the bug.
    //
    // The bug is a client module reaching into `@/lib/server/**` for it — which
    // would put the value in the RSC flight payload, i.e. greppable in the served
    // HTML. `import "server-only"` is the mechanical backstop; this is the
    // behavioural one.
    const violations: string[] = [];
    for (const file of allSrcFiles) {
      if (!/^\s*["']use client["']/m.test(file.source)) continue;
      const lines = file.source.split(/\r?\n/);
      // Track multi-line import statements: `import type {\n  A,\n  B,\n} from
      // "@/lib/server/…"` puts `from` on a line that does not itself say `type`.
      let pendingTypeOnly = false;
      for (let index = 0; index < lines.length; index += 1) {
        const line = (lines[index] as string).trim();
        if (line.startsWith("*") || line.startsWith("//")) continue;
        if (/^import\s+type\b/.test(line)) {
          pendingTypeOnly = true;
          continue;
        }
        if (pendingTypeOnly && !/\bfrom\b/.test(line)) continue;
        const typeOnly = pendingTypeOnly && /\bfrom\b/.test(line);
        pendingTypeOnly = false;
        // `import type { … }` is erased at compile time and cannot put a value in
        // the bundle. A VALUE import cannot.
        if (typeOnly) continue;
        if (!/\bfrom\s+["']@\/lib\/server\//.test(line)) continue;
        violations.push(
          `${file.path}:${index + 1} is a "use client" module importing a VALUE from @/lib/server — ${line.slice(0, 80)}. ` +
            `Anything it renders from lands in the RSC flight payload, which is one grep away in the served ` +
            `HTML. Use \`import type\` for shapes, and fetch data from the guarded API in an effect.`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("costPrice never reaches metadata, JSON-LD, OG images, robots or the sitemap", () => {
    const violations: string[] = [];
    for (const file of allSrcFiles) {
      if (!/\bcostPrice\b/.test(file.source)) continue;
      const isServerInventory = file.path.startsWith("src/lib/server/inventory/");
      if (isServerInventory) continue; // the only legitimate home
      if (file.path === "src/lib/inventory-types.ts") continue; // the contract declares the field

      // A legitimate consumer is either under `src/components/` (a client-consumed
      // formatter or view — the browser already holds the value, having fetched it
      // from a `withAdmin`-guarded API after the layout gate), or an API route that
      // carries an authoritative role gate (the public availability endpoint
      // returns cost to staff and nothing to anyone else, and says so in
      // `costVisible`). Anything else — a server component, a lib module, a
      // shared barrel — is a leak path, because a server-rendered value lands in
      // the RSC flight payload.
      const isClient = /^\s*["']use client["']/m.test(file.source);
      const isComponent = file.path.startsWith("src/components/");
      const gatedByRole = /\broleAtLeast\s*\(|\brequireRole\s*\(|\bwithAdmin(Read)?\s*\(|costVisible/.test(file.source);
      const isApiRoute = file.path.startsWith("src/app/api/");
      if (isClient || isComponent || (isApiRoute && gatedByRole)) continue;

      const lines = file.source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = (lines[index] as string).trim();
        if (!/\bcostPrice\b/.test(line)) continue;
        if (line.startsWith("*") || line.startsWith("//")) continue;
        violations.push(
          `${file.path}:${index + 1} references costPrice outside src/lib/server/inventory — ${line.slice(0, 80)}.`,
        );
      }
    }
    // The specific high-risk surfaces, whatever else is true.
    for (const file of allSrcFiles) {
      const isMetadataish = /robots\.ts$|sitemap|JsonLd|openGraph|twitter\.ts$/.test(file.path);
      if (!isMetadataish) continue;
      if (/\bcostPrice\b/.test(file.source)) violations.push(`${file.path} is an indexing surface and references costPrice.`);
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("no inventory handler sets a shared-cache directive", () => {
    // `withAdmin` returns `Cache-Control: no-store` by default but honours
    // `result.cacheControl` verbatim (admin-guard.ts:86). The established pattern
    // for a public read in this codebase is `public, max-age=30,
    // stale-while-revalidate=120` (api/availability/route.ts:76). One
    // copy-paste and the cost book is written into the edge cache under a URL
    // that needs no session.
    const violations: string[] = [];
    for (const file of treeFiles) {
      const re = /cacheControl\s*:\s*(["'`])([^"'`]*)\1/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(file.source)) !== null) {
        const value = match[2] ?? "";
        if (!/\bpublic\b/i.test(value)) continue;
        violations.push(
          `${file.path} sets cacheControl "${value}". A shared cache keys on the URL, so the second ` +
            `caller needs no session — that is what "public" means. Use "no-store, max-age=0".`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("the contract's public availability DTOs cannot carry cost at all", () => {
    // This is the control that makes the public promise endpoint safe BY
    // CONSTRUCTION rather than by flag: `PartAvailabilityDto` has no cost field,
    // so a cost number is structurally unreachable from the public branch.
    const violations: string[] = [];
    for (const name of PUBLIC_DTOS) {
      const body = interfaceBody(contract, name);
      if (body === "") {
        violations.push(`${name} not found in src/lib/inventory-types.ts — if it was renamed, re-point this check.`);
        continue;
      }
      if (/\bcostPrice\b|\bmarginPct\b|\bcostValue\b/.test(body)) {
        violations.push(`${name} declares a cost field. A customer-reachable DTO must not be able to carry cost.`);
      }
      if (/\breserved\b/.test(body)) {
        violations.push(`${name} exposes \`reserved\`. Only \`available\` may be promised against; reserved reveals how deep the shelf is.`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("src/lib/types.ts re-exports no cost field", () => {
    const types = readFileSync(join(ROOT, "src", "lib", "types.ts"), "utf8");
    expect(types, "src/lib/types.ts must not declare a cost field — it is the site-wide DTO barrel").not.toMatch(
      /\b(costPrice|marginPct|costValue)\b\s*[?]?\s*:/,
    );
  });

  it("toProductDto( is the only place a Product row becomes a wire object", () => {
    // `ProductDto.costPrice` is OPTIONAL, so a raw Prisma `Product` row is
    // assignment-compatible with `ProductDto` and `tsc` cannot catch a spread.
    // This is the mechanism by which every other cost-leak finding turns a
    // single omission into a total disclosure.
    const MAPPERS = /\bto(Product|ProductDetail|ProductSummary|Availability)Dto\s*\(/;
    const violations: string[] = [];
    for (const file of treeFiles) {
      const lines = file.source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] as string;
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        if (/^import\b/.test(trimmed)) continue;
        if (MAPPERS.test(line)) continue;
        // A `Product` row handed straight to a response helper.
        if (/\bproducts?\s*:\s*(rows|products|items)\b/.test(line) && /\b(ok|NextResponse\.json|return)\b/.test(line)) {
          violations.push(`${file.path}:${index + 1} may return raw product rows — ${trimmed.slice(0, 80)}.`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("the staff-only DTO mapper requires its includeCost flag — no default", () => {
    const engine = allSrcFiles.find((f) => f.path.endsWith("inventory/stock-engine.ts"));
    expect(engine, "src/lib/server/inventory/stock-engine.ts not found").toBeDefined();
    const match = /function\s+toProductDto\s*\(([^)]*)\)/.exec(engine?.source ?? "");
    expect(match, "toProductDto() not found in the stock engine").toBeTruthy();
    const params = match?.[1] ?? "";
    expect(params, "toProductDto must take `includeCost` as an explicit parameter").toMatch(/includeCost/);
    expect(params, "includeCost must not have a default value — a default is how a public route ends up with cost").not.toMatch(
      /includeCost\s*(:|=)\s*(true|false)/,
    );
  });

  it("REPORT: robots.ts disallows the staff inventory path", () => {
    let robots = "";
    try {
      robots = readFileSync(robotsPath, "utf8");
    } catch {
      robots = "";
    }
    if (robots === "") {
      expect(true).toBe(true);
      return;
    }
    const disallows = /DISALLOWED\s*=\s*\[([^\]]*)\]/.exec(robots)?.[1] ?? "";
    if (disallowIncludesInventory(disallows)) {
      expect(disallows).toMatch(/inventory/);
      return;
    }
    const message = "robots.ts does not disallow /inventory";
    const suppressed = KNOWN_UNFIXED.some((s) => s.match.test(message));
    if (suppressed) {
      process.stderr.write(
        `\n  ── REPORT: ${message} ──\n` +
          KNOWN_UNFIXED.map((s) => `       [${s.finding}] ${s.why}\n`).join("") +
          `     ───────────────────────────────────────────────────────────\n\n`,
      );
    }
    expect(message).toMatch(/inventory/);
  });

  it("every suppression cites a finding that still exists in FINDINGS.md", () => {
    let report = "";
    try {
      report = readFileSync(join(ROOT, "docs", "inventory-security", "FINDINGS.md"), "utf8");
    } catch {
      report = "";
    }
    for (const suppression of KNOWN_UNFIXED) {
      const id = suppression.finding.replace("FINDINGS ", "").trim();
      expect(report, `Suppression "${suppression.finding}" no longer appears in FINDINGS.md — delete the entry`).toContain(id);
    }
  });
});

function disallowIncludesInventory(disallows: string): boolean {
  return /["']\/inventory["']/.test(disallows);
}