FROM node:20-alpine AS base

# ── Stage 1: production dependencies (no devDeps, no postinstall scripts) ─────
FROM base AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: full build ───────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Generate Prisma client with native query-engine binaries
RUN npx prisma generate
RUN npm run build

# ── Stage 3: lean runtime image ───────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Production node_modules (no devDeps, postinstall skipped)
COPY --from=deps-prod --chown=nextjs:nodejs /app/node_modules ./node_modules

# Prisma: overlay generated client + CLI on top of prod deps
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma       ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma        ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma         ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma    ./node_modules/.bin/prisma

# Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next       ./.next
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Prisma migrations + config (needed for migrate deploy at startup)
COPY --chown=nextjs:nodejs prisma         ./prisma
COPY --chown=nextjs:nodejs prisma.config.ts ./prisma.config.ts

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
