#!/bin/sh
# Brings the port up to the Next.js site it sits in (or the one given):
# regenerates the handoff content, copies the design files into the theme,
# then rebuilds theme.json, the page files and the patterns. Review the diff,
# run the checks in README.md, then package and deploy.
#
#   sh tools/refresh-from-source.sh [source-repo] [YYYY-MM-DD]
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC=$(cd "${1:-$ROOT/..}" && pwd)
TODAY=${2:-$(date +%F)}
cd "$ROOT/source"
sh tools/build_package.sh "$SRC" . "$TODAY"
# Not ported, so not vendored: the staging gate page and the raw inventory.
rm -rf inventory content/main/gate.html content/text/gate.txt
cd "$ROOT"
node tools/sync-theme-assets.mjs --source "$SRC"
node tools/build-theme-json.mjs
node tools/html-to-blocks.mjs
node tools/build-patterns.mjs
git -C "$ROOT" status --short -- .
