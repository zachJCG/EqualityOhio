#!/bin/sh
# Zips the theme and the plugin for upload (Appearance → Themes → Upload,
# Plugins → Upload, or the WordPress.com theme/plugin upload tools).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-$ROOT/dist}
mkdir -p "$OUT"
cd "$ROOT/themes" && rm -f "$OUT/equality-ohio.zip" && zip -qr "$OUT/equality-ohio.zip" equality-ohio -x '*.DS_Store'
cd "$ROOT/plugins" && rm -f "$OUT/eo-site.zip" && zip -qr "$OUT/eo-site.zip" eo-site -x '*.DS_Store'
ls -la "$OUT"
