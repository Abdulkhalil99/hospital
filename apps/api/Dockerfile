# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.33.2

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json          ./apps/api/
COPY packages/                      ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/api/ ./apps/api/

# Build
RUN pnpm --filter @medicore/api... build

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm@10.33.2

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared-constants/dist ./packages/shared-constants/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-validators/dist ./packages/shared-validators/dist
COPY apps/api/src/infrastructure/database/migrations ./apps/api/dist/infrastructure/database/migrations

# Non-root user
RUN addgroup --system medicore && adduser --system --ingroup medicore medicore
USER medicore
WORKDIR /app/apps/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
