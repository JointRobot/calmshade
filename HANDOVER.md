# CALM SHADE — Handover to Claude Code
**Goal:** take `index.html` live via GitHub → Hostinger, owned by Karthik (karthik@xtrathin.in · +91 9619176007).

---

## 1. What this project is

**Calm Shade** is an invite-only homestay collective ("where even crows, look like birds") for calm, taste-curated stays. Guests browse, chat, and book through one always-awake WhatsApp concierge (**wa.me/918799938193**); hosts keep 97% (platform takes 3% on confirmed bookings only). It began as 6 real Airbnb listings owned by Karthik (calmshet.com — links inside the file) and is built to grow globally through host-to-host invitations.

**The entire product is ONE self-contained file:** `index.html` (~2.9 MB — media is base64-embedded; no build step, no dependencies, no framework). It is deploy-ready as-is.

### What works fully client-side (real, keep working)
- Guest site: hero slideshow, editorial grid, filters/search, property pages with gallery + lightbox + walkthrough video
- **Live weather** (Open-Meteo, no key, browser-side fetch) on property pages + all calendars
- Guest date-picker (multi-select on property page; range picker in Curated) with availability + weather
- **Curated trips**: availability-aware map, constraint-solving night allocator, editable itinerary, per-host booking legs with real calendar holds
- Host dashboard: listings CRUD, photo/cover/video/logo/FAQ editors, Moments reel manager, booking approvals with payout math, calendars
- **The Grove**: invite-only entry (3 invites/property/year), WhatsApp/email invite sharing, deep-link join (`?invite=CODE`), trust points, referral decay, disown, vouch/probation
- Creator console (super admin): grove tree + review simulator, commission ledger, booking log
- Full motion system (loader, cursor, tilt, living separators, view transitions) — vanilla, reduced-motion safe

### What is SIMULATED (needs backend later — do NOT block launch on these)
| Simulated | Current behavior | Production path (Phase 2) |
|---|---|---|
| AI concierge & AI curation | `fetch` to `api.anthropic.com` **without a key** — works only in Claude.ai preview; **in production these calls fail and the app gracefully falls back to canned replies** | See §5 — small server proxy with `ANTHROPIC_API_KEY` |
| Data persistence | All state in memory; resets on refresh | Database (Supabase/Postgres) |
| Login OTP | Code shown on screen (labelled as preview) | SMS/email gateway (MSG91/Twilio) |
| WhatsApp messages to guests/hosts | In-page simulator | WhatsApp Business API on +91 8799938193 |
| Payments | UPI QR mock + screenshot upload | UPI verification / PG |
| Uploads (photos/videos/logos) | Object URLs, session-only | Object storage (S3/R2) |

**Access control (hardcoded, keep):** super admin = `karthik@xtrathin.in` / `9619176007`. Demo hosts: mira@/ravi@/anya@calmshade.demo. Demo invite: `CS-DEMO-2026`.

---

## 2. Codebase map (single `<script>` IIFE — navigate by these searchable banners)
```
ACCESS / DATA           → OWNERS, INVITES, PROPS, CAL, BOOKINGS, MOMENTS, GLOBAL_FAQ
THE GROVE               → trust engine: inviteSlots, activeRefBad, pointsOf, statusOf, codeLookup, inviteText
SEASONS & WEATHER       → seasonSep(), ensureWx() [Open-Meteo], wxIcon()
AI CONCIERGE            → kb(), sysPrompt(), askAI(), handleReply() [BOOKING] tag protocol
LOGIN                   → tryId/tryOtp + invite step (redeem)
CURATED TRIP            → tcalHTML, availOf, allocate() (composition solver), curateAI, mapSVG
VIEWS                   → nav/home/detail/loginView/hostDash/creatorDash/waChat + editors
MOTION ENGINE           → loader, cursor/tilt/magnetics, splitWords, initMotion, vtRender
RENDER / PUBLIC API     → render(); window.CS = { …all handlers }; deepLink()
```
Conventions: full DOM re-render on every state change (all listeners are delegated/document-level — preserve this); state lives in module-scope `let`s; every user-facing string is `esc()`-escaped; CSS is one `<style>` block using `--tokens`, zero-specificity reset `:where(#cs-app…)` (don't "fix" it back). `node --check` passes; keep it that way after every edit.

---

## 3. Your tasks, Claude Code (in order)

### A. GitHub
1. Ask Karthik for: repo name (suggest `calm-shade`), public/private, and confirm the GitHub account (`gh auth login` if needed).
2. Init repo with: `index.html`, this `HANDOVER.md`, a short `README.md` (one-paragraph pitch + "single-file app, deploy = copy index.html"), and `.gitignore` containing `secrets.php`, `.env`, `*.key`.
3. Commit as `v1.0 — launch build (handover from Claude chat)` and push `main`.

### B. Hostinger deploy (choose per Karthik's plan)
Ask Karthik to provide (from **hPanel**): the target domain/subdomain, and either **FTP credentials** (hPanel → Files → FTP Accounts) or **SSH access** (Advanced → SSH, premium plans).
- **Preferred — Git auto-deploy:** hPanel → Advanced → **GIT** → add the GitHub repo (deploy key it gives you goes into GitHub repo → Settings → Deploy keys) → target directory `public_html/` (or `public_html/calmshade/`). Every push then deploys.
- **Fallback — direct upload:** `lftp`/`curl -T` the file via FTP, or hPanel File Manager. The file MUST be named `index.html` at the web root of the chosen (sub)domain.
- Force HTTPS (hPanel → Security → SSL, enable + redirect).

### C. Domain wiring
Karthik's main site (calmshet.com) is on **Wix**. Recommend: point a **subdomain** `shade.calmshet.com` (or `stay.calmshet.com`) at Hostinger — in Wix's domain DNS panel add an A record to the Hostinger server IP (hPanel shows it) or CNAME per Hostinger's docs — then link/embed it from Wix. If he prefers `calmshet.com/calmshade` on Wix itself, that's an iframe embed of the Hostinger URL instead. Confirm his choice before touching DNS; DNS may take up to ~1h.

### D. The ONE code change that matters for launch — AI proxy (§5)
Without it the site still works (fallback replies), but the live concierge is the soul. Hostinger shared hosting runs **PHP**, so ship a tiny proxy:

1. Create `api.php` next to index.html:
```php
<?php // api.php — Anthropic proxy. Key lives in secrets.php (NOT in git).
header('Content-Type: application/json');
require __DIR__.'/secrets.php';          // defines ANTHROPIC_KEY
$body = file_get_contents('php://input');
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,
 CURLOPT_POSTFIELDS=>$body,CURLOPT_HTTPHEADER=>[
  'Content-Type: application/json','anthropic-version: 2023-06-01',
  'x-api-key: '.ANTHROPIC_KEY]]);
echo curl_exec($ch);
```
2. `secrets.php` (upload manually via FTP, **never commit**): `<?php define('ANTHROPIC_KEY','sk-ant-…');`
3. In `index.html`, replace **all three** occurrences of `https://api.anthropic.com/v1/messages` with `api.php` (they're in `askAI` and twice in `curateAI`). Keep the request bodies unchanged — the proxy passes them through. Add basic rate limiting later if abused.
4. Ask Karthik for an Anthropic API key (console.anthropic.com); if he doesn't have one yet, ship without the proxy — fallbacks keep the site coherent.

### E. Launch checklist (test on the LIVE URL, desktop + phone)
- [ ] Loads over HTTPS, loader plays, hero slideshow cycles
- [ ] Weather cards populate (proves outbound fetch works in prod)
- [ ] Property → pick nights → WhatsApp chat opens pre-briefed → phone capture → payment → screenshot → pending booking
- [ ] Host login (karthik@…, on-screen OTP) → approve booking → calendar flips, guest chat confirms
- [ ] Curated: dates → map availability states → route → curate → edit → finalise → legs in host queues with date holds
- [ ] Grove: generate invite → "Send on WhatsApp" opens composer → open `?invite=CODE` link in incognito → pre-validated join → lands in first-listing editor
- [ ] If proxy shipped: concierge gives real AI answers (ask Lakeview "can we swim in the lake?" — must quote the host's FAQ)
- [ ] `?invite=CS-DEMO-2026` deep link works; reduced-motion (OS setting) disables effects; Lighthouse mobile ≥ 85 perf

### F. Nice-to-haves after launch (small, optional)
Favicon + OG image (grab the rainbow mark / hero photo from the embedded media), `robots.txt`, gzip/brotli via `.htaccess`, and a `cache-control` header for the single file (short — it's the whole app).

---

## 4. Rules of engagement
- **Do not redesign.** Visual language is locked (owner-approved at "v7"). Additive changes only.
- **Never commit secrets.** `secrets.php` stays out of git forever.
- Preserve: the WhatsApp number 918799938193 everywhere; the 3%/97% economics copy; invite-only entry; the `[BOOKING]{json}` tag protocol between AI and UI; `esc()` on all user content.
- Known accepted quirks (don't "fix" without asking): approving a booking releases all tentative holds on that property; severed referrals still consume an invite slot; all data is session-only until the backend exists.
- Anything ambiguous → ask Karthik on WhatsApp (+91 9619176007) before acting.

## 5. Phase-2 backlog (for a future session — not launch)
Supabase (auth+db+storage) or Node/Postgres · WhatsApp Business API on 8799938193 (360dialog/Gullak/Twilio) wired to the same concierge prompts in `sysPrompt()`/`kb()` · real OTP · UPI verification · Airbnb import tool (listing URLs are in each property's `link` field) · real geo-pins for the Curated map (properties already carry `geo:[lat,lng]`) · review collection via post-checkout WhatsApp message feeding the Grove's `rev` objects.

*Prepared July 2026 from the Claude chat build. The chat transcript is the design authority; this file is the operational authority.*
