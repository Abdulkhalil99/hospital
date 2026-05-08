FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/web/package.json   ./apps/web/
COPY packages/               ./packages/

RUN pnpm install --frozen-lockfile

COPY apps/web/ ./apps/web/

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN pnpm --filter @medicore/web build

FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm@9

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /app/apps/web/public           ./apps/web/public

RUN addgroup --system medicore && adduser --system --ingroup medicore medicore
USER medicore

EXPOSE 3001
ENV PORT=3001

CMD ["node", "apps/web/server.js"]
