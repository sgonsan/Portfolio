# Stage 1: build Astro frontend
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: production runtime
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
# fontconfig + a monospace font: scripts/gen-preview.js (sharp/librsvg)
# re-renders the OG card at runtime — on boot, after a photo upload, and from
# the admin button — so the fonts must be present in the runtime image.
RUN apk add --no-cache fontconfig ttf-dejavu
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY db ./db
COPY scripts ./scripts
# node-owned: the app (USER node) writes into public/assets at runtime
# (preview.png, photo uploads), so it must own that dir — a root-owned
# COPY would make those writes fail with EACCES.
COPY --chown=node:node public ./public

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1
CMD ["node", "server/index.js"]
