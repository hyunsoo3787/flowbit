# Flowbit: one image with the API server, which also serves the web app.
# Build from the repository root:  docker build -f docker/Dockerfile -t flowbit .

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ---- Build everything -------------------------------------------------------
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm turbo run build --filter=@flowbit/api --filter=@flowbit/web

# ---- Production dependencies of the API only ---------------------------------
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter=@flowbit/api...

# ---- Runtime ----------------------------------------------------------------
# Same base image as the stages above, deliberately without extra packages:
# Prisma picks its migration engine by the OpenSSL it detects, so the runtime
# must look exactly like the stage that installed the engine. (Installing
# OpenSSL here made Prisma try to download a different engine at startup.)
# The engine doesn't link OpenSSL, so the "failed to detect libssl" warning
# printed at startup is harmless.
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WEB_DIST_DIR=/app/apps/web/dist
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json /app/apps/api/prisma.config.ts ./apps/api/
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY docker/entrypoint.sh /usr/local/bin/flowbit-entrypoint

USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["flowbit-entrypoint"]
CMD ["node", "--enable-source-maps", "dist/src/main.js"]
