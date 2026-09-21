# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# ClassPilot web dashboard (Next.js)
#
# Built with output: "standalone" so the runtime image ships only the server
# and the files it actually traced, rather than the whole node_modules tree.
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
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @classpilot/web... --filter @classpilot/shared

# --- build -----------------------------------------------------------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @classpilot/shared build \
 && pnpm --filter @classpilot/web build

# --- runtime ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
