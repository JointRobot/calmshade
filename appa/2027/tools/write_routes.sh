#!/bin/bash
# Plan every walker's route once and save it to assets/routes.json (the app then starts about 2 s faster).
cd "$(dirname "$0")/.."
PAGE="film.html?pr=1" node tools/render.mjs eval "JSON.stringify(crowdRoutes())" 2>/dev/null | sed -n 2p | python3 -c "
import json,sys; R=json.loads(json.loads(sys.stdin.read())); json.dump(R, open('assets/routes.json','w'), separators=(',',':')); print(len(R), 'routes written to assets/routes.json')"
