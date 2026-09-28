<!-- Handoff for the client's host administrator. Replace every {{…}}, delete the setup variant you do not use,
     and verify every button name, file count and size against the actual build before sending. -->
# {{PROJECT}} interactive app: hosting handoff

**For:** the host administrator of {{DOMAIN}} ({{HOST, e.g. Hostinger}})
**Address to set up:** **{{FULL_URL}}**
**From:** Nolabel Immersive ({{CONTACT_NAME}}, {{CONTACT_EMAIL}})
**Package:** `{{ZIP_NAME}}`

## 1. What this is

{{PROJECT}} is an interactive, browser-based walkthrough of {{ONE LINE: the gallery}}. It is a **static website**: one `index.html`, JavaScript modules, a 3D library and a few assets.

- No server code (no PHP, Node or Python), no database, no build step.
- No cookies, no analytics, no forms, no data sent anywhere.
- External dependency: {{e.g. Google Fonts (fonts.googleapis.com, fonts.gstatic.com), or "none"}}. Everything else is inside the folder.
- All paths are relative, so it runs from its own folder without touching the rest of the site.

## 2. Set it up (about 10 minutes)

### Variant A: a folder on an existing site ({{FULL_URL}})
1. **Open the site's files.** hPanel, Websites, {{DOMAIN}}, File Manager. Go to the web root: `public_html` (on some plans `domains/{{DOMAIN}}/public_html`).
2. **Create the folders** `{{FOLDER_PATH, e.g. pcsp/pulse}}` inside the web root. Folder names are lower case.
3. **Upload and extract** `{{ZIP_NAME}}` into that folder, then delete the zip. `index.html` must sit directly in the last folder, not in a subfolder.
4. **Check the hidden file.** Turn on "show hidden files" and confirm `.htaccess` sits next to `index.html`. It sets the JavaScript file type, compression and caching for this folder only.
5. **HTTPS** is covered by the site's existing certificate. No DNS changes are needed.
6. **Open** {{FULL_URL}} and run the checks in section 4.

If the site runs WordPress or another CMS, its standard rewrite rules serve real folders directly. If the CMS shows its own 404 page instead, see Troubleshooting.

### Variant B: a subdomain ({{SUBDOMAIN}}.{{DOMAIN}})
1. hPanel, Domains, Subdomains: create `{{SUBDOMAIN}}`. Note its folder. If DNS is managed elsewhere, add an `A` record pointing to the hosting IP.
2. Delete any default file the host placed in that folder (`default.php`, `index.php`).
3. Upload and extract the zip there; `index.html` directly in the folder.
4. Check `.htaccess` is present (show hidden files).
5. hPanel, Security, SSL: issue a certificate for the subdomain and force HTTPS.
6. Open the address and run the checks in section 4.

Permissions: folders 755, files 644.

## 3. What is in the folder

| Path | What it is |
|---|---|
| `index.html` | the app page |
| `.htaccess` | JavaScript/JSON/MP3 file types, gzip, caching, no folder listing |
| `src/` | the app's JavaScript modules ({{N}} files) |
| `vendor/` | pinned libraries, served locally |
| `assets/` | {{music, data, logos}} |

About {{SIZE}} MB in total.

## 4. Test checklist (5 minutes)

On a laptop in Chrome, Edge or Safari, open **{{FULL_URL}}**:

- [ ] {{Folder variant only: the address changes to end in a slash. That is expected.}}
- [ ] The intro card appears; within about {{N}} seconds its button changes from "{{LOADING LABEL}}" to **{{ENTER LABEL}}**.
- [ ] {{Navigation check using the real button names}}.
- [ ] {{One exhibit check: open "<pin name>", do "<action>", see "<result>"}}.
- [ ] **{{TOUR BUTTON}}** plays the guided tour with music and subtitles, then returns to the map.
- [ ] Browser developer tools (F12): no red errors in the Console, no 404s in Network.
- [ ] Repeat quickly on a phone or tablet.

Optional smoothness check: add `?perf=1` to the address; the guided tour should hold about 60 fps on a recent laptop.

## 5. Browser support

WebGL 2 and JavaScript import maps: Chrome or Edge 89+, Safari 16.4+ (macOS, iPhone, iPad), Firefox 108+. Older browsers show the intro card, but the app will not start.

## 6. Address options (testing only)

| Add to the address | Effect |
|---|---|
| `?q=low` / `?q=high` | lighter / full quality |
| `?perf=1` | frame-rate panel |
| `?pr=1.25` | fixed render sharpness |

## 7. Updating later

Delete the old `index.html`, `src/`, `vendor/` and `assets/`, extract the new zip the same way, keep `.htaccess`, and purge the host's CDN or LiteSpeed cache if it is on. Pages and scripts re-check on every visit, so visitors see the update at once.

## 8. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Stuck on the loading label | `.js` not served as JavaScript. Confirm `.htaccess`; in the Network tab a `.js` file's `Content-Type` must be `text/javascript` or `application/javascript`. |
| The main site's 404 page shows (folder variant) | The main site's rewrite rules catch the path. Confirm the folder and `index.html`; if correct, add near the top of the root `.htaccess`, before the site's rules: `RewriteRule ^{{FOLDER_PATH}}(/.*)?$ - [L]` |
| The host's default page shows (subdomain variant) | A default `index.php` or `default.php` is still in the folder. |
| Folder listing or blank page | Files were extracted into a subfolder; move them up one level. |
| 404s for `src/…` | Folder structure changed during upload; re-extract the zip as is. |
| 403 Forbidden | Permissions: folders 755, files 644. |
| Plain fonts | The font service is blocked by a firewall or Content-Security-Policy; allow it. The app still works. |
| Old version showing | Purge the CDN or LiteSpeed cache, then hard-reload. |
| No music | Sound only starts after a click; check the device is not muted. |

## 9. Optional: keep it private

hPanel, Advanced, Password Protect Directories on the app's folder. Send the client the username and password separately.
