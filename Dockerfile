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
# fontconfig + a monospace font so scripts/gen-preview.js (sharp/librsvg)
# can render the OG card text at runtime (assets/ is a persistent volume,
# so the preview is generated on boot, not baked into the image).
RUN apk add --no-cache fontconfig ttf-dejavu
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY db ./db
COPY scripts ./scripts
COPY public ./public

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1
CMD ["node", "server/index.js"]
