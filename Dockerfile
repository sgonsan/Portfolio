# Stage 1: build Astro frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: production runtime
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY controllers ./controllers
COPY routes ./routes
COPY db ./db
COPY json ./json
COPY public ./public
COPY server.js .

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
