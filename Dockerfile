# KITA Poll - Docker Configuration
# Multi-stage build for production deployment

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# Install build dependencies for native modules (canvas, pdfkit)
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy source files
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY drizzle.config.ts ./

# Build the frontend (Vite)
RUN npm run build

# ============================================
# Stage 3: Production
# ============================================
FROM node:20-alpine AS production

# Install runtime dependencies for:
# - canvas/pdfkit: cairo pango jpeg giflib
# - Puppeteer/Chromium: chromium nss freetype harfbuzz ttf-freefont
# - Database: postgresql-client (for pg_isready health checks)
RUN apk add --no-cache \
    cairo pango jpeg giflib \
    chromium nss freetype harfbuzz ttf-freefont \
    postgresql-client

# Configure Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only, plus tsx for running TypeScript
RUN npm ci --only=production && \
    npm install tsx drizzle-kit && \
    npm cache clean --force

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server source (needed for tsx runtime)
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config.ts ./

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create uploads directory with correct permissions
RUN mkdir -p uploads && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Use entrypoint for automatic setup
ENTRYPOINT ["./docker-entrypoint.sh"]
