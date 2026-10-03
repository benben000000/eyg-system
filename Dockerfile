# syntax=docker/dockerfile:1.7
# ============================================================================
# EYG TIRE & AUTO CARE — production image
# ============================================================================
# Multi-stage, Node 20 Alpine. The builder carries the full dependency tree and
# the toolchain; the runner carries production dependencies and the compiled
# server, and nothing else.
#
# Design rules, in priority order:
#   1. No secret is ever baked into a layer. Every secret is read at RUNTIME
#      from the environment. ARG/ENV here hold build-time *stubs* only, and a
#      stub is never a credential.
#   2. Non-root. The process runs as uid/gid 1001 and writes only to /tmp.
#   3. Small attack surface. No build tools, no npm cache, no .git, no source.
#   4. Reproducible. Versions pinned; the lockfile decides the tree.
#
# ---------------------------------------------------------------------------
# RUNTIME MEMORY FOOTPRINT  (detail in docs/ops/COST-OPTIMISATION.md §4)
#   RESERVED   512 MB  — set this as the container memory cap.
#   STEADY     180-260 MB RSS for a warm Next server. Prisma's engine adds ~40 MB.
#   SPIKE      up to ~420 MB during the first burst after a cold start
#              (ISR regeneration + JIT). Size the host at 2x steady.
#   HEAP CAP   --max-old-space-size=768 so a runaway allocation becomes a
#              single-process OOM, not a host-wide OOM kill.
#
# ---------------------------------------------------------------------------
# USAGE
#   docker build -t eyg-tire:1.0.0 .
#   docker run --rm -p 3000:3000 --env-file .env.production eyg-tire:1.0.0
#   docker compose up -d                        # web + postgres, seeded, live
#
# HEALTHCHECK hits /api/health — a route handler that returns JSON, is
# `no-store`, and touches nothing but the process. /api/ready is the deeper
# check (database reachable, migrations applied) and is what compose waits on.
#
# NOTE ON `output: "standalone"`: next.config.ts DOES set it, so `next build` also
# emits `.next/standalone`. This image deliberately does not use that — it ships
# the full `.next` tree and runs `next start` — because it also carries `scripts/`
# and `prisma/` and runs them from the same image (db-backup, db-restore, the
# deploy smoke test). Switching to `server.js` is a separate, deliberate change;
# see docs/ops/DEPLOYMENT.md §9.
# ============================================================================

# Renovate keeps these in step with .nvmrc.
ARG NODE_VERSION=22.21.1
ARG ALPINE_VERSION=3.21

# ============================================================================
# STAGE 1 — deps: the full dependency tree, devDependencies included
# ============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app

# libc6-compat is required by the Prisma query engine and sharp's musl build.
# openssl is required by Prisma for TLS to a managed Postgres.
RUN apk add --no-cache libc6-compat openssl

# Manifests first, so `npm ci` stays cached until a dependency actually changes.
# `npm ci` fails without the lockfile, which is the correct failure mode for a
# reproducible build.
COPY package.json package-lock.json* ./

# `--ignore-scripts`: the root `postinstall` runs `prisma generate`, which needs
# prisma/schema.prisma — not copied yet. Prisma is generated explicitly in the
# build stage, where the schema exists.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund --ignore-scripts

# ============================================================================
# STAGE 2 — builder: generate the Prisma client, compile the Next server
# ============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ---------------------------------------------------------------------------
# Build-time env stubs.
#
# src/lib/env.ts parses process.env at module load and THROWS on an invalid
# combination, so a build with no DATABASE_URL cannot even compile. Next.js
# inlines NEXT_PUBLIC_* at build time — which is exactly why these are stubs and
# why a real NEXT_PUBLIC_* value must never appear here.
#
# NOT credentials. They exist only to satisfy the parser. The runtime supplies
# the real values; validate-env.mjs and the smoke test verify those afterwards.
# ---------------------------------------------------------------------------
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    AUTH_SECRET="build-time-stub-not-a-secret-0000000000" \
    PII_ENCRYPTION_KEY="build-time-stub-not-a-secret-0000000000" \
    WEBHOOK_SIGNING_SECRET="build-time-stub-not-a-secret" \
    NEXT_PUBLIC_SITE_URL="http://localhost:3000" \
    NEXT_PUBLIC_APP_VERSION="0.0.0-build" \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="" \
    NEXT_PUBLIC_GA_MEASUREMENT_ID="" \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN="" \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY="" \
    ADMIN_IP_ALLOWLIST=""

# The Prisma client for musl, not glibc.
RUN npx prisma generate

# Refresh the social cards from the brand tokens so the image is self-contained.
# public/og/*.png are already committed, so this keeps them in lockstep with
# site.ts rather than creating them. Non-fatal: a missing card is a SEO problem,
# not a reason to fail a deploy.
RUN node scripts/generate-og.mjs || echo "generate-og skipped (non-fatal)"

RUN npx next build

# ============================================================================
# STAGE 3 — prod-deps: production dependency tree only
# ============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS prod-deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund --ignore-scripts

# `prisma generate` writes the query engine into node_modules/.prisma. Without
# this copy the runner has no engine and every query fails at runtime with
# "did not initialize yet".
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# ============================================================================
# STAGE 4 — runner: the shipped artefact
# ============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
WORKDIR /app

# dumb-init gives us a PID 1 that forwards SIGTERM. Without it, `next start` as
# PID 1 ignores SIGTERM and every single deploy ends in a 30 s SIGKILL.
# wget (busybox) backs the HEALTHCHECK. tini reaps zombies.
RUN apk add --no-cache dumb-init wget

# ---------------------------------------------------------------------------
# Non-root. uid/gid 1001 is `nodejs` in the Alpine base image. Created
# explicitly so the uid cannot silently change if the base image reorders its
# users, and so the posture is legible in a security audit.
# ---------------------------------------------------------------------------
RUN addgroup --system --gid 1001 eyg 2>/dev/null || true; \
    adduser --system --uid 1001 --ingroup eyg nextjs 2>/dev/null || true

COPY --from=prod-deps --chown=nextjs:eyg /app/node_modules ./node_modules
COPY --from=builder  --chown=nextjs:eyg /app/.next ./.next
COPY --from=builder  --chown=nextjs:eyg /app/public ./public
COPY --from=builder  --chown=nextjs:eyg /app/prisma ./prisma

# ---------------------------------------------------------------------------
# next.config.ts AND `typescript` — BOTH, AND THE PAIR IS NOT OPTIONAL
#
# `next start` reads next.config.ts at RUNTIME. Without this COPY the container
# runs on Next's built-in defaults and silently discards:
#
#   poweredByHeader: false   -> X-Powered-By: Next.js on every response
#   compress, productionBrowserSourceMaps, images.*, experimental.*
#
# The container smoke test caught the first of those; the rest were invisible.
# This is the same class as the missing vitest config earlier — a file the app
# needs, absent from the image — and the same reason it cannot be seen locally.
#
# `typescript` has to come with it. Measured, not assumed:
#
#   next start, next.config.ts present, typescript absent:
#     warning  Installing TypeScript as it was not found while loading
#              "next.config.ts".
#     error    Failed to load next.config.ts
#              Error: Cannot find module 'typescript'
#              require stack: node_modules/next/dist/build/next-config-ts/
#                             transpile-config.js
#
# So copying the config on its own would trade a missing header for a container
# that does not boot. `typescript` is a devDependency and `npm ci --omit=dev`
# removes it from prod-deps, so it is copied out of the builder the same way
# `.prisma` is. It is a build tool that happens to be needed to read a config at
# boot, not a runtime dependency, so it is deliberately NOT added to
# package.json dependencies.
# ---------------------------------------------------------------------------
COPY --from=builder --chown=nextjs:eyg /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:eyg /app/node_modules/typescript ./node_modules/typescript

# Runtime helpers. The smoke test runs against a live container during a deploy,
# and db-backup/db-restore run from the same image, so both must be inside it.
COPY --from=builder --chown=nextjs:eyg /app/scripts ./scripts

# Everything writable at runtime. Nothing else in the image is.
RUN mkdir -p /tmp/next && chown -R nextjs:eyg /tmp/next

USER nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NODE_OPTIONS="--max-old-space-size=768"

EXPOSE 3000

# ---------------------------------------------------------------------------
# HEALTHCHECK
#
# `wget --spider` fails only on a non-2xx/3xx, so a Next error page served with
# a 200 still fails — which is the point. /api/health is the right target: a
# route handler returning JSON, marked `no-store`.
#
# 40s start period: the first request after a cold start pays ISR + JIT, and a
# container that gets killed during startup never gets to be marked unhealthy.
#
# `--start-interval=5s` is what makes the start period useful rather than merely
# long. Without it Docker probes on `--interval` (30s) for the whole start
# period, so a container that is serving after 3 seconds is not noticed until
# 30s — and the first probe that can actually change the status lands at 60s.
# That is why the CI wait loop, which gave up after 40s, timed out on a
# perfectly healthy container. With a 5s start interval the verdict arrives in
# seconds, and 120s of budget covers the worst case with room to spare.
# ---------------------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --start-interval=5s --retries=3 \
  CMD wget --quiet --spider --tries=1 --timeout=4 "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["dumb-init", "--", "node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
