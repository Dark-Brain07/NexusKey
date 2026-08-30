# NexusKey API — production image for Fly.io
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @nexuskey/api...

FROM base AS build
COPY --from=deps /app /app
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY tsconfig.base.json tsconfig.base.json
RUN pnpm --filter @nexuskey/shared build && pnpm --filter @nexuskey/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_module[s] ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/dis[t] ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/src/db/migrations ./apps/api/dist/db/migrations
# pnpm workspaces resolve packages via symlinks rooted in each workspace
# member's own node_modules, not only the repo-root one -- Node's module
# resolution walks up from the importing file and needs these too, or
# even a dependency declared correctly in package.json (e.g. "pg") fails
# to resolve at runtime with ERR_MODULE_NOT_FOUND.
COPY --from=build /app/apps/api/node_module[s] ./apps/api/node_modules
COPY --from=build /app/packages/shared/node_module[s] ./packages/shared/node_modules

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/health/live || exit 1

CMD ["node", "apps/api/dist/index.js"]
