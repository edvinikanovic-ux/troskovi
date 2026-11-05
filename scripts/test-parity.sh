#!/bin/bash
# Runs test/parity.test.ts: the same scenario against SQLite (src/main/db.ts) and the browser data
# layer (src/renderer/src/data/core.ts). better-sqlite3 is built for Electron, so it runs under
# Electron's Node.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="node_modules/.cache/parity"
mkdir -p "$OUT"
DATA="$(mktemp -d)"
trap 'rm -rf "$DATA"' EXIT
npx esbuild test/parity.test.ts --bundle --platform=node --format=cjs \
  --external:better-sqlite3 --alias:electron=./test/electron-stub.mjs \
  --outfile="$OUT/parity.cjs" --log-level=error
TEST_USERDATA="$DATA" ELECTRON_RUN_AS_NODE=1 npx electron "$OUT/parity.cjs"
