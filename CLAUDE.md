# Calm Shade × APPA Art Fest 2027 — Claude Code handover

Owner: Karthik (karthik@xtrathin.in · WhatsApp +91 9619176007). Live site: **https://calmshade.in**.
Last updated 14 Oct 2026. `HANDOVER.md` has the full history (sections 1–5 original launch, 6–10 the October work);
this file is the current state and the rules. Read both before changing anything.

## 1. What this is
- **Calm Shade** (`index.html`): an invite-only homestay collective with a WhatsApp-style AI concierge, host dashboard,
  creator console, the Grove (invite/trust system), curated multi-stay trips.
- **APPA Art Fest 2027** (12 Feb – 19 Mar 2027 = 36 days in four 9-day chapters, **no Encore**, Kamshet — set by Karthik 20 Oct 2026; concept 3-6-9: every 3rd, 6th and 9th day of a chapter is a big night): sold through Calm Shade as a VIP tier.
  Six venues (Secret Farm cancelled 13 Oct 2026). Agreed launch spec: Claude project doc `claude/launch-spec-oct-2026.md`. Public timetable: `appa/timetable/`.
  Festival booking, day passes, the Art Passport and partner-host listings all live inside `index.html`.
- **The 3D festival app** (`appa/2027/`): isometric Three.js map + guided tour; its 🎟 Tickets panel links into booking.
- **`fest.php`**: the only backend. PHP + PDO; SQLite by default, MySQL if configured. All money/availability rules
  are enforced here, never trusted from the browser.

## 2. Deploy — pushing IS deploying
- GitHub `JointRobot/calmshade`, branch **`claude/handover-section-3a-7beiez`** → Hostinger Git auto-deploy into
  `public_html` within ~1 minute. `main` is stale; don't deploy from it.
- Commit as `Karthikeyan Ramachandran <karthik@xtrathin.in>`. Never commit secrets.
- After pushing, verify on the live site (e.g. `https://calmshade.in/fest.php?a=state` returns `"ok":true`).

## 3. Files
| Path | What |
|---|---|
| `index.html` | Whole site, one file (~3 MB, media base64-embedded). One `<style>`, one main `<script>` IIFE. Navigate by banners: `ACCESS`, `THE GROVE`, `AI CONCIERGE`, `CURATED TRIP`, `VIEWS`, `APPA ART FEST 2027`, `CURATE YOUR STAY`, `APPA ART PASSPORT`, `CALM SHADE BOOKINGS`, `PARTNER HOSTS`, `RENDER`, `PUBLIC API`. |
| `fest.php` | Backend: routes by `?a=`. Festival: `state book quote mine find utr cancel list admin status approve settings`. Timetable/logos/sponsors: `schedule_set logos_set sponsors_set` (desk key). Homestays: `cs_state cs_book cs_mine cs_utr cs_cancel cs_admin cs_status cs_props`. Passport: `passport stamp stamp_links schedule_set`. Hosts: `upload host_me host_save host_status host_link_request`. Concierge: `ai`. |
| `fest-config.php` | **Server only, gitignored.** Holds `FEST_ADMIN_KEY` (desk key) and optionally `FEST_DB_*`, `ANTHROPIC_KEY`, `AI_MODEL`, `AI_DAILY_CAP`, `FEST_MAIL_FROM`. |
| `fest-data/` | **Server only, gitignored.** SQLite DB (`fest.sqlite`), auto-created, web access denied by auto-written `.htaccess`. This is the live booking data — back it up, never delete. |
| `uploads/` | **Server only, gitignored.** Host photos. Auto `.htaccess` blocks script execution. |
| `appa/2027/` | Festival app (guided tour plays in 90 s: authored on a 105 s timeline, mapped by `tsc()`/`untsc()` in `story.js`; each venue arrives wide, pushes in to a signboard, pulls back). Edit only `project/` (`site.js` layout, `tour.js` tour camera, `copy.js` all words incl. ticket prices, `story.js`, `cast.js`, `look.js`). See `appa/2027/README.md`. |
| `appa/timetable/` | Public timetable (36 days × 6 venues, big nights, runs-all-festival, logo panel, sponsor line). Reads `fest.php?a=state` (`schedule`, `logos`). Phone = day cards, desktop = grid. |
| `tests/` | Test suites + `run.sh` (see §7). |
| `api.php` | Not on this branch (only on stale `main`, and unsafe there). The concierge goes through `fest.php?a=ai`. |

## 4. Current live state (1 Oct 2026)
- **Storage: SQLite** (`fest-data/`). MySQL DB `u624308062_appa` / user `u624308062_appa` exists in hPanel but is **not
  used**: the three `FEST_DB_*` lines in `fest-config.php` are commented out. An attempt to switch failed because the
  password was pasted into the wrong place; that password was exposed in a chat, so **set a fresh one** if MySQL is
  ever enabled. Switching later: uncomment the three lines with a working password, then copy any existing SQLite rows
  across (no migration script exists yet — write one, and test it on a copy first).
- **Desk key** (`FEST_ADMIN_KEY`) is still the example phrase from the setup instructions. Ask Karthik to change it to
  something private (it unlocks bookings, approvals, prices and host links).
- **Concierge: off** (no `ANTHROPIC_KEY`); chat falls back to sample replies. Booking does not depend on it.
- No real bookings yet (only a tiny test image in `uploads/202610/`).
- Emails use PHP `mail()`; delivery not verified (may land in spam).

## 5. Business rules (all editable in Creator console → APPA Fest desk → Festival prices; defaults in `fest.php` `DEF`)
- VIP rooms inside the festival: Calmshet 5, Le Farm 8, Shambhala by the Lake 6, Theeya 4, The Company Theatre 8,
  Purrom 4 singles. **Pricing (14 Oct 2026, Karthik's rule): guest pays the venue's own real rate + a festival ticket
  (`dayPass`, ₹2,000) per guest per night; the venue is paid exactly its real rate** (surge + tickets are the
  festival's). Per-venue settings `rate_/rateWe_/extra_/extraWe_<id>` (weeknight vs Fri/Sat night, extra adult), all
  editable in the desk. Sources: Shambhala = its published tariff +5% GST (6,510 / 7,560; extra 1,995 / 2,520);
  Calmshet = ₹4,000/head incl. 3 meals (Karthik, 14 Oct) → room for two 8,000, extra adult 4,000. Le Farm = room
  rate derived from its 2019 villa rate (6,700 / 9,800) — **confirm**; extra adult 2,360 = lefarm.in tariff ₹2,000 + 18% GST
  (lefarm.in shows no base rate: "call to enquire", StayVista +91 9137023866; meals extra). Theeya = ₹4,000/head (Karthik, 14 Oct; extra adult 4,000).
  Chapters (PP_WEEKS / copy.js / tour.js / appa/timetable): 1 Roots & Raga 12–20 Feb, 2 Keeping it Real 21 Feb–1 Mar,
  3 Tech, Electronica & AI 2–10 Mar, 4 All Forms, Together 11–19 Mar. Last night 19 Mar; day passes every festival day.
  The Company Theatre (thecompanytheatre.net: no stay info) (8,000) and Purrom (purrom.com: 5 stays, 3 veg meals
  included, prices by WhatsApp +91 98200 24049 only) (4,000) — stand-ins reproducing the old ₹12,000 / ₹6,000. `coupleNight/singleNight/partnerShare*` are no longer used.
  VIP Tent Village 20 tents at ₹9,000 (placeholder, unconfirmed). Extra adult ₹2,000/night. Kids under 10 free.
- Surge: up to +20% as a place fills. VIP = 6+ nights inside, 6% off the booking (`vipPct`). VVIP = 9+ nights (a chapter), 9% off
  (`vvipPct`) + priority seating on the 12 big nights, one artist studio visit per chapter, one free adventure slot. Partner stays = host rate + festival ticket (`partnerMarkup`, now ₹2,000) per guest-night, no commission. Day pass ₹2,000/person/day.
- Timetable (desk → Timetable): items `{date, to?, time, spot, title, access, kind}`; kind = show/exhibit/fest/workshop/dhol/adventure;
  items running all 36 days show in "Running all 36 days". Until the desk saves, `default_schedule()` (KNR exhibit at every venue,
  Dashavatar, Pyoba Awards, Antique & Kitsch, Maval Comics, Animela, Wench Film Festival, theatre festival, dhol pathak on the
  12 big nights + Shivaji Jayanti) is shown. Logos (desk → Logos): groups curator/venue/partner/sponsor; sponsors show beside the
  APPA logo. Sponsor tracker (desk → Sponsors) is private: only in the `admin` payload, never in `state`.
- Adventures (`ADV` in fest.php, cart line kind `adv`): kayaking ₹350 (18 × 20-min slots 7–10 am, 3:30–6:30 pm, `advCap_kayak` 6 =
  placeholder), tandem paragliding ₹3,500 (one 'wind' slot a day, cap 200), night jeep ride ₹1,000 (20:30/21:45/23:00/00:15, cap 5).
  Guest pays `advDeposit` ₹50 per person now, balance at the venue; deposits are not discounted; unpaid holds expire like rooms.
  Treks and crystal hunting are listed as "details soon". VVIP's free adventure slot is honoured by hand (not automatic).
- Holds: unpaid room bookings hold 48 h then release; day-pass-only orders never expire. Max 3 unpaid room holds per
  phone, 10 bookings per device per day. Payment = UPI to xtrathindesign@okicici (Karthikeyan Ramachandran), then the
  guest submits the UPI reference; staff confirm in the desk. UPI QR omits the amount above ₹1 lakh (pay in parts).
- Calm Shade homestays: per head per night with/without meals, whole place; partner hosts keep their full price, guests pay a 3% Calm Shade fee on top (25 Oct 2026).
  Built-in property defaults still exist in TWO places (`CS_PROPS` in `fest.php`, `PROPS` in `index.html`), but editing
  a built-in listing in the dashboard (Save, or Pause/Relist) now persists name/location/category/price/pet/villa/
  amenities/description/bookable to a `cs_builtin` DB table (`cs_builtin_state`/`cs_builtin_save` routes, admin-key
  gated) and both sides read the override — so day-to-day price changes no longer need hand-editing two files.
  Sleeps/capacity has no editor field yet and still only lives in `CS_PROPS`. Needs the desk key entered in the
  dashboard (same key as the APPA Fest desk) for built-in edits to reach the server; without it, edits stay local-only
  exactly as before (graceful fallback, not an error).
- **One calendar per place**: an enrolled partner (`L-<id>`) booked whole-place on Calm Shade fills its festival rooms,
  and any festival room booked blocks that Calm Shade night.
- Partner hosts: apply via festival page → List your stay; desk → **Approve & enroll** creates the host + listing and
  a private link `?host=<key>` (only the SHA-256 is stored). Hosts edit listing/photos, pause, confirm their own
  bookings (multi-host trips are confirmed by staff).
- Festival app ticket prices in `appa/2027/project/copy.js` are plain text: update by hand when desk prices change.

## 6. Rules of engagement
- Karthik is non-technical and often on his phone. Keep instructions to one step at a time, plain words, no jargon.
- Visual language: the APPA look (paper/ink/vermilion/gold, Fraunces + Mukta). The site was deliberately reskinned
  from the original "v7" design; don't revert it.
- Keep `esc()` on every user string; full re-render on state change with delegated handlers; `node --check` the main
  script after edits (extract the `<script>` containing `window.CS=`); `php -l fest.php`.
- Don't hand-type or paste passwords/API keys into hPanel or files for him; prepare everything else and let him enter
  secrets himself. Never print secrets in chat or commits.
- WhatsApp number 918799938193 stays everywhere; UPI payee and venue spellings as above (Le Farm, Calmshet, Purrom,
  Theeya, Shambhala by the Lake, The Company Theatre; town is Kamshet).
- Test every change (§7) before pushing; then verify live.

## 7. Testing
`bash tests/run.sh` (needs PHP 8 with pdo_sqlite, Python 3, Playwright with Chromium, Pillow). It starts a local PHP
server on 127.0.0.1:8099 with a throwaway SQLite DB and a test desk key, runs 10 suites (~230 checks: festival API incl.
a concurrent last-room race, homestays API, festival UI, homestay UI, day passes, passport, curate planner, partner
hosts end to end), then cleans up. Expected: all PASS except 4 concierge checks in `api_homestays` without an API key.
Don't run it with a real `fest-config.php` in the working tree (the script refuses).
3D tour stills: `appa/2027/tools/render.mjs` (macOS Chrome path hard-coded; point it at a local Chromium and use
`--use-angle=swiftshader` on Linux).

## 8. Open items / ideas
1. Change the desk key (Karthik). Optionally add `ANTHROPIC_KEY` to turn on the concierge.
2. MySQL switch + SQLite→MySQL migration script (only if needed; SQLite is fine at festival scale).
3. ~~Built-in Calm Shade listing edits in the dashboard are still in-memory only.~~ Done 1 Oct 2026: edits to an
   existing built-in listing (name/price/location/category/pet/villa/amenities/description/bookable) now persist to
   the server via `cs_builtin` (needs the desk key entered in the dashboard). Still open: sleeps/capacity has no
   editor field (only in `CS_PROPS`), and adding a *new* built-in listing from the dashboard is still local-only
   (only edits to the original p1–p9 persist) — Mira/Ravi/Anya are demo/narrative hosts for the Grove feature, not
   real listings, so this was scoped to Karthik's own stays.
4. Login OTP for built-in hosts is still the preview (code shown on screen).
5. Payment is manual UPI confirmation; a payment gateway would automate it.
7. Audit 5 Oct 2026 (guest walkthrough) fixed: curate plan editing (add venue, ±night, reorder, remove), homestay
   month paging (`BM` is now `let`, `bmGo()`, `CSB.occ` + `csFill()`), offline UPI ref no longer faked, pass cap
   30/day, Encore day passes hidden in Passport, tour buttons. Still open: VIP/VVIP is counted per booking, not
   across a guest's bookings (two separate 7-night bookings each get −₹7,000; 7 booked + 3 more later gets no VIP)
   — needs Karthik's call before changing `quote()`. Curate plan isn't kept across a page refresh.
   (Fixed 14 Oct: concierge status now honest — `cs_state` returns `ai`; shows "usually replies within the hour" when off.)
8. Audit 14 Oct 2026: six Calmshet/Appa listings corrected from Airbnb (names, Kamshet, beds/baths, capacity, ratings,
   `revs`); demo Grove stays p7–p9 hidden + unbookable; stock logos removed. Calmshet p1–p4 now ₹4,000/head with meals
   (ppWith=ppWithout ⇒ `mealsIn()` hides breakfast-only). Appa p5/p6 also ₹4,000/head with meals. STILL NEEDED FROM KARTHIK: sleeps for
   Lakeview Cottage + Room 2, whether Lakeview Cottage is still listed on Airbnb (its page errors), guest pet policy,
   real photos per room (every card uses the same night shot), and real venue rates for CTheatre/Purrom/Le Farm.
6. Confirm VIP tent count/price with Karthik; add show times via desk → Timetable; print venue stamp posters
   (desk → Passport stamps → Show posters).

## 9. Places & rooms — BUILT 25 Oct 2026 (invites still to do)
- `PLACES` in fest.php is the one catalogue: each place has room types (count, max adults, price for 2 weeknight / Fri-Sat,
  extra adult). Rates marked from settings read `rate_<place>` etc.; the desk → **Places & rooms** panel overrides any room
  (kv `places`), plus owner UPI/payee, words, photos, hide. `units()` = one festival-board row per room type (`calmshet.cottage`,
  `lefarm.bedroom`, `shambhala.dorm`, `purrom.chickoo` …) + `tents` + partners `L-<id>`. `index.html` keeps a fallback copy
  `FX_UNITS0` (api_festival checks it matches; regenerate from `?a=state` units if the catalogue changes).
- Calmshet rooms: cottage 2–4, room1 2, room2 2, triangle 2–6, appacottage up to 3 (all ₹8,000 for 2 + ₹4,000 extra adult,
  min 2 paid). Appa Art House (p6) is off the board and closed on calmshade.in for the whole festival (artist).
  p1–p5 = the same rooms (field `cs`): one calendar. Old bookings whose unit is a whole venue (`calmshet`) are spread over its rooms.
- Festival night = owner price + high-demand add (place-level fill) + ₹2,000 ticket per guest (tents include it) + 3% fee
  for places that aren't Karthik's (`FEE_PCT`). VIP discount comes out of Calm Shade's part only.
- **Festival-only rule**: on calmshade.in, festival nights (firstNight–lastNight) of festival rooms can't be booked; calendar
  state `fx` (and `ar` for Appa Art House). Venue places show as listings `v-<place>` with a room picker (per room + 3%).
- **Two-step payment**: `pay` column = `{calm, hosts:[{place,name,upi,payee,amount,paid,utr}]}`. Step 1 to Karthik's UPI
  (fees, tickets, extras, deposits, own places, owners without UPI); desk "Step 1 received" → status `part`; guest pays
  each owner directly and sends `utr` with `place`; desk "mark received" (`host_paid`) → `confirmed`. `part` holds rooms.
- Extras (kv `extras`, desk editor) are bookable with any festival booking; tent spot preference (Le Farm/Theeya/The Company Theatre).
- Still to build: server-stored invite links (any approved host, 3 per place per year) + one join form with rooms;
  replace browser-only Grove codes. Homepage and emails now say hosts keep their full price, guests pay 3% on top; per-head partner listings (L-) also charge 3% on top (25 Oct).
