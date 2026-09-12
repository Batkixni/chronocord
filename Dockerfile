# ==============================================================================
# Chronocord Multi-Stage Production Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React 19 Frontend Dashboard
# ------------------------------------------------------------------------------
FROM node:22-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Server & Bot Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY src/ ./src/

# Copy compiled React frontend assets from builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Expose Web Dashboard port
EXPOSE 3001

# Start Chronocord (Bot + Web Dashboard)
CMD ["node", "src/index.js"]
