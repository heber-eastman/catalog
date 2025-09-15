# Frontend Dockerfile for production deployment
# Build stage
FROM node:18-alpine AS build

# Accept build arguments
ARG VITE_API_BASE_URL=https://api.catalog.golf/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm install && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY index.html ./
COPY vite.config.js ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Create non-root user
RUN adduser -S catalog -u 1001 -G nginx

# Change ownership of nginx directories
RUN chown -R catalog:nginx /var/cache/nginx && \
    chown -R catalog:nginx /var/log/nginx && \
    chown -R catalog:nginx /etc/nginx/conf.d

# Make sure catalog user can write to pid file
RUN touch /var/run/nginx.pid && \
    chown -R catalog:nginx /var/run/nginx.pid

USER catalog

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 