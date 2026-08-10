#!/bin/sh
set -eu

AUTH_STORE_PATH="${AUTH_USER_STORE_PATH:-/app/backend/storage/auth/auth-users.json}"
AUTH_STORE_DIR="$(dirname "$AUTH_STORE_PATH")"
CARGAS_DIR="${AURORA_CARGAS_DIR:-/app/backend/storage/cargas_bd}"

mkdir -p "$AUTH_STORE_DIR" "$CARGAS_DIR"
chown -R node:node "$AUTH_STORE_DIR" "$CARGAS_DIR"

exec gosu node "$@"
