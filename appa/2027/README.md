# isokit · an interactive isometric world, in pure code

This folder is a complete, working app and video pipeline: a diorama of a site (a festival, a gallery, a campus)
with animated people, clickable venues and exhibits whose controls do what they describe, a guided tour, and a
renderer for the tour video and deck frames. No image or video generation: everything is Three.js code.
The example project is **APPA Art Fest 2027** (one lake, seven venues).

## Run it
```
python3 tools/serve.py 8765 .        # then open http://127.0.0.1:8765  (app)   and  /film.html  (the tour as a video page)
```
Needs Chrome, Node 20+, Python 3, and ffmpeg for videos.

## What you edit: only `project/`
| File | What it holds |
|---|---|
| `project/site.js` | the map: bounds, ground, water, hills, paths, trees, areas (venues) built from kit parts, site-wide parts |
| `project/story.js` | story channels: what animates, on the tour timeline and as app defaults |
| `project/cast.js` | the people: walkers with plans, wanderers per area, cyclists on paths, performers on stages |
| `project/copy.js` | every word in the app, and what every control does |
| `project/tour.js` | the guided tour: camera keys, captions, subtitles, title and end cards |
| `project/look.js` | the look (a style preset), light tweaks, the app's colours and fonts |
| `assets/routes.json` | precomputed walking routes (regenerate after moving anything) |

The engine lives in `src/engine/` (world, looks, kit of parts, site builder, people, crowd, story channels, tour overlay)
and `src/app/app.js` (the interactive shell). Change them only to add a new kit part, channel type or control type.

## Commands
```
tools/style_gate.sh 40 "16,58,0,26"                                   # every look, same moment, one contact sheet
tools/validate.sh                                                     # crowd proof: hits, standing overlaps, lane conflicts must all be 0
tools/write_routes.sh                                                 # regenerate assets/routes.json after any layout change
PAGE="film.html?pr=1" node tools/render.mjs stills 4,20,40,60,80 out/check               # tour stills
PAGE="film.html?pr=1.5" node tools/render.mjs video out/tour.mp4 30 0 90 [score.wav]    # the tour video (optional)
WARM=25 node tools/probe_smooth.mjs tour 91 1440 860                  # real-window smoothness (opens a visible Chrome window): aim for 0 dropped frames
tools/package_app.sh APPA 01                                          # dist/ and out/APPA_app_v01.zip for hosting
```
