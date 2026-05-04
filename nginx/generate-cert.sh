#!/bin/sh
# Generate a self-signed TLS certificate for development if one doesn't exist.
CERT_DIR=/etc/nginx/ssl
if [ ! -f "$CERT_DIR/cert.pem" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$CERT_DIR/key.pem" \
    -out    "$CERT_DIR/cert.pem" \
    -days 365 -nodes \
    -subj "/C=AL/ST=Kosovo/L=Prishtine/O=NexusHR/CN=localhost"
  echo "[nginx] Self-signed TLS certificate generated at $CERT_DIR"
fi
