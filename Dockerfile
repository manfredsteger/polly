# KITA Poll - Docker Configuration
# Optimized multi-stage build for smaller production image
# Uses PUPPETEER_SKIP_CHROMIUM_DOWNLOAD to avoid 300MB bundled Chromium

# ============================================
# Stage 1: Dependencies (build tools + native modules)
# ============================================
FROM node:22-slim AS deps

# Install build dependencies for native modules (canvas, pdfkit)
# Note: Clean apt cache completely and refresh to avoid GPG signature errors
RUN rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* && \
    apt-get clean && \
    apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer Chromium download (we use system Chromium in production)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci && npm cache clean --force

# ============================================
# Stage 2: Builder (compile TypeScript + Vite)
# ============================================
FROM node:22-slim AS builder

# Skip Puppeteer Chromium download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy source files (only what's needed for build)
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
# Stage 3: Production Runtime
# ============================================
FROM node:22-slim AS production

# Install minimal runtime dependencies
# - canvas/pdfkit: libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 libpixman-1-0
# - Puppeteer: chromium (system installation, not bundled)
# - Database: postgresql-client (for pg_isready)
# - Utilities: wget for health checks
# Note: Clean apt cache completely and refresh to avoid GPG signature errors
RUN rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* && \
    apt-get clean && \
    apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    libpixman-1-0 \
    chromium \
    fonts-liberation \
    postgresql-client \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

# Configure Puppeteer to use system Chromium (skip bundled download)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy node_modules from deps stage (with Puppeteer Chromium skipped)
COPY --from=deps /app/node_modules ./node_modules

# Copy server source (needed for tsx runtime)
COPY --from=builder /app/server ./server
# Copy server tests directly from context (needed for admin test panel functionality)
COPY server/tests ./server/tests
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/vite.config.ts ./

# Copy migrations for schema setup
COPY migrations ./migrations

# Copy built frontend
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
