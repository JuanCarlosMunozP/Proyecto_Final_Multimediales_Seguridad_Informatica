#!/bin/sh
set -e

CERT_DIR="/etc/nginx/certs"
CRT_FILE="${CERT_DIR}/server.crt"
KEY_FILE="${CERT_DIR}/server.key"
CN_DOMAIN="${TLS_DOMAIN:-idolo-raspberry.local}"

mkdir -p "${CERT_DIR}"

if [ ! -f "${CRT_FILE}" ] || [ ! -f "${KEY_FILE}" ]; then
    echo "[nginx-tls] No se encontró certificado externo en ${CERT_DIR}. Generando certificado TLS ECDSA P-256 para ${CN_DOMAIN}..."
    openssl req -x509 -nodes -days 365 \
        -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
        -keyout "${KEY_FILE}" \
        -out "${CRT_FILE}" \
        -subj "/C=CO/ST=Bogota/L=Bogota/O=SeguridadMultimedia/CN=${CN_DOMAIN}" \
        -addext "subjectAltName=DNS:${CN_DOMAIN},DNS:localhost,IP:127.0.0.1"
    chmod 600 "${KEY_FILE}"
    chmod 644 "${CRT_FILE}"
fi
