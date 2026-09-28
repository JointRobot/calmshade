#!/bin/bash
# The style gate: render the same moment in every look and tile them into one contact sheet to choose from.
# usage: tools/style_gate.sh [time_in_tour=30] [camera "x,y,z,S"=a venue close-up] [looks="A B C D E F G H I J"]
set -e
cd "$(dirname "$0")/.."
T=${1:-30}; CAM=${2:-}; LOOKS=${3:-"A B C D E F G H I J"}
OUT=out/style_gate; rm -rf "$OUT"; mkdir -p "$OUT"
for L in $LOOKS; do
  if [ -n "$CAM" ]; then echo "[{\"name\":\"look_$L\",\"t\":$T,\"cam\":[$CAM]}]" > "$OUT/shot.json"; else echo "[{\"name\":\"look_$L\",\"t\":$T}]" > "$OUT/shot.json"; fi
  PAGE="film.html?style=$L&pr=1" node tools/render.mjs shots "$OUT/shot.json" "$OUT" >/dev/null 2>&1 && echo "look $L done"
done
ffmpeg -v error -y -pattern_type glob -i "$OUT/look_*.png" -vf "scale=960:-1,tile=3x4:padding=6" -frames:v 1 "$OUT/style_gate.jpg"
echo "wrote $OUT/style_gate.jpg (order: $LOOKS)"
