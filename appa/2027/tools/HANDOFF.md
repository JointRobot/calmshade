# APPA Art Fest 2027 interactive app: hosting handoff

**For:** the host administrator of olisands.cloud (Hostinger)
**Address to set up:** **https://olisands.cloud/appa/2027**
**From:** Nolabel Immersive (Amit Gupta, amit@nlbl.in)
**Package:** `APPA_app_v01.zip`

## 1. What this is

An interactive, browser-based 3D map of APPA Art Fest 2027: one lake, seven venues, animated visitors, and venues you can tap to see what happens there. It is a **static website**: one `index.html`, JavaScript modules, a 3D library, two logos and a small data file.

- No server code (no PHP, Node or Python), no database, no build step.
- No cookies, no analytics, no forms, no data sent anywhere.
- One external dependency: the web fonts load from Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`). Everything else is inside the folder.
- It lives in its own folder and does not touch the rest of olisands.cloud. All its paths are relative, so it runs from `/appa/2027/` as is.

## 2. Set it up (Hostinger hPanel, about 10 minutes)

1. **Open the site's files.** hPanel, Websites, olisands.cloud, File Manager. Go to the site's web root: `public_html` (on some plans `domains/olisands.cloud/public_html`).
2. **Create the folders.** Inside the web root, create a folder `appa`, and inside it a folder `2027`. The path is `public_html/appa/2027`.
3. **Upload and extract.** Upload `APPA_app_v01.zip` into `public_html/appa/2027`, right-click, Extract, then delete the zip.
   - `index.html` must sit **directly** in `2027`, at `public_html/appa/2027/index.html`. If extracting created a subfolder, move its contents up one level.
4. **Check the hidden file.** Turn on "show hidden files" in File Manager and confirm `.htaccess` is in `2027`, next to `index.html`. It sets the JavaScript file type, compression and caching for this folder only. The app will not start without the correct JavaScript type (see Troubleshooting).
5. **HTTPS.** olisands.cloud's existing SSL certificate already covers this address. No DNS or subdomain changes are needed.
6. **Open** https://olisands.cloud/appa/2027 and run the checks in section 4.

Permissions should be the Hostinger defaults: folders 755, files 644.

**If olisands.cloud runs WordPress or another CMS:** its standard rewrite rules serve real folders directly, so `/appa/2027` works without changes. If the CMS shows its own 404 page instead, see Troubleshooting.

## 3. What is in the folder

| Path | What it is |
|---|---|
| `index.html` | the app page |
| `.htaccess` | JavaScript/JSON file types, gzip, caching, no folder listing (this folder only) |
| `src/` | the app's engine: JavaScript modules (17 files) |
| `project/` | the festival's content: map, people, words, tour, look (6 files) |
| `vendor/three/` | the 3D library (Three.js r169), pinned and served locally |
| `assets/routes.json` | precomputed walking routes for the people on the map |
| `assets/nolabel_logo_*.png` | logos |
| `HANDOFF_FOR_SYSADMIN.md` | this document (safe to leave or delete) |

About 1.7 MB in total; a first visit downloads under 1 MB after compression.

## 4. Test checklist (5 minutes)

On a laptop in Chrome, Edge or Safari, open **https://olisands.cloud/appa/2027**:

- [ ] The address changes to end in `/appa/2027/` (with a slash). That is expected.
- [ ] The intro card appears. Within about 3 seconds its button changes from "Loading the festival…" to **Enter the festival**.
- [ ] Enter: the whole festival appears in 3D around the lake, with numbered venue pins 1 to 7. The numbers at the top fly the camera to each venue; dragging pans the map and scrolling zooms.
- [ ] Tap venue **5 Calmshet**, then "The main stage", then **Start the opening night**: the stage lights up and the crowd starts bouncing. **Make it night** turns the whole map to night.
- [ ] Back on the map (the APPA button), try **Light the lotus on the lake** and **Find Hidden APPA**.
- [ ] **Guided tour** (top right): the camera flies through every venue with captions for 90 seconds, then returns to the map. The tour is silent.
- [ ] Browser developer tools (F12): no red errors in the Console, no 404s in Network.
- [ ] Repeat quickly on a phone or tablet (it uses a lighter quality automatically).

**Smoothness check (optional):** open https://olisands.cloud/appa/2027/?perf=1 . A small green panel shows the frame rate; the guided tour should hold about 60 fps on a recent laptop.

## 5. Browser support

The app needs **WebGL 2** and **JavaScript import maps**:

- Chrome or Edge 89 or later
- Safari 16.4 or later (macOS, iPhone, iPad)
- Firefox 108 or later

Older browsers show the intro card but the map will not start.

## 6. Address options (for testing only)

| Add to the address | Effect |
|---|---|
| `?q=low` | lighter quality (older laptops, projectors) |
| `?q=high` | full quality on tablets |
| `?perf=1` | shows the frame-rate panel |
| `?pr=1.25` | fixes the render sharpness (normally chosen automatically) |

Example: `https://olisands.cloud/appa/2027/?q=low`

## 7. Updating later

1. In `public_html/appa/2027`, delete the old `index.html`, `src/`, `project/`, `vendor/` and `assets/`.
2. Upload and extract the new zip the same way. Keep `.htaccess`.
3. If Hostinger's CDN or LiteSpeed cache is switched on for olisands.cloud, purge it.

Pages and scripts are set to re-check on every visit, so visitors get the new version straight away.

## 8. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Intro card stays on "Loading the festival…" | The `.js` files are not served as JavaScript. Confirm `.htaccess` is in `2027`. In the browser's Network tab, a `.js` file's `Content-Type` must be `text/javascript` or `application/javascript`, not `text/plain` or `application/octet-stream`. |
| The main site's 404 page shows instead | The main site's rewrite rules are catching the path. Check the folder is exactly `public_html/appa/2027` with `index.html` inside. If it is, add this line near the top of `public_html/.htaccess`, before the main site's rules: `RewriteRule ^appa/2027(/.*)?$ - [L]` |
| A folder listing or blank page shows | `index.html` is in a subfolder (for example `2027/APPA_app_v01/`). Move the contents up into `2027`. |
| 404 errors for `src/…` or `project/…` files | The folder structure changed during upload. Re-extract the zip as is, keeping all folders. |
| 403 Forbidden | Permissions: folders 755, files 644. |
| Fonts look plain (Georgia or Arial) | Google Fonts is blocked by a firewall or a Content-Security-Policy on the main site. Allow `fonts.googleapis.com` and `fonts.gstatic.com`. The app still works. |
| An old version keeps showing | Purge Hostinger's CDN or LiteSpeed cache, then hard-reload (Cmd+Shift+R or Ctrl+F5). |

## 9. Optional: keep it private

To share it only with the client for now, use hPanel, Advanced, Password Protect Directories on `public_html/appa/2027`. Send the client the username and password separately.
