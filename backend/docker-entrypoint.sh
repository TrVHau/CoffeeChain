#!/usr/bin/env sh
set -e

prepare_crypto_from_archive() {
  if [ -f "/crypto/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem" ]; then
    return 0
  fi

  mkdir -p /crypto

  if [ -n "${FABRIC_CRYPTO_ARCHIVE_PATH:-}" ] && [ -f "${FABRIC_CRYPTO_ARCHIVE_PATH}" ]; then
    tar -xzf "${FABRIC_CRYPTO_ARCHIVE_PATH}" -C /crypto
    return 0
  fi

  if [ -n "${FABRIC_CRYPTO_ARCHIVE_BASE64_PATH:-}" ] && [ -f "${FABRIC_CRYPTO_ARCHIVE_BASE64_PATH}" ]; then
    base64 -d "${FABRIC_CRYPTO_ARCHIVE_BASE64_PATH}" | tar -xz -C /crypto
    return 0
  fi

  if [ -n "${FABRIC_CRYPTO_ARCHIVE_B64:-}" ]; then
    printf '%s' "${FABRIC_CRYPTO_ARCHIVE_B64}" | base64 -d | tar -xz -C /crypto
    return 0
  fi

  echo "WARN: Fabric crypto archive is not provided. Set one of FABRIC_CRYPTO_ARCHIVE_PATH, FABRIC_CRYPTO_ARCHIVE_BASE64_PATH, FABRIC_CRYPTO_ARCHIVE_B64"
}

prepare_crypto_from_archive

exec java -jar /app/app.jar
