#!/bin/sh
# Rebuild the generated parts of the handoff package. Usage: build_package.sh <repo> <package dir> <today>
set -eu
REPO="$1"; PKG="$2"; TODAY="$3"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(mktemp -d)"
node "$HERE/dump-config.mjs" "$REPO" "$OUT"
python3 -I "$HERE/analyze.py" "$REPO" "$OUT/config.json" "$OUT" "$TODAY"
python3 -I "$HERE/expand_redirects.py" "$REPO" "$OUT/config.json" "$OUT/content/pages.json" "$OUT"
rm -rf "$PKG/content" "$PKG/redirects" "$PKG/inventory" "$PKG/reference"
mkdir -p "$PKG/inventory" "$PKG/reference"
cp -r "$OUT/content" "$PKG/content"
cp -r "$OUT/redirects" "$PKG/redirects"
cp "$OUT/inventory.json" "$PKG/inventory/inventory.json"
cp "$OUT/config.json" "$PKG/inventory/next-config-dump.json"
python3 -I "$HERE/build_reference.py" "$OUT" "$PKG" "$HERE/templates"
rm -rf "$OUT"
