#!/bin/sh
# One-command start for sandbox previews.
#
# node_modules/ and views/dist/ are excluded from workspace snapshots, so a
# fresh session usually loses both. This reinstalls and rebuilds only when
# they are missing, then starts the server with the preview frameguard off.
#
# Usage: sh preview.sh
set -e
cd "$(dirname "$0")"

# The sandbox intercepts TLS and resets IPv6 connections; Node needs to be told
# about both or pnpm and outbound fetches fail.
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/etc/ssl/certs/ca-certificates.crt}"
export NODE_OPTIONS="--dns-result-order=ipv4first"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@10.18.0 --activate >/dev/null 2>&1 || true
fi

[ -d node_modules ] || pnpm install --ignore-scripts
[ -d views/dist ] || node run-command.mjs build

echo "Starting InvisiProxy on port 8080 (PREVIEW_MODE=1)..."
PREVIEW_MODE=1 exec node backend.js
