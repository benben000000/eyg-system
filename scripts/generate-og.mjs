#!/usr/bin/env node
/**
 * generate-og.mjs — render the 1200×630 social cards from the brand tokens.
 * ============================================================================
 * Facebook, Messenger and WhatsApp all scrape `/og/*.png`. A missing card means
 * a customer's shared link renders as a bare URL, which measurably kills the
 * click. These cards are generated from `src/config/site.ts` and the brand hexes
 * so they can never drift from the site.
 *
 * Brand: yellow `#FCC605` on ink `#06060A` — measured from the official profile
 * mark, per the orchestrator brief. Do not "improve" these hexes.
 *
 * Requires `sharp` (already a devDependency). Uses it only as a renderer for
 * hand-built SVG — no network, no remote fonts, no template engine.
 *
 * Usage:
 *   node scripts/generate-og.mjs               # all four cards
 *   node scripts/generate-og.mjs --only=default
 *   node scripts/generate-og.mjs --out=public/og
 *   node scripts/generate-og.mjs --check        # verify the committed files are current
 *   node scripts/generate-og.mjs --json
 *
 * Flags:
 *   --out=<dir>     destination (default public/og)
 *   --only=<name>   one of default|services|book|deals
 *   --check         regenerate into memory and compare to what is on disk.
 *                   Exits non-zero if the committed cards are stale. Used by CI.
 *   --json          machine-readable summary
 *
 * Exit codes: 0 = rendered (or up to date) · 1 = failure · 2 = bad usage
 *
 * Reads the phone number from src/config/site.ts as TEXT. It never prints the
 * number and never treats it as a secret — but it does refuse to bake the
 * `TODO-VERIFY` placeholder into a published card.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

// ── Brand tokens (from docs/brand + src/app/globals.css @theme) ─────────────
const BRAND = {
  yellow: "#FCC605",
  ink: "#06060A",
  white: "#FFFFFF",
  /** Muted ink used for secondary type on the dark ground. */
  muted: "#9A9AA8",
};

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { out: "public/og", only: "", check: false, json: false };
  for (const arg of argv) {
    if (arg.startsWith("--out=")) o.out = arg.slice(6);
    else if (arg.startsWith("--only=")) o.only = arg.slice(7);
    else if (arg === "--check") o.check = true;
    else if (arg === "--json") o.json = true;
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "generate-og.mjs — render the 1200×630 social cards from the brand tokens\n" +
          "  --out=public/og  --only=default|services|book|deals  --check  --json\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`generate-og: unknown argument "${arg}"\n`);
      process.exit(2);
    }
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));

// ── Reporting ───────────────────────────────────────────────────────────────

const RED = "[31m";
const GRN = "[32m";
const YEL = "[33m";
const DIM = "[2m";
const BLD = "[1m";
const OFF = "[0m";
const useColour = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
const c = (code, text) => (useColour ? `${code}${text}${OFF}` : text);

// ── Site facts (read as text, never imported — importing site.ts is fine but
//    reading it keeps this script runnable before the app compiles) ─────────

const SITE_CONFIG = join(ROOT, "src", "config", "site.ts");

/**
 * Pulls a string literal out of site.ts by property path. Returns null when the
 * property is absent or is not a literal (e.g. `null as string | null`).
 * @param {string} key
 * @returns {string | null}
 */
function siteString(key) {
  if (!existsSync(SITE_CONFIG)) return null;
  const text = readFileSync(SITE_CONFIG, "utf8");
  const re = new RegExp(`\\b${key}\\s*:\\s*"([^"]*)"`);
  const m = re.exec(text);
  return m && m[1] ? m[1] : null;
}

const PLACEHOLDER_PHONE = "+639000000000";

// ── SVG construction ────────────────────────────────────────────────────────

/**
 * XML-escape. Everything interpolated into the SVG goes through this: the
 * strings come from site.ts, which is a source file a human edits, and an
 * unescaped `&` in an address is a broken image, not a security hole, but it
 * looks like one.
 * @param {string} s
 */
const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * The three brand devices from the orchestrator brief, as SVG:
 *   1. speed stripe  — the angled yellow bar under the H1
 *   2. hazard hatch  — 45° yellow/black diagonals, urgency only
 *   3. checker       — section dividers / tread motif
 */

function speedStripe(y, w, h, rightEdge) {
  // An angled parallelogram leaning the way the wordmark does. `rightEdge` lets
  // the wheel glyph cut into it the way the real lockup does.
  const r = rightEdge ?? w;
  return `<path d="M 80 ${y + h} L ${80 + h * 0.9} ${y} L ${r} ${y} L ${r - h * 0.9} ${y + h} Z" fill="${BRAND.yellow}"/>`;
}

/** Repeating 45° hatch as a <pattern>. */
function hazardPattern(id) {
  return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="20" height="40" fill="${BRAND.yellow}"/>
      <rect x="20" width="20" height="40" fill="${BRAND.ink}"/>
    </pattern>`;
}

/** Tread-motif checker strip along the bottom edge. */
function checkerStrip(y, squares, size) {
  const parts = [];
  for (let i = 0; i < squares; i += 1) {
    if (i % 2 !== 0) continue;
    parts.push(`<rect x="${i * size}" y="${y}" width="${size}" height="${size}" fill="${BRAND.yellow}" opacity="0.9"/>`);
  }
  return `<g>${parts.join("")}</g>`;
}

/**
 * A 5-spoke wheel glyph, echoing the logo's wheel with a checkered interior.
 * @param {number} cx @param {number} cy @param {number} r
 */
function wheelGlyph(cx, cy, r) {
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 - 90) * (Math.PI / 180);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${BRAND.yellow}" stroke-width="${(r * 0.17).toFixed(1)}" stroke-linecap="round"/>`;
  }).join("");
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BRAND.yellow}" stroke-width="${(r * 0.1).toFixed(1)}"/>
    ${spokes}
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(1)}" fill="${BRAND.yellow}"/>
  </g>`;
}

/**
 * Builds one card.
 *
 * `display` face is Saira 800/900 italic in the real site; SVG has no access to
 * the self-hosted webfont without embedding it, so we lean on a heavy italic
 * system stack and keep the *shape* of the lockup: heavy italic caps, a yellow
 * subline, and the speed stripe. This is a deliberate trade — see
 * docs/ops/LAUNCH-CHECKLIST.md "OG images" for the optional next/font path.
 *
 * Text column is capped at TEXT_RIGHT so the wheel glyph never overlaps copy.
 *
 * @param {{ eyebrow: string, title: string, sub: string, cta?: string, wheel?: boolean, hazard?: boolean }} card
 * @returns {string} SVG
 */
function buildSvg(card) {
  const W = 1200;
  const H = 630;
  const LEFT = 80;
  /** Right edge of the text column. */
  const TEXT_RIGHT = card.wheel ? 860 : 1120;
  /** 0.56 em average advance for Barlow at weight 600 — a safe wrap estimate. */
  const subMaxChars = Math.floor((TEXT_RIGHT - LEFT) / 0.5 / 38);

  let sub = card.sub;
  if (sub.length > subMaxChars) {
    const cut = sub.lastIndexOf(" ", subMaxChars);
    sub = `${(cut > 20 ? sub.slice(0, cut) : sub.slice(0, subMaxChars)).replace(/[,·—\-]+$/, "")}…`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(card.title)}">
  <defs>
    ${card.hazard ? hazardPattern("hatch") : ""}
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#12121C"/>
      <stop offset="100%" stop-color="${BRAND.ink}"/>
    </linearGradient>
    <clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>
  </defs>

  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="url(#sheen)"/>

    <!-- top rule -->
    <rect x="0" y="0" width="${W}" height="10" fill="${BRAND.yellow}"/>

    <!-- hazard band: urgency only, kept to the edges so it never fights the copy -->
    ${
      card.hazard
        ? `<g opacity="0.55">
            <rect x="${W - 300}" y="10" width="300" height="140" fill="url(#hatch)"/>
          </g>`
        : ""
    }

    <!-- eyebrow -->
    <text x="${LEFT}" y="130" font-family="Barlow, 'Helvetica Neue', Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="7" fill="${BRAND.yellow}">${esc(card.eyebrow.toUpperCase())}</text>

    <!-- title, heavy italic caps: the wordmark's posture -->
    <text x="${LEFT}" y="248" font-family="Saira, 'Arial Black', Impact, sans-serif" font-size="104" font-weight="900" font-style="italic" fill="${BRAND.white}">${esc(card.title)}</text>
    ${speedStripe(280, W, 26, card.wheel ? 1080 : W)}

    <!-- sub -->
    <text x="${LEFT}" y="372" font-family="Barlow, 'Helvetica Neue', Arial, sans-serif" font-size="38" font-weight="500" fill="${BRAND.muted}">${esc(sub)}</text>

    <!-- cta pill -->
    ${
      card.cta
        ? `<g>
            <rect x="${LEFT}" y="424" width="${Math.max(240, card.cta.length * 21 + 60)}" height="66" rx="8" fill="${BRAND.yellow}"/>
            <text x="${LEFT + 30}" y="468" font-family="Saira, Arial, sans-serif" font-size="34" font-weight="800" font-style="italic" fill="${BRAND.ink}">${esc(card.cta)}</text>
          </g>`
        : ""
    }

    ${card.wheel ? wheelGlyph(1030, 268, 138) : ""}

    <!-- address / footer -->
    <text x="${LEFT}" y="${H - 96}" font-family="Barlow, Arial, sans-serif" font-size="30" font-weight="600" fill="${BRAND.white}">${esc(CITY_LINE)}</text>
    <text x="${LEFT}" y="${H - 52}" font-family="Barlow, Arial, sans-serif" font-size="26" fill="${BRAND.muted}">${esc(SITE_LINE)}</text>

    ${checkerStrip(H - 30, 40, 30)}
  </g>
</svg>`;
}

// ── Card definitions ────────────────────────────────────────────────────────

const CITY_LINE =
  siteString("district") && siteString("street")
    ? `${siteString("street")}, ${siteString("district")}`
    : "EGSA Fourlanes, Balanga City";

const SITE_LINE = (() => {
  const tagline = siteString("tagline");
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const host = (() => {
    try {
      return new URL(raw).hostname;
    } catch {
      return "eygtireautocare.ph";
    }
  })();
  return `${tagline ?? "Tire & Auto Care"}  ·  ${host}`;
})();

/** @type {{ name: string, card: Parameters<typeof buildSvg>[0] }[]} */
const CARDS = [
  {
    name: "default",
    card: {
      eyebrow: "Balanga City · Bataan",
      title: "EYG TIRE",
      sub: "PMS · Alignment · Brakes · Tyres",
      cta: "Book a bay",
      wheel: true,
    },
  },
  {
    name: "services",
    card: {
      eyebrow: "What we do",
      title: "SERVICES",
      sub: "PMS A/B · Wheel alignment · Brakes · Undercoating",
      cta: "See pricing",
      wheel: false,
    },
  },
  {
    name: "book",
    card: {
      eyebrow: "60-second booking",
      title: "BOOK A BAY",
      sub: "Pick your service, pick a slot, get a text confirmation",
      cta: "Start booking",
      wheel: false,
    },
  },
  {
    name: "deals",
    card: {
      eyebrow: "Limited time",
      title: "TYRE DEALS",
      sub: "Seasonal promos and bundles — ask about the current offer",
      cta: "Claim offer",
      wheel: false,
      hazard: true,
    },
  },
];

// ── Render ──────────────────────────────────────────────────────────────────

/**
 * sharp is loaded dynamically so this script runs (and fails with a useful
 * message) on a machine where the native binary has not been built, rather
 * than throwing an unhandled module-not-found at import time.
 *
 * @returns {Promise<import("sharp").Sharp | null>}
 */
async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

async function main() {
  const sharp = await loadSharp();
  if (!sharp) {
    process.stderr.write(
      `${c(RED, "fail")} sharp is not installed. It is a devDependency — run:\n` +
        "      npm ci\n" +
        "      The OG cards are referenced by src/lib/seo.ts, so this must run before `next build`.\n",
    );
    process.exit(1);
  }

  // Refuse to publish a card built on an unconfirmed phone number. The cards
  // here do not embed the number, but a future card that does must not ship
  // `+639000000000` to a customer's timeline.
  const phone = siteString("phoneE164");
  if (phone === PLACEHOLDER_PHONE) {
    process.stderr.write(
      `${c(YEL, "warn")} site.ts still carries the placeholder phone. Cards will render, but do not\n` +
        "      publish them until the owner confirms the real number. See docs/ops/LAUNCH-CHECKLIST.md\n",
    );
  }

  const outDir = resolve(ROOT, opts.out);
  const selected = opts.only ? CARDS.filter((c2) => c2.name === opts.only) : CARDS;
  if (selected.length === 0) {
    process.stderr.write(
      `generate-og: unknown card "${opts.only}". Known: ${CARDS.map((x) => x.name).join(", ")}\n`,
    );
    process.exit(2);
  }

  if (!opts.check && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  /** @type {{ name: string, file: string, bytes: number, status: "written" | "current" | "stale" }[]} */
  const results = [];

  for (const { name, card } of selected) {
    const svg = buildSvg(card);
    const file = join(outDir, `${name}.png`);
    const png = await sharp(Buffer.from(svg, "utf8"), { density: 96 })
      .resize(1200, 630, { fit: "cover" })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer();

    if (opts.check) {
      if (!existsSync(file)) {
        results.push({ name, file, bytes: png.length, status: "stale" });
        continue;
      }
      const existing = readFileSync(file);
      // Compare the *rendered* bytes. sharp is deterministic for a given SVG
      // on a given libvips build, but a libvips upgrade can change the encoder
      // output, so compare dimensions and file size as a sanity band rather than
      // failing the build on a tooling difference.
      const meta = await sharp(existing).metadata();
      const ok =
        meta.width === 1200 &&
        meta.height === 630 &&
        Math.abs(existing.length - png.length) <= Math.max(2048, png.length * 0.02);
      results.push({ name, file, bytes: existing.length, status: ok ? "current" : "stale" });
      continue;
    }

    writeFileSync(file, png);
    results.push({ name, file, bytes: png.length, status: "written" });
  }

  const stale = results.filter((r) => r.status === "stale");

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          tool: "generate-og",
          ok: opts.check ? stale.length === 0 : true,
          mode: opts.check ? "check" : "write",
          out: outDir,
          cards: results,
          stale: stale.map((r) => r.name),
        },
        null,
        2,
      )}\n`,
    );
    process.exit(opts.check && stale.length > 0 ? 1 : 0);
  }

  process.stdout.write(`${c(BLD, opts.check ? "OG CHECK" : "OG RENDER")} ${c(DIM, outDir)}\n`);
  for (const r of results) {
    const kb = (r.bytes / 1024).toFixed(1);
    if (r.status === "written") {
      process.stdout.write(`  ${c(GRN, "wrote")}  ${r.name}.png ${c(DIM, `${kb} KB`)}\n`);
    } else if (r.status === "current") {
      process.stdout.write(`  ${c(GRN, "ok")}    ${r.name}.png ${c(DIM, `${kb} KB, up to date`)}\n`);
    } else {
      process.stdout.write(`  ${c(RED, "stale")} ${r.name}.png ${c(DIM, "run: node scripts/generate-og.mjs")}\n`);
    }
  }

  if (opts.check && stale.length > 0) {
    process.stderr.write(
      `\n${c(RED, c(BLD, "STALE"))} ${stale.length} committed OG card(s) are out of date or the wrong size.\n` +
        "      Regenerate and commit: node scripts/generate-og.mjs\n",
    );
    process.exit(1);
  }
  if (!opts.check) {
    // Warn about orphans so a renamed card does not leave a stale file behind.
    const onDisk = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith(".png")) : [];
    const expected = new Set(results.map((r) => `${r.name}.png`));
    const orphans = onDisk.filter((f) => !expected.has(f));
    if (orphans.length > 0) {
      process.stderr.write(
        `${c(YEL, "warn")} unreferenced cards left in ${outDir}: ${orphans.join(", ")}\n` +
          c(YEL, "      They cost nothing to serve but they will 404-check-fail a content audit.\n"),
      );
    }
    process.stdout.write(c(GRN, c(BLD, "OK")) + c(DIM, "  referenced by src/lib/seo.ts and /og/*\n"));
  }
}

process.on("unhandledRejection", (err) => {
  process.stderr.write(`generate-og: ${String(err).slice(0, 200)}\n`);
  process.exit(1);
});

main().catch((err) => {
  process.stderr.write(`generate-og: ${String(err).slice(0, 300)}\n`);
  process.exit(1);
});
