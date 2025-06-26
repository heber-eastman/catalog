# Backend Dockerfile for production deployment
FROM node:18-alpine AS base

# Install dependencies needed for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY config/ ./config/

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S catalog -u 1001

# Change ownership of the app directory
RUN chown -R catalog:nodejs /app
USER catalog

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "src/index.js"] 