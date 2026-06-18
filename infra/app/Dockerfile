FROM oven/bun:1.2 AS builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID=mvbroker
ARG VITE_GOOGLE_MAPS_API_KEY
RUN bun run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.output ./.output
# ws é necessário para o polyfill de WebSocket do Supabase Realtime no Node 20
RUN npm install ws@8 --no-save --no-audit --no-fund
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
