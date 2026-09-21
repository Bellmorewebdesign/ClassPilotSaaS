# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# ClassPilot API
#
# Multi-stage so the runtime image carries only production dependencies and
# compiled JavaScript -- no TypeScript, no test tooling, no source maps.
#
# The service is stateless: it writes nothing to disk and holds no local
# state, so the container can be replaced or scaled without coordination.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- dependencies ----------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
# Only the API and its workspace dependency are installed; the web app and the
# extension are irrelevant to this image.
RUN pnpm install --frozen-lockfile --filter @classpilot/api... --filter @classpilot/shared

# --- build -----------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @classpilot/shared build \
 && pnpm --filter @classpilot/api build

# --- runtime ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# Containers must bind all interfaces, not loopback, or nothing can reach them.
ENV API_HOST=0.0.0.0
ENV API_PORT=4000

COPY --from=build /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist

RUN pnpm install --frozen-lockfile --prod --filter @classpilot/api... --filter @classpilot/shared

# Run unprivileged. node:alpine ships a "node" user for exactly this.
USER node

EXPOSE 4000

# Uses the API's own /health endpoint, which reports database reachability.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
