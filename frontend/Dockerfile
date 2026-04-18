# ============================================================================
# CoffeeChain Frontend — Next.js Dockerfile
# ============================================================================
# Multi-stage build for optimized production image
# Base: Node.js 21-alpine (matches Java 21 backend compatibility)

# ── Stage 1: Builder ──────────────────────────────────────────────────────
FROM node:21-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (include devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate OpenAPI types from backend schema
# (Skip if backend not yet ready — comment out and rebuild when backend starts)
# RUN npm run generate:api || echo "Warning: Could not generate API types"

# Build Next.js app with standalone output (smaller image)
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────
FROM node:21-alpine

WORKDIR /app

# Copy only the standalone server and static assets emitted by Next build.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || 3000; require('http').get('http://localhost:' + port, (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start Next.js app
CMD ["node", "server.js"]
