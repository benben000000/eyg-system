/**
 * EYG TIRE & AUTO CARE — LOGO ASSET BUILDER
 * ============================================================================
 * Hand-authored geometric reconstruction of the EYG lockup, traced from
 * `brand/raw/eyg-profile.jpg` (720x720 official profile mark).
 *
 * Every glyph and every curve below is real `<path>` geometry. There are NO
 * `<text>` elements and NO external font dependencies, so the output is
 * print-safe, outlines-safe and renders identically in any application.
 *
 * Design space = the raster source's pixel grid (1 unit = 1 px of the 720x720
 * profile picture) so measured proportions can be reproduced exactly.
 *
 *   Usage:  node docs/brand/build-assets.mjs
 *   Deps:   sharp (devDependency, already declared in package.json)
 * ============================================================================
 */

import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const BRAND = resolve(ROOT, "public", "brand");

// ── Brand constants (must match src/app/globals.css exactly) ───────────────
const YELLOW = "#FCC605";
const INK = "#06060A";
const WHITE = "#FFFFFF";

// ── Measured from brand/raw/eyg-profile.jpg ────────────────────────────────
const SRC = {
  wordmarkLeft: 150, // E baseline-left
  wordmarkRight: 639, // E cap-top-right
  wordmarkCap: 68, // cap height, px
  wordmarkBaseline: 354,
  subLeft: 245,
  subRight: 617,
  subCap: 30,
  subBaseline: 395,
  shearDeg: 13,
};

const SHEAR = Math.tan((SRC.shearDeg * Math.PI) / 180); // 0.21256
const r2 = (n) => Math.round(n * 100) / 100;

/* ==========================================================================
   1. GLYPH LIBRARY
   Normalised frame: cap height = 100, baseline = y 0, cap line = y -100.
   `w` is the advance (box) width in the same units.
   ========================================================================== */

/** HEAVY face — used for "EYG TIRE". stem = 27 units, extended. */
const HEAVY = {
  E: {
    w: 92,
    d: "M0 -100 H92 V-74 H27 V-61 H76 V-39 H27 V-26 H92 V0 H0 Z",
  },
  Y: {
    w: 106,
    d: "M0 -100 H39 L54 -69 L69 -100 H106 L72 -36 V0 H44 V-36 Z",
  },
  G: {
    w: 111,
    d: [
      "M25 -100 H86 Q111 -100 111 -75 V-25 Q111 0 86 0 H25 Q0 0 0 -25 V-75 Q0 -100 25 -100 Z",
      "M29 -67 Q29 -75 37 -75 H74 Q82 -75 82 -67 V-59 H29 Z",
      "M29 -59 H56 V-37 H29 Z",
      "M29 -37 H82 V-35 Q82 -24 74 -24 H37 Q29 -24 29 -35 Z",
    ].join(" "),
  },
  T: { w: 92, d: "M0 -100 H92 V-74 H60 V0 H32 V-74 H0 Z" },
  I: { w: 28, d: "M0 -100 H28 V0 H0 Z" },
  R: {
    w: 111,
    d: [
      "M0 -100 H72 Q111 -100 111 -75 V-58 Q111 -37 82 -32 L111 0 H72 L44 -28 V0 H0 Z",
      "M27 -76 H70 Q76 -76 76 -70 V-56 Q76 -50 70 -50 H27 Z",
    ].join(" "),
  },
};

/** BOOK face — used for "& AUTO CARE". stem = 21 units, extended. */
const BOOK = {
  "&": {
    w: 118,
    d: [
      // outer silhouette incl. tail
      "M96 -52 C104 -60 110 -70 110 -80 C110 -94 100 -100 86 -100 C72 -100 66 -92 66 -80",
      "C66 -72 70 -66 78 -60 C64 -54 56 -44 56 -32 C56 -12 68 0 88 0 C98 0 106 -4 112 -12",
      "L122 0 H138 L112 -46 C120 -58 124 -70 124 -80 C124 -94 112 -100 96 -100 Z",
      // upper counter
      "M86 -84 C94 -84 96 -80 96 -74 C96 -68 92 -62 86 -56 C80 -62 76 -68 76 -74 C76 -80 78 -84 86 -84 Z",
      // lower counter
      "M88 -40 C96 -40 100 -36 100 -28 C100 -20 96 -16 88 -16 C80 -16 76 -20 76 -28 C76 -36 80 -40 88 -40 Z",
    ].join(" "),
  },
  A: {
    w: 126,
    d: ["M0 0 L41 -100 H83 L126 0 H99 L93 -19 H33 L27 0 Z", "M39 -38 H87 L63 -77 Z"],
  },
  U: {
    w: 120,
    d: "M0 -100 H21 V-36 Q21 -18 42 -18 Q63 -18 63 -36 V-100 H84 V-33 Q84 0 42 0 Q0 0 0 -33 Z",
  },
  T: { w: 112, d: "M0 -100 H112 V-79 H67 V0 H45 V-79 H0 Z" },
  O: {
    w: 124,
    d: [
      "M18 -100 H106 Q124 -100 124 -82 V-18 Q124 0 106 0 H18 Q0 0 0 -18 V-82 Q0 -100 18 -100 Z",
      "M21 -80 V-20 Q21 -17 24 -17 H100 Q103 -17 103 -20 V-80 Q103 -83 100 -83 H24 Q21 -83 21 -80 Z",
    ].join(" "),
  },
  C: {
    w: 120,
    d: "M20 -100 H100 Q120 -100 120 -80 V-55 H98 V-78 Q98 -83 93 -83 H27 Q22 -83 22 -78 V-22 Q22 -17 27 -17 H93 Q98 -17 98 -22 V-47 H120 V-20 Q120 0 100 0 H20 Q0 0 0 -20 V-80 Q0 -100 20 -100 Z",
  },
  R: {
    w: 114,
    d: [
      "M0 -100 H80 Q114 -100 114 -78 V-66 Q114 -46 84 -42 L114 0 H89 L63 -38 V0 H0 Z",
      "M22 -80 H76 Q82 -80 82 -76 V-68 Q82 -64 76 -64 H22 Z",
    ].join(" "),
  },
  E: { w: 106, d: "M0 -100 H106 V-80 H24 V-58 H97 V-38 H24 V-20 H106 V0 H0 Z" },
  // Support glyphs — used on the Open Graph card and signage lock-ups.
  B: {
    w: 106,
    d: [
      "M0 -100 H64 Q102 -100 102 -80 V-68 Q102 -54 84 -50 Q106 -45 106 -26 V-18 Q106 0 64 0 H0 Z",
      "M24 -80 H62 Q74 -80 74 -74 V-66 Q74 -58 62 -58 H24 Z",
      "M24 -38 H68 Q82 -38 82 -30 V-26 Q82 -16 68 -16 H24 Z",
    ].join(" "),
  },
  L: { w: 92, d: "M0 -100 H24 V-21 H92 V0 H0 Z" },
  N: { w: 110, d: "M0 0 V-100 H24 L88 -32 V-100 H110 V0 H86 L22 -68 V0 Z" },
  S: {
    w: 104,
    d: "M0 -100 H100 V-79 H28 V-63 H74 Q104 -63 104 -42 V-21 Q104 0 74 0 H0 V-21 H72 Q82 -21 82 -29 V-34 Q82 -42 72 -42 H0 Z",
  },
  F: { w: 94, d: "M0 -100 H94 V-79 H24 V-59 H84 V-38 H24 V0 H0 Z" },
  G: {
    w: 104,
    d: [
      "M23 -100 H81 Q104 -100 104 -77 V-23 Q104 0 81 0 H23 Q0 0 0 -23 V-77 Q0 -100 23 -100 Z",
      "M24 -76 Q24 -84 32 -84 H72 Q80 -84 80 -76 V-66 H24 Z",
      "M24 -66 H50 V-44 H24 Z",
      "M24 -44 H80 V-42 Q80 -32 72 -32 H32 Q24 -32 24 -42 Z",
    ].join(" "),
  },
  "·": { w: 46, d: "M23 -52 A11 11 0 1 0 23 -30 A11 11 0 1 0 23 -52 Z" },
  I: { w: 40, d: "M0 -100 H22 V0 H0 Z" },
  D: { w: 106, d: "M0 -100 H54 Q106 -100 106 -50 Q106 0 54 0 H0 Z M22 -79 V-21 H54 Q84 -21 84 -50 Q84 -79 54 -79 Z" },
  Y: { w: 104, d: "M0 -100 H27 L52 -62 L77 -100 H104 L67 -44 V0 H37 V-44 Z" },
  M: { w: 126, d: "M0 0 V-100 H24 L63 -46 L102 -100 H126 V0 H104 V-56 L74 -1 H52 L22 -56 V0 Z" },
  H: { w: 106, d: "M0 -100 H22 V-59 H84 V-100 H106 V0 H84 V-38 H22 V0 H0 Z" },
  P: { w: 100, d: "M0 -100 H64 Q100 -100 100 -76 V-60 Q100 -36 64 -36 H22 V0 H0 Z M22 -79 H60 Q78 -79 78 -75 V-64 Q78 -57 60 -57 H22 Z" },
};

/* ==========================================================================
   2. TYPESETTING
   Returns { body, advance } in normalised units (cap 100, baseline 0).
   ========================================================================== */
function typeset(face, text, tracking, wordSpace) {
  let x = 0;
  let body = "";
  const tokens = text.split(/\s+/);
  tokens.forEach((tok, ti) => {
    for (const ch of tok) {
      const g = face[ch];
      if (!g) throw new Error(`Missing glyph "${ch}" in face`);
      body += `<path fill-rule="evenodd" transform="translate(${r2(x)} 0)" d="${g.d}"/>`;
      x += g.w + tracking;
    }
    if (ti < tokens.length - 1) x += wordSpace - tracking;
  });
  return { body, advance: x - tracking };
}

/** Build a complete two-line type lockup, pre-positioned in source-pixel space. */
function typeLockup({ heavyText, bookText, ink, sub, heavyTrack = 5, heavyWord = 26 }) {
  const heavy = typeset(HEAVY, heavyText, heavyTrack, heavyWord);
  const bookTrack = 14;
  const bookWord = 41;
  const book = typeset(BOOK, bookText, bookTrack, bookWord);

  const heavySx = (SRC.wordmarkRight - SRC.wordmarkLeft) / (heavy.advance + SHEAR * 100);
  const heavySy = SRC.wordmarkCap / 100;
  const bookSx = (SRC.subRight - SRC.subLeft) / (book.advance + SHEAR * 100);
  const bookSy = SRC.subCap / 100;

  return `
  <g id="wordmark" fill="${ink}" transform="translate(${SRC.wordmarkLeft} ${SRC.wordmarkBaseline}) scale(${r2(heavySx)} ${r2(heavySy)}) skewX(-${SRC.shearDeg})">${heavy.body}</g>
  <g id="subline" fill="${sub}" transform="translate(${SRC.subLeft} ${SRC.subBaseline}) scale(${r2(bookSx)} ${r2(bookSy)}) skewX(-${SRC.shearDeg})">${book.body}</g>`;
}

/* ==========================================================================
   3. THE WHEEL MARK
   ========================================================================== */
const WHEEL = { cx: 85, cy: 317.5, rx: 27.8, ry: 50.2, rot: 11.4 };

/** Point on the wheel's outer ellipse at angle t (deg, screen coords), scale s. */
function wheelPt(t, s, rot = WHEEL.rot) {
  const a = (t * Math.PI) / 180;
  const x = WHEEL.rx * s * Math.cos(a);
  const y = WHEEL.ry * s * Math.sin(a);
  const r = (rot * Math.PI) / 180;
  return [
    r2(WHEEL.cx + x * Math.cos(r) - y * Math.sin(r)),
    r2(WHEEL.cy + x * Math.sin(r) + y * Math.cos(r)),
  ];
}

function wheelGroup({ line, tyre, bg, ringWeight = 2.6, rimWeight = 8, detail = true }) {
  const c = `${WHEEL.cx} ${WHEEL.cy}`;
  // yellow rim: outer ellipse 22 x 40, stroke centred on 18 x 36
  const rimRx = 22 - rimWeight / 2;
  const rimRy = 40 - rimWeight / 2;

  // 5-spoke hub. Each arm is a rounded lobe drawn in a unit circle, then the
// whole hub is mapped onto the rim's inner ellipse so the spokes follow the
// wheel's eccentric perspective exactly.
  const SX = 13, SY = 30; // rim inner ellipse (rx, ry)
  const pt = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return `${r2(r * Math.cos(a))} ${r2(r * Math.sin(a))}`;
  };
  const starPts = Array.from({ length: 5 }, (_, i) => {
    const a = -90 + i * 72;
    return `<path d="${[
      `M${pt(0.03, a + 31)}`,
      `L${pt(0.72, a + 27)}`,
      `Q${pt(0.9, a)} ${pt(0.72, a - 27)}`,
      `L${pt(0.03, a - 31)}`,
      "Z",
    ].join(" ")}"/>`;
  }).join("");

  // tread blocks: 11 short wedges fanning around the upper-right of the tyre
  const N = 11;
  const treads = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const t = -110 + u * 162; // -110deg (11 o'clock) .. +52deg (4 o'clock)
    const s1 = 1.05;
    const s2 = 1.12 + 0.18 * u;
    const dA = 4.4 - 0.5 * u; // inner angular half-width
    const dB = 5 + 1.4 * u; // outer angular half-width
    const p = [
      wheelPt(t - dA, s1),
      wheelPt(t + dA, s1),
      wheelPt(t + dB, s2),
      wheelPt(t - dB, s2),
    ];
    treads.push(`M${p[0][0]} ${p[0][1]} L${p[1][0]} ${p[1][1]} L${p[2][0]} ${p[2][1]} L${p[3][0]} ${p[3][1]} Z`);
  }

  return `
  <g id="wheel-mark">
    <g transform="rotate(${WHEEL.rot} ${c})">
      <g fill="${line}">
        <path d="${treads.join(" ")}"/>
      </g>
      <ellipse cx="${WHEEL.cx}" cy="${WHEEL.cy}" rx="${r2(WHEEL.rx)}" ry="${r2(WHEEL.ry)}" fill="none" stroke="${line}" stroke-width="${ringWeight}"/>
      <ellipse cx="${WHEEL.cx}" cy="${WHEEL.cy}" rx="${r2(rimRx)}" ry="${r2(rimRy)}" fill="none" stroke="${tyre}" stroke-width="${rimWeight}"/>
      <g transform="translate(${WHEEL.cx} ${WHEEL.cy}) scale(${SX} ${SY})">
        <g fill="${tyre}">${starPts}</g>
      </g>
      <ellipse cx="${WHEEL.cx}" cy="${WHEEL.cy}" rx="3.6" ry="6.4" fill="${bg}"/>
      ${
        detail
          ? `<g fill="${bg}">${Array.from({ length: 5 }, (_, i) => {
              const p = wheelPt(-54 + i * 72, 0.52, 0);
              return `<ellipse cx="${p[0]}" cy="${p[1]}" rx="1.8" ry="2.8"/>`;
            }).join("")}</g>`
          : ""
      }
    </g>
  </g>`;
}

/* ==========================================================================
   4. THE SPEED STRIPE
   ========================================================================== */
function stripe(yellow) {
  return `
  <g id="speed-stripe" fill="${yellow}">
    <path d="M126 404 L617 400 L613 419 Q611.5 431 598 431 L126 404 Z"/>
  </g>`;
}

/* ==========================================================================
   5. ASSEMBLY
   ========================================================================== */
const LOCKUP_VIEW = { x: 55, y: 266, w: 585, h: 168 };

/**
 * @param line   colour of the tyre outline + tread blocks
 * @param tyre   colour of the rim ring + spokes
 * @param bg     colour of the negative space cut through the hub
 */
function lockupSvg({ wordmarkInk, subInk, lineInk, tyreInk, bgInk, detail = true }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOCKUP_VIEW.x} ${LOCKUP_VIEW.y} ${LOCKUP_VIEW.w} ${LOCKUP_VIEW.h}" width="${LOCKUP_VIEW.w}" height="${LOCKUP_VIEW.h}" role="img" aria-label="EYG Tire and Auto Care">
  <title>EYG Tire &amp; Auto Care</title>
  ${wheelGroup({ line: lineInk, tyre: tyreInk, bg: bgInk, detail })}
  ${typeLockup({ heavyText: "EYG TIRE", bookText: "& AUTO CARE", ink: wordmarkInk, sub: subInk })}
  ${stripe(subInk)}
</svg>
`;
}

const WORDMARK_VIEW = { x: 148, y: 284, w: 493, h: 113 };
function wordmarkSvg({ wordmarkInk, subInk }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK_VIEW.x} ${WORDMARK_VIEW.y} ${WORDMARK_VIEW.w} ${WORDMARK_VIEW.h}" width="${WORDMARK_VIEW.w}" height="${WORDMARK_VIEW.h}" role="img" aria-label="EYG Tire and Auto Care">
  <title>EYG Tire &amp; Auto Care</title>
  ${typeLockup({ heavyText: "EYG TIRE", bookText: "& AUTO CARE", ink: wordmarkInk, sub: subInk })}
</svg>
`;
}

const MARK_VIEW = { x: 52, y: 264, w: 94, h: 106 };
function markSvg({ lineInk, tyreInk, bgInk, detail = true, ringWeight = 2.6, rimWeight = 8 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEW.x} ${MARK_VIEW.y} ${MARK_VIEW.w} ${MARK_VIEW.h}" width="${MARK_VIEW.w}" height="${MARK_VIEW.h}" role="img" aria-label="EYG Tire and Auto Care">
  <title>EYG wheel mark</title>
  ${wheelGroup({ line: lineInk, tyre: tyreInk, bg: bgInk, detail, ringWeight, rimWeight })}
</svg>
`;
}

/**
 * Favicon / app icon: 1:1 tile.
 * Deliberate simplification — the lockup's elliptical wheel + tread arc does not
 * survive below ~24 px, so the tile keeps only the two shapes that do: the rim
 * ring and the 5-spoke hub. See docs/brand/LOGO-ASSETS.md.
 */
function faviconSvg({ tile = 18 } = {}) {
  // Wide arms with truncated tips and shallow notches: at <=24 px this must
  // read as a 5-spoke rim, not as a star or a badge.
  const RO = 24, RI = 19.5;
  const sp = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return `${r2(r * Math.cos(a))} ${r2(r * Math.sin(a))}`;
  };
  const star = Array.from({ length: 5 }, (_, k) => {
    const a = -90 + k * 72;
    return [sp(RI, a + 36), sp(RO, a + 13), sp(RO, a - 13), sp(RI, a - 36)];
  })
    .flat()
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="EYG Tire and Auto Care">
  <title>EYG Tire &amp; Auto Care</title>
  <rect width="100" height="100" rx="${tile}" fill="${INK}"/>
  <circle cx="50" cy="50" r="33" fill="none" stroke="${YELLOW}" stroke-width="11"/>
  <polygon transform="translate(50 50)" points="${star}" fill="${YELLOW}"/>
  <circle cx="50" cy="50" r="4.4" fill="${INK}"/>
</svg>
`;
}

/* ==========================================================================
   6. WRITE SVG FILES
   ========================================================================== */
mkdirSync(BRAND, { recursive: true });

const written = [];
const emit = (name, content) => {
  writeFileSync(resolve(BRAND, name), content, "utf8");
  written.push([name, Buffer.byteLength(content, "utf8")]);
};

emit(
  "logo-primary.svg",
  lockupSvg({ wordmarkInk: WHITE, subInk: YELLOW, lineInk: WHITE, tyreInk: YELLOW, bgInk: INK })
);
emit(
  "logo-primary-light.svg",
  lockupSvg({ wordmarkInk: INK, subInk: YELLOW, lineInk: INK, tyreInk: INK, bgInk: WHITE })
);
emit(
  "logo-mono-white.svg",
  lockupSvg({ wordmarkInk: WHITE, subInk: WHITE, lineInk: WHITE, tyreInk: WHITE, bgInk: INK, detail: false })
);
emit(
  "logo-mono-black.svg",
  lockupSvg({ wordmarkInk: INK, subInk: INK, lineInk: INK, tyreInk: INK, bgInk: WHITE, detail: false })
);
emit("logo-wordmark.svg", wordmarkSvg({ wordmarkInk: WHITE, subInk: YELLOW }));
emit("logo-mark.svg", markSvg({ lineInk: WHITE, tyreInk: YELLOW, bgInk: INK }));
emit("favicon.svg", faviconSvg());

copyFileSync(resolve(BRAND, "favicon.svg"), resolve(ROOT, "src", "app", "icon.svg"));

/* ==========================================================================
   7. RASTER OUTPUT (sharp)
   ========================================================================== */
async function loadSharp() {
  const req = createRequire(import.meta.url);
  const tries = ["sharp"];
  if (process.env.EYG_SHARP_PATH) tries.unshift(process.env.EYG_SHARP_PATH);
  for (const t of tries) {
    try {
      return req(t);
    } catch {
      /* next */
    }
  }
  throw new Error("sharp not found. Run `npm install` in the project root first.");
}

const sharp = await loadSharp();

/** Strip the outer <svg> wrapper so a lockup can be nested inside a larger SVG. */
const inline = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace("<\/svg>", "").trim();

/**
 * Set a line of BOOK-face type as real paths (no fonts, fully deterministic).
 * @returns { svg, width } — width in source pixels.
 */
function pathLine(text, x, y, cap, fill, tracking = 26, maxWidth = Infinity) {
  const t = typeset(BOOK, text, tracking, tracking * 1.4);
  const natural = (t.advance + SHEAR * 100) * (cap / 100);
  const s = Math.min(cap / 100, maxWidth / natural);
  return {
    svg: `<g fill="${fill}" transform="translate(${x} ${y}) scale(${r2(s)}) skewX(-${SRC.shearDeg})">${t.body}</g>`,
    width: r2(s * (t.advance + SHEAR * 100)),
  };
}

/** Low-contrast checker field, drawn as merged row runs to keep the file small. */
function checkerField(cell, cols, rows, fill, opacity) {
  const parts = [`<g fill="${fill}" opacity="${opacity}">`];
  for (let r = 0; r < rows; r++) {
    let run = -1;
    for (let c = 0; c <= cols; c++) {
      const on = c < cols && (c + r) % 2 === 0;
      if (on && run < 0) run = c;
      if (!on && run >= 0) {
        parts.push(`<rect x="${run * cell}" y="${r * cell}" width="${(c - run) * cell}" height="${cell}"/>`);
        run = -1;
      }
    }
  }
  parts.push("</g>");
  return parts.join("");
}

// ── Open Graph card 1200x630 ───────────────────────────────────────────────
const lockupInline = inline(
  lockupSvg({ wordmarkInk: WHITE, subInk: YELLOW, lineInk: WHITE, tyreInk: YELLOW, bgInk: INK })
);

const ogScale = 1.34;
const l1 = pathLine("BALANGA CITY · BATAAN", 72, 516, 40, YELLOW, 26, 1056);
const l2 = pathLine("EGSA FOURLANES · TUYO", 72, 570, 19, WHITE, 48, 640);

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${INK}"/>
  ${checkerField(26, 46, 24, WHITE, 0.045)}
  <rect x="0" y="0" width="16" height="630" fill="${YELLOW}"/>
  <svg x="72" y="104" width="${r2(LOCKUP_VIEW.w * ogScale)}" height="${r2(LOCKUP_VIEW.h * ogScale)}" viewBox="${LOCKUP_VIEW.x} ${LOCKUP_VIEW.y} ${LOCKUP_VIEW.w} ${LOCKUP_VIEW.h}">${lockupInline}</svg>
  <path d="M72 444 L640 437 L637 457 L72 457 Z" fill="${YELLOW}"/>
  ${l1.svg}
  ${l2.svg}
</svg>`;

await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(resolve(BRAND, "logo-og.png"));

// ── Apple touch icon 180x180 ───────────────────────────────────────────────
// Opaque, square, full bleed — iOS applies its own corner mask, so baking a
// radius into the art would double-round the corners.
const apple = faviconSvg({ tile: 0 })
  .replace('width="100" height="100"', 'width="180" height="180"');
await sharp(Buffer.from(apple)).png({ compressionLevel: 9 }).toFile(resolve(BRAND, "apple-touch-icon.png"));

// ── Report ─────────────────────────────────────────────────────────────────
for (const [n, b] of written) console.log(`${n.padEnd(26)} ${String(b).padStart(7)} bytes`);
const ogMeta = await sharp(resolve(BRAND, "logo-og.png")).metadata();
const apMeta = await sharp(resolve(BRAND, "apple-touch-icon.png")).metadata();
console.log(`logo-og.png              ${ogMeta.width}x${ogMeta.height}`);
console.log(`apple-touch-icon.png     ${apMeta.width}x${apMeta.height}`);
console.log("build ok");
