# KITA Poll - Docker Configuration
# Multi-stage build for production deployment
# Uses Debian-based images for better native module compatibility (canvas, puppeteer)

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:22-slim AS deps

# Install build dependencies for native modules (canvas, pdfkit)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM node:22-slim AS builder

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
FROM node:22-slim AS production

# Install runtime dependencies for:
# - canvas/pdfkit: libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 libpixman-1-0
# - Puppeteer/Chromium: chromium and dependencies
# - Database: postgresql-client (for pg_isready health checks)
# - Utilities: wget for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    libpixman-1-0 \
    chromium \
    fonts-freefont-ttf \
    postgresql-client \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Configure Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy node_modules from deps stage (includes pre-built native modules like canvas)
COPY --from=deps /app/node_modules ./node_modules

# Install additional runtime tools (tsx for TypeScript execution)
RUN npm install tsx drizzle-kit && \
    npm cache clean --force

# Copy server source (needed for tsx runtime)
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/vite.config.ts ./

# Copy built frontend to server/public (where serveStatic expects it)
COPY --from=builder /app/dist/public ./server/public

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
