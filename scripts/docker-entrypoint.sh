#!/bin/sh
set -eu

AUTH_STORE_PATH="${AUTH_USER_STORE_PATH:-/app/backend/storage/auth/auth-users.json}"
AUTH_STORE_DIR="$(dirname "$AUTH_STORE_PATH")"
CARGAS_DIR="${AURORA_CARGAS_DIR:-/app/backend/storage/cargas_bd}"
REPORTES_DIR="${AURORA_REPORTES_DIR:-/app/backend/storage/reportes}"

resolve_backend_path() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '/app/backend/%s\n' "$1" ;;
  esac
}

# En Docker rootless, los certificados enlazados desde el host pueden aparecer
# como root:root y no ser legibles después de cambiar al usuario node. Se copian
# a un directorio efímero con permisos mínimos antes de bajar privilegios.
if [ -n "${HTTPS_KEY_PATH:-}" ] || [ -n "${HTTPS_CERT_PATH:-}" ]; then
  if [ -z "${HTTPS_KEY_PATH:-}" ] || [ -z "${HTTPS_CERT_PATH:-}" ]; then
    echo 'Para habilitar HTTPS configure HTTPS_KEY_PATH y HTTPS_CERT_PATH.' >&2
    exit 1
  fi

  TLS_SOURCE_KEY="$(resolve_backend_path "$HTTPS_KEY_PATH")"
  TLS_SOURCE_CERT="$(resolve_backend_path "$HTTPS_CERT_PATH")"
  TLS_RUNTIME_DIR=/run/aurora-certs
  install -d -o node -g node -m 0700 "$TLS_RUNTIME_DIR"
  install -o node -g node -m 0600 "$TLS_SOURCE_KEY" "$TLS_RUNTIME_DIR/aurora.key"
  install -o node -g node -m 0600 "$TLS_SOURCE_CERT" "$TLS_RUNTIME_DIR/aurora.crt"
  HTTPS_KEY_PATH="$TLS_RUNTIME_DIR/aurora.key"
  HTTPS_CERT_PATH="$TLS_RUNTIME_DIR/aurora.crt"
  export HTTPS_KEY_PATH HTTPS_CERT_PATH
fi

mkdir -p "$AUTH_STORE_DIR" "$CARGAS_DIR" "$REPORTES_DIR"
chown -R node:node "$AUTH_STORE_DIR" "$CARGAS_DIR" "$REPORTES_DIR"

exec gosu node "$@"
