#!/bin/bash
# Build dist/ and out/<NAME>_app_vNN.zip for static hosting, plus the host administrator's handoff next to the zip.
# usage: tools/package_app.sh NAME VERSION     e.g. tools/package_app.sh APPA 01
set -e
cd "$(dirname "$0")/.."
NAME=${1:-APP}; V=${2:-01}
rm -rf dist && mkdir -p dist/assets
cp index.html dist/
cp -R src project vendor dist/
rm -f dist/src/film.js   # the video renderer is not part of the hosted app
# assets the app loads: routes, logos, the tour music if any
for f in assets/*; do case "$f" in *.json|*.png|*.jpg|*.mp3|*.webp|*.svg) cp "$f" dist/assets/ ;; esac; done
cp tools/htaccess.txt dist/.htaccess
[ -f tools/HANDOFF.md ] && cp tools/HANDOFF.md dist/HANDOFF_FOR_SYSADMIN.md
find dist -name '.DS_Store' -delete
mkdir -p out; rm -f "out/${NAME}_app_v$V.zip"
(cd dist && zip -qr -X "../out/${NAME}_app_v$V.zip" .)
[ -f tools/HANDOFF.md ] && cp tools/HANDOFF.md "out/${NAME}_app_v${V}_HANDOFF_FOR_SYSADMIN.md"
ls -la "out/${NAME}_app_v$V.zip"; echo "files: $(find dist -type f | wc -l | tr -d ' ')   unzipped: $(du -sh dist | cut -f1)"
