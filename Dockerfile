FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 medito && useradd --system --uid 1001 --gid medito medito \
    && mkdir -p /app/data/documents && chown -R medito:medito /app
COPY --from=builder --chown=medito:medito /app/.next/standalone ./
COPY --from=builder --chown=medito:medito /app/.next/static ./.next/static
COPY --from=builder --chown=medito:medito /app/public ./public
COPY --from=builder --chown=medito:medito /app/migrations ./migrations
COPY --from=builder --chown=medito:medito /app/scripts/migrate.mjs /app/scripts/create-admin.mjs /app/scripts/seed.mjs ./scripts/
USER medito
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
