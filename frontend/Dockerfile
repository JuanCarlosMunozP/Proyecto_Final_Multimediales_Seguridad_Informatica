# Etapa 1: Construcción del Frontend 3D (Vite + Three.js)
# Compatible con linux/arm64 (Raspberry Pi) y linux/amd64 (VPS)
FROM node:22-alpine AS frontend-builder

WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# Etapa 2: Gateway Nginx con TLS 1.3, Hardening y Reverse Proxy hacia /api/v1
FROM nginx:1.27-alpine

RUN apk add --no-cache openssl && \
    rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf && \
    mkdir -p /etc/nginx/certs /var/cache/nginx /var/run/nginx

COPY --from=frontend-builder /build/dist /usr/share/nginx/html
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/nginx/entrypoint-tls.sh /docker-entrypoint.d/05-generate-tls.sh
RUN chmod +x /docker-entrypoint.d/05-generate-tls.sh

EXPOSE 80 443

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-check-certificate -q -O /dev/null https://127.0.0.1:443/api/v1/health || exit 1
