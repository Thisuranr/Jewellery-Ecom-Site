# Production image for the Medusa backend (@dtc/backend), Azira.
#
# Build from the repo root (the context is filtered by /.dockerignore):
#   docker build -f infra/docker/backend.Dockerfile \
#     --build-arg ADMIN_BACKEND_URL=https://admin.azira.com.au \
#     --build-arg GIT_SHA="$(git rev-parse HEAD)" \
#     -t azira-backend:local .
#
# ADMIN_BACKEND_URL is baked into the admin dashboard bundle (medusa-config.ts
# reads it as MEDUSA_BACKEND_URL at build time). No secret is needed or used at
# build time: `medusa build` loads the config but connects to nothing.
#
# Base image (all stages): Node 22.23.4 on Debian bookworm slim. glibc, because
# sharp's prebuilt binaries are glibc builds. 22.23.4 is the minimum in package.json engines and
# a security release (2026-10-20), so it is used although it is younger than the
# usual two weeks. The digest is the multi-arch index digest, read from the
# Docker Hub registry on 2026-10-29. OWNER: before the first production build,
# re-check it with `docker buildx imagetools inspect node:22.23.4-bookworm-slim`
#. The tag is rebuilt upstream for Debian fixes, so a newer digest
# for the same tag is expected over time; update it deliberately.
ARG NODE_IMAGE=node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da

# ---------------------------------------------------------------------------
# pnpm: Node plus pnpm 10.28.0 (root package.json "packageManager"), installed
# by corepack and checked against the npm registry's sha512 for that tarball.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS pnpm
ENV CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_HOME=/opt/corepack \
    MEDUSA_DISABLE_TELEMETRY=true
RUN corepack enable pnpm \
 && corepack install -g pnpm@10.28.0+sha512.05df71d1421f21399e053fde567cea34d446fa02c76571441bfc1c7956e98e363088982d940465fd34480d4d90a0668bc12362f8aa88000a64e83d0b0e47be48 \
 && pnpm --version
WORKDIR /repo

# ---------------------------------------------------------------------------
# deps: every package in the lockfile, fetched into a store inside the image.
# Only the lockfile and workspace settings are copied, so this layer is reused
# until pnpm-lock.yaml (or the root manifest's overrides) change. `pnpm fetch`
# cannot be filtered, so the store also holds the storefront's packages; they
# never reach the runtime stage.
# ---------------------------------------------------------------------------
FROM pnpm AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN pnpm fetch --store-dir /pnpm/store

# ---------------------------------------------------------------------------
# build: install the backend and its workspace dependencies from that store
# only (--offline: nothing is resolved or downloaded, --frozen-lockfile: the
# lockfile must match every workspace manifest), then `medusa build`.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm install --offline --frozen-lockfile --store-dir /pnpm/store --filter "@dtc/backend..."

ARG ADMIN_BACKEND_URL
WORKDIR /repo/apps/backend
RUN test -n "${ADMIN_BACKEND_URL}" || { echo "build arg ADMIN_BACKEND_URL is required" >&2; exit 1; } \
 && MEDUSA_BACKEND_URL="${ADMIN_BACKEND_URL}" ./node_modules/.bin/medusa build

# Production dependencies only, from the same lockfile and store.
# pnpm 10 deploys from the shared workspace lockfile when
# injectWorkspacePackages is true (pnpm-workspace.yaml). Do not use --legacy:
# (seen in pnpm 10.11.1) it runs a plain workspace install and leaves /app/node_modules
# empty (exit 0), which the `test -x` below catches. --prefer-offline lets it
# fetch registry metadata, which `pnpm fetch` does not cache.
# Deployed straight to /app so the .bin shims' paths stay valid in the runtime
# stage. The runtime stage takes only /app/node_modules from here, and the
# compiled app from .medusa/server.
WORKDIR /repo
RUN pnpm --filter @dtc/backend deploy --prod --prefer-offline --store-dir /pnpm/store /app \
 && test -x /app/node_modules/.bin/medusa

# ---------------------------------------------------------------------------
# runtime: compiled app + production node_modules, owned by root and read-only
# for the unprivileged `node` user (uid 1000) the process runs as. No pnpm, no
# sources, no build tools beyond what Medusa itself depends on.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="azira-backend" \
      org.opencontainers.image.revision="${GIT_SHA}"
# TZ=UTC: Medusa's scheduler reads the process clock. The compose file sets it too.
ENV NODE_ENV=production \
    MEDUSA_DISABLE_TELEMETRY=true
ENV TZ=UTC
# Sentry release = the image's git sha (review batch, small item). The env file must not
# set SENTRY_RELEASE: an empty value there would override this.
ENV SENTRY_RELEASE=${GIT_SHA}
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /repo/apps/backend/.medusa/server/ ./
USER node
EXPOSE 9000
# No curl in the slim image; Node 22 has fetch.
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:9000/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# The medusa binary by its direct path (never npx). The migrate job in
# infra/compose/docker-compose.prod.yml runs the same binary with db:migrate.
CMD ["/app/node_modules/.bin/medusa", "start"]
