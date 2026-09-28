#!/bin/bash
# Prove the crowd: nobody inside anything, nobody standing in anybody, cyclist lanes clear. All three counts must be 0.
cd "$(dirname "$0")/.."
PAGE="film.html?pr=1" node tools/render.mjs eval "JSON.stringify(validateCrowd(0.1))" 2>/dev/null | sed -n 2p | python3 -c "
import json,sys; v=json.loads(json.loads(sys.stdin.read()))
print('people', v['people'], '| hits', len(v['hits']), '| standing overlaps', len(v['pairs']), '| lane conflicts', len(v['lanes']))
for k in ('hits','pairs','lanes'):
    for x in v[k][:12]: print(' ', k, x)
sys.exit(1 if (v['hits'] or v['pairs'] or v['lanes']) else 0)"
