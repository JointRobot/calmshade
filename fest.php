<?php
/* fest.php — APPA Art Fest 2027 booking store for calmshade.in
   Live inventory, server-side pricing, guest bookings, host applications, festival desk.
   Storage: MySQL when fest-config.php defines FEST_DB_DSN (recommended on Hostinger),
   otherwise a local SQLite file in fest-data/ (works out of the box, protected by .htaccess).
   fest-config.php is NOT in git — upload it once through hPanel File Manager:
     <?php
     define('FEST_DB_DSN','mysql:host=localhost;dbname=YOUR_DB;charset=utf8mb4');
     define('FEST_DB_USER','YOUR_DB_USER');
     define('FEST_DB_PASS','YOUR_DB_PASSWORD');
     define('FEST_ADMIN_KEY','a long random phrase only you know');
*/
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (is_file(__DIR__.'/fest-config.php')) require __DIR__.'/fest-config.php';

function out($d, $code = 200) { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function fail($msg, $code = 400) { out(['error' => $msg], $code); }

/* ---------- storage ---------- */
function db() {
  static $pdo = null; if ($pdo) return $pdo;
  try {
    if (defined('FEST_DB_DSN')) {
      $pdo = new PDO(FEST_DB_DSN, defined('FEST_DB_USER') ? FEST_DB_USER : null, defined('FEST_DB_PASS') ? FEST_DB_PASS : null);
    } else {
      $dir = __DIR__.'/fest-data';
      if (!is_dir($dir)) @mkdir($dir, 0750, true);
      if (!is_file($dir.'/.htaccess')) @file_put_contents($dir.'/.htaccess', "Require all denied\nDeny from all\n");
      if (!is_file($dir.'/index.html')) @file_put_contents($dir.'/index.html', '');
      $pdo = new PDO('sqlite:'.$dir.'/fest.sqlite');
      $pdo->exec('PRAGMA busy_timeout=8000');
    }
  } catch (Throwable $e) {
    $code = (int)($e->errorInfo[1] ?? 0); $msg = $e->getMessage();
    $hint = $code === 1045 || stripos($msg, 'Access denied') !== false ? 'database login failed: check FEST_DB_USER and FEST_DB_PASS'
          : ($code === 1049 || stripos($msg, 'Unknown database') !== false ? 'database name not found: check dbname in FEST_DB_DSN'
          : ($code === 2002 || stripos($msg, 'connect') !== false ? 'database server not reachable: use host=localhost' : 'database error'));
    error_log('fest.php db: '.$msg);
    /* Safe checks on fest-config.php (never reveals values): duplicate lines, stray spaces, odd quotes */
    $diag = [];
    $cfg = @file_get_contents(__DIR__.'/fest-config.php');
    if ($cfg !== false) {
      foreach (['FEST_DB_USER','FEST_DB_PASS','FEST_DB_DSN'] as $k) {
        $n = preg_match_all('/^\s*define\(\s*[\'"]'.$k.'[\'"]/m', $cfg);
        if ($n > 1) $diag[] = $k.' is defined '.$n.' times (only the first counts): delete the extra lines';
      }
      if (preg_match('/[\x{2018}\x{2019}\x{201C}\x{201D}]/u', $cfg)) $diag[] = 'the file contains curly quotes; retype them as straight quotes';
      if (defined('FEST_DB_PASS') && FEST_DB_PASS !== trim(FEST_DB_PASS)) $diag[] = 'the password has a space at the start or end';
      if (defined('FEST_DB_USER') && FEST_DB_USER !== trim(FEST_DB_USER)) $diag[] = 'the username has a space at the start or end';
      if (defined('FEST_DB_PASS') && FEST_DB_PASS === '') $diag[] = 'the password is empty';
      if (defined('FEST_DB_PASS') && stripos(FEST_DB_PASS, 'YOUR') !== false) $diag[] = 'the password is still the placeholder text';
      if (defined('FEST_DB_USER') && stripos(FEST_DB_USER, 'YOUR') !== false) $diag[] = 'the username is still the placeholder text';
    }
    $mt = @filemtime(__DIR__.'/fest-config.php');
    if ($mt) $diag[] = 'fest-config.php last saved '.gmdate('j M H:i', $mt + 19800).' IST';
    if ($diag) $hint .= '; '.implode('; ', $diag);
    elseif ($code === 1045) $hint .= '; the file looks well-formed, so the password itself differs from hPanel';
    fail('Booking store is not reachable ('.$hint.')', 503);
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  $pdo->exec('CREATE TABLE IF NOT EXISTS fest_bookings (ref VARCHAR(16) PRIMARY KEY, token VARCHAR(40) NOT NULL, status VARCHAR(12) NOT NULL, created_at BIGINT NOT NULL, tier VARCHAR(8), total BIGINT, payout BIGINT, items TEXT, guest TEXT, utr VARCHAR(60))');
  $pdo->exec('CREATE TABLE IF NOT EXISTS fest_listings (id VARCHAR(20) PRIMARY KEY, created_at BIGINT NOT NULL, status VARCHAR(12) NOT NULL, data TEXT, contact TEXT)');
  $pdo->exec('CREATE TABLE IF NOT EXISTS fest_kv (k VARCHAR(40) PRIMARY KEY, v TEXT)');
  $pdo->exec('CREATE TABLE IF NOT EXISTS fest_hits (ip VARCHAR(64) NOT NULL, act VARCHAR(12) NOT NULL, at BIGINT NOT NULL)');
  $pdo->exec('CREATE TABLE IF NOT EXISTS cs_bookings (ref VARCHAR(16) PRIMARY KEY, token VARCHAR(40) NOT NULL, status VARCHAR(12) NOT NULL, created_at BIGINT NOT NULL, total BIGINT, payout BIGINT, items TEXT, guest TEXT, utr VARCHAR(200))');
  /* two-step payments (25 Oct 2026): who is paid what, and the owners' payment references */
  foreach (['fest_bookings','cs_bookings'] as $t) {
    try { $pdo->query("SELECT pay FROM $t LIMIT 1"); } catch (Throwable $e) { $pdo->exec("ALTER TABLE $t ADD COLUMN pay TEXT"); }
  }
  return $pdo;
}
function is_mysql() { return defined('FEST_DB_DSN') && stripos(FEST_DB_DSN, 'mysql') === 0; }

/* ---------- settings & inventory ---------- */
const DEF = ['coupleNight'=>12000,'singleNight'=>6000,'extraGuest'=>2000,'partnerShareCouple'=>8000,'partnerShareSingle'=>4000,
  'tentNight'=>9000,'tents'=>20,'dayPass'=>2000,'partnerMarkup'=>2000,'surgeMax'=>20,'vipNights'=>6,'vipPct'=>6,
  /* 3-6-9 (Karthik, 20 Oct 2026): festival 12 Feb – 19 Mar 2027 = 36 days in four 9-day chapters, no Encore.
     VIP = 6+ nights inside, 6% off; VVIP = 9+ nights (a full chapter), 9% off the whole booking. */
  'vvipNights'=>9,'vvipPct'=>9,'holdHours'=>48,'firstNight'=>'2027-02-12','lastNight'=>'2027-03-19',
  'passLast'=>'2027-03-19','upi'=>'xtrathindesign@okicici','payee'=>'Karthikeyan Ramachandran',
  'contact'=>'karthik@xtrathin.in',
  /* Adventure add-ons (Karthik, 20 Oct 2026): book a slot with a small deposit per person now, pay the balance at the venue.
     Prices per person; capacities per slot (kayak count per 20-minute slot is a placeholder until confirmed). */
  'advDeposit'=>50,'adv_kayak'=>350,'advCap_kayak'=>6,'adv_paraglide'=>3500,'advCap_paraglide'=>200,'adv_jeep'=>1000,'advCap_jeep'=>5,
  /* Venue real rates (what the venue itself charges, per room per night incl. its taxes) — guests pay this
     PLUS a festival ticket (dayPass) per guest per night; the venue is paid exactly this. Researched 14 Oct 2026:
     Shambhala = published tariff (₹6,200 wk / ₹7,200 wkend for 2, extra adult ₹1,900 / ₹2,400) + 5% GST.
     Le Farm = room rate from its 2019 villa rate (₹40k wk / ₹59k wkend, 12 adults) — CONFIRM (lefarm.in says 'call to enquire');
       extra adult from lefarm.in tariff today: ₹2,000 + 18% GST = 2,360; meals extra there.
     Calmshet = ₹4,000 per head incl. 3 meals (Karthik, 14 Oct) → room for two 8,000, each extra adult 4,000.
     Theeya = ₹4,000/head (Karthik, 14 Oct) → room for two 8,000, extra adult 4,000.
     The Company Theatre, Purrom: no public price on their sites — stand-ins equal to the old venue share. */
  'rate_calmshet'=>8000,'rateWe_calmshet'=>8000,'extra_calmshet'=>4000,'extraWe_calmshet'=>4000,
  'rate_lefarm'=>6700,'rateWe_lefarm'=>9800,'extra_lefarm'=>2360,'extraWe_lefarm'=>2360,
  'rate_shambhala'=>6510,'rateWe_shambhala'=>7560,'extra_shambhala'=>1995,'extraWe_shambhala'=>2520,
  'rate_theeya'=>8000,'rateWe_theeya'=>8000,'extra_theeya'=>4000,'extraWe_theeya'=>4000,
  'rate_ctheatre'=>8000,'rateWe_ctheatre'=>8000,'extra_ctheatre'=>0,'extraWe_ctheatre'=>0,
  'rate_purrom'=>4000,'rateWe_purrom'=>4000,'extra_purrom'=>0,'extraWe_purrom'=>0];
function settings() {
  static $s = null; if ($s) return $s;
  $row = db()->query("SELECT v FROM fest_kv WHERE k='settings'")->fetch();
  $saved = $row ? (json_decode($row['v'], true) ?: []) : [];
  $s = DEF;
  foreach ($saved as $k => $v) if (array_key_exists($k, DEF)) $s[$k] = is_int(DEF[$k]) ? (int)$v : (string)$v;
  return $s;
}
/* ---------- Places & rooms (Karthik, 25 Oct 2026) ----------
   One catalogue for calmshade.in and APPA Art Fest. A place has rooms; each room type has a count, a max number of
   adults, a price for up to two (weeknight / Fri-Sat night) and a price per extra adult. Rates marked 'S' are read from
   the festival price settings (rate_<place>, rateWe_<place>, extra_<place>, extraWe_<place>), so the desk's price fields
   keep working. own = Karthik's own place: one payment, no 3% fee. fest = false keeps a room off the festival board;
   festBlock = closed for the whole festival (Appa Art House: the festival artist lives there). cs = the Calm Shade listing
   that is this same room (one shared calendar). The desk can change counts, prices, owner UPI and photos (kv 'places'). */
const PLACES = [
  'calmshet' => ['name'=>'Calmshet','own'=>true,'cat'=>'lake','area'=>'Kamshet lake','web'=>'https://calmshet.com',
    'blurb'=>'K. N. Ramachandran paintings, fashion, sunset sets',
    'rooms'=>[
      'cottage'     => ['name'=>'Lakeview Cottage','count'=>1,'max'=>4,'cs'=>'p1'],
      'room1'       => ['name'=>'Room 1','count'=>1,'max'=>2,'cs'=>'p3'],
      'room2'       => ['name'=>'Room 2','count'=>1,'max'=>2,'cs'=>'p2'],
      'triangle'    => ['name'=>'Triangle','count'=>1,'max'=>6,'cs'=>'p4'],
      'appacottage' => ['name'=>'Appa Art Cottage','count'=>1,'max'=>3,'cs'=>'p5'],
      'appahouse'   => ['name'=>'Appa Art House','count'=>1,'max'=>12,'cs'=>'p6','fest'=>false,'festBlock'=>true]]],
  'lefarm' => ['name'=>'Le Farm','cat'=>'group','area'=>'Village Bhajgaon, near Kamshet','web'=>'https://lefarm.in',
    'blurb'=>'Big concerts, farm visits, sunrise yoga',
    'desc'=>'A 15-acre farm at Village Bhajgaon near Kamshet, with six air-conditioned bedrooms that open onto balconies, wide lawns and farm views. During APPA Art Fest it hosts the big concerts, farm visits and sunrise yoga.',
    'amen'=>'Air-conditioned bedrooms · Balconies · 15-acre farm · Lawns · Meals on request',
    'rooms'=>['bedroom'=>['name'=>'Bedroom','count'=>6,'max'=>3]]],
  'shambhala' => ['name'=>'Shambhala by the Lake','cat'=>'lake','area'=>'On the lake, near Kamshet','web'=>'https://shambhalabythelake.com',
    'blurb'=>'Lakeside pavilion, carpentry workshop',
    'desc'=>'A lakeside retreat near Kamshet with five private bedrooms and four dorms, sleeping up to 34. Meals are included. No pets, and no swimming in the lake. During APPA Art Fest: the lakeside pavilion and a carpentry workshop.',
    'amen'=>'Lake front · Meals included · 5 bedrooms · 4 dorms · No pets',
    'rooms'=>[
      'bedroom' => ['name'=>'Bedroom','count'=>5,'max'=>3],
      'dorm'    => ['name'=>'Dorm bed','count'=>24,'max'=>1,'rate'=>2310,'rateWe'=>2835,'extra'=>0,'extraWe'=>0]]],
  'theeya' => ['name'=>'Theeya','cat'=>'creative','area'=>'Theeya Creation Village, Kamshet','web'=>'',
    'blurb'=>'Singers, theatre, fine dining',
    'desc'=>'Theeya Creation Village near Kamshet: a place for makers and performers. During APPA Art Fest it hosts singers, theatre and fine dining. Room details are being confirmed with the hosts.',
    'amen'=>'Performances · Fine dining · Meals included',
    'rooms'=>['room'=>['name'=>'Room','count'=>4,'max'=>4]]],
  'ctheatre' => ['name'=>'The Company Theatre','cat'=>'creative','area'=>'Near Kamshet','web'=>'https://thecompanytheatre.net',
    'blurb'=>'Theatre performances and workshops',
    'desc'=>'The Company Theatre\'s space near Kamshet, home to theatre performances and workshops during APPA Art Fest. Room details are being confirmed with the hosts.',
    'amen'=>'Theatre · Workshops',
    'rooms'=>['room'=>['name'=>'Room','count'=>8,'max'=>4]]],
  'purrom' => ['name'=>'Purrom','cat'=>'cabin','area'=>'Near Kamshet','web'=>'https://purrom.com',
    'blurb'=>'Domes and glass houses by the film festival',
    'desc'=>'A farmstay of domes and glass houses near Kamshet, with three vegetarian meals a day included: two solo domes (Mango and Labernum), the Peepal glass house and the Gulmohar room with its plunge pool for couples, and the Chickoo house for a family of four.',
    'amen'=>'3 vegetarian meals included · Domes · Glass house · Plunge pool',
    'rooms'=>[
      'mango'    => ['name'=>'Mango dome (solo)','count'=>1,'max'=>1],
      'labernum' => ['name'=>'Labernum dome (solo)','count'=>1,'max'=>1],
      'peepal'   => ['name'=>'Peepal glass house','count'=>1,'max'=>2,'rate'=>8000,'rateWe'=>8000,'extra'=>0,'extraWe'=>0],
      'gulmohar' => ['name'=>'Gulmohar, plunge pool','count'=>1,'max'=>2,'rate'=>8000,'rateWe'=>8000,'extra'=>0,'extraWe'=>0],
      'chickoo'  => ['name'=>'Chickoo house','count'=>1,'max'=>4,'rate'=>8000,'rateWe'=>8000,'extra'=>4000,'extraWe'=>4000]]],
];
const TENT_SPOTS = ['lefarm'=>'Le Farm','theeya'=>'Theeya','ctheatre'=>'The Company Theatre'];
const FEE_PCT = 3;
function places_over() { static $o = null; if ($o !== null) return $o; $j = json_decode((string)kv_get('places'), true); return $o = is_array($j) ? $j : []; }
/* The live catalogue: built-in places with the desk's changes laid over them. */
function places() {
  static $out = null; if ($out !== null) return $out;
  $S = settings(); $O = places_over(); $out = [];
  foreach (PLACES as $pid => $p) {
    $o = $O[$pid] ?? [];
    $pl = ['id'=>$pid,'name'=>$p['name'],'own'=>!empty($p['own']),'cat'=>$p['cat'],'area'=>$o['area'] ?? $p['area'],'web'=>$p['web'],'blurb'=>$p['blurb'],
      'desc'=>$o['desc'] ?? ($p['desc'] ?? ''),'amen'=>$o['amen'] ?? ($p['amen'] ?? ''),'photos'=>$o['photos'] ?? [],'off'=>!empty($o['off']),
      'owner'=>$o['owner'] ?? (!empty($p['own']) ? 'Karthik' : ''),'upi'=>!empty($p['own']) ? '' : (string)($o['upi'] ?? ''),'payee'=>(string)($o['payee'] ?? ''),'rooms'=>[]];
    foreach ($p['rooms'] as $rid => $r) {
      $ro = $o['rooms'][$rid] ?? [];
      $v = fn($k, $sk) => (int)($ro[$k] ?? (array_key_exists($k, $r) ? $r[$k] : ($S[$sk.$pid] ?? 0)));
      $max = max(1, (int)($ro['max'] ?? $r['max']));
      $pl['rooms'][$rid] = ['id'=>$pid.'.'.$rid,'name'=>(string)($ro['name'] ?? $r['name']),'count'=>max(0, (int)($ro['count'] ?? $r['count'])),'max'=>$max,'base'=>min(2, $max),
        'rate'=>$v('rate','rate_'),'rateWe'=>$v('rateWe','rateWe_'),'extra'=>$v('extra','extra_'),'extraWe'=>$v('extraWe','extraWe_'),
        'fest'=>!array_key_exists('fest', $r) || $r['fest'],'festBlock'=>!empty($r['festBlock']),'cs'=>$r['cs'] ?? null];
    }
    $out[$pid] = $pl;
  }
  return $out;
}
function room_by_id($id) { if (!is_string($id) || strpos($id, '.') === false) return null; [$pid, $rid] = explode('.', $id, 2); $P = places(); return isset($P[$pid]['rooms'][$rid]) ? [$P[$pid], $P[$pid]['rooms'][$rid]] : null; }
function room_by_cs($csid) { foreach (places() as $pl) foreach ($pl['rooms'] as $r) if ($r['cs'] === $csid) return [$pl, $r]; return null; }
function in_festival($d, $S) { return $d >= $S['firstNight'] && $d <= $S['lastNight']; }
function listings_all() { return db()->query('SELECT * FROM fest_listings ORDER BY created_at')->fetchAll(); }
/* Everything sold on the festival board: one row per room type, the tent village, and approved partner stays. */
function units() {
  static $u = null; if ($u !== null) return $u;
  $S = settings(); $u = [];
  foreach (places() as $pid => $pl) {
    if ($pl['off']) continue;
    foreach ($pl['rooms'] as $rid => $r) if ($r['fest'] && $r['count'] > 0)
      $u[$r['id']] = ['name'=>$pl['name'].' · '.$r['name'],'place'=>$pid,'placeName'=>$pl['name'],'room'=>$r['name'],'rooms'=>$r['count'],'cap'=>$r['max'],'base'=>$r['base'],'kind'=>'room',
        'rate'=>$r['rate'],'rateWe'=>$r['rateWe'],'extra'=>$r['extra'],'extraWe'=>$r['extraWe'],'own'=>$pl['own'],'upiReady'=>$pl['upi'] !== '','blurb'=>$pl['blurb']];
  }
  $u['tents'] = ['name'=>'VIP Tent Village','place'=>'tents','placeName'=>'VIP Tent Village','room'=>'Tent for two','rooms'=>max(0,(int)$S['tents']),'cap'=>2,'base'=>2,'kind'=>'tent',
    'rate'=>(int)$S['tentNight'],'rateWe'=>(int)$S['tentNight'],'extra'=>(int)$S['extraGuest'],'extraWe'=>(int)$S['extraGuest'],'own'=>true,'upiReady'=>false,'blurb'=>'Tents inside the festival grounds · pick Le Farm, Theeya or The Company Theatre'];
  foreach (listings_all() as $l) {
    if ($l['status'] !== 'approved') continue;
    $d = json_decode($l['data'], true) ?: []; if (!empty($d['paused'])) continue;
    $rate = max(0,(int)($d['rate']??0)); $nm = (string)($d['name']??'Partner stay');
    $u['L-'.$l['id']] = ['name'=>$nm,'place'=>'L-'.$l['id'],'placeName'=>$nm,'room'=>'Room','rooms'=>max(1,(int)($d['rooms']??1)),'cap'=>max(1,(int)($d['maxGuests']??2)),'base'=>min(2, max(1,(int)($d['maxGuests']??2))),'kind'=>'partner',
      'rate'=>$rate,'rateWe'=>$rate,'extra'=>0,'extraWe'=>0,'own'=>false,'upiReady'=>!empty($d['upi']),'blurb'=>''];
  }
  return $u;
}
/* who gets paid for a place: [name, upi, payee, own] */
function place_payee($pid) {
  if ($pid === 'tents') return ['APPA Art Fest', '', '', true];
  $P = places(); if (isset($P[$pid])) return [$P[$pid]['name'], $P[$pid]['upi'], $P[$pid]['payee'], $P[$pid]['own']];
  if (strpos((string)$pid, 'L-') === 0) {
    $st = db()->prepare('SELECT data FROM fest_listings WHERE id=?'); $st->execute([substr($pid, 2)]); $r = $st->fetch();
    $d = $r ? (json_decode($r['data'], true) ?: []) : [];
    return [(string)($d['name'] ?? 'Partner stay'), (string)($d['upi'] ?? ''), (string)($d['payee'] ?? ''), false];
  }
  return ['Calm Shade', '', '', true];
}
/* Two-step payment: step 1 to Calm Shade (fee, tickets, extras, deposits, own places, owners with no UPI yet);
   step 2 straight to each owner's UPI for their room money. */
function pay_split($ownerBy, $total) {
  $hosts = []; $calm = $total;
  foreach ($ownerBy as $pid => $amt) {
    if ($amt <= 0) continue;
    [$name, $upi, $payee, $own] = place_payee($pid);
    if ($own || $upi === '') continue;
    $hosts[] = ['place'=>$pid,'name'=>$name,'upi'=>$upi,'payee'=>$payee,'amount'=>(int)$amt,'paid'=>false,'utr'=>''];
    $calm -= $amt;
  }
  return ['calm'=>max(0, $calm),'hosts'=>$hosts];
}
const ADV = [
  'kayak'     => ['name'=>'Kayaking','slots'=>['07:00','07:20','07:40','08:00','08:20','08:40','09:00','09:20','09:40','15:30','15:50','16:10','16:30','16:50','17:10','17:30','17:50','18:10']],
  'paraglide' => ['name'=>'Tandem paragliding','slots'=>['wind']],
  'jeep'      => ['name'=>'Night jeep ride','slots'=>['20:30','21:45','23:00','00:15']],
];
const LIVE = "('pending','part','confirmed')";
/* adventure seats taken per adventure|date|slot, by active bookings (unpaid holds release like rooms) */
function adv_occ() {
  $S = settings(); $o = [];
  foreach (db()->query("SELECT status, created_at, items FROM fest_bookings WHERE status IN ".LIVE) as $b) {
    if (!active_booking($b, $S)) continue;
    foreach (json_decode($b['items'], true) ?: [] as $it) if (($it['kind'] ?? '') === 'adv') { $k = $it['adv'].'|'.$it['date'].'|'.$it['slot']; $o[$k] = ($o[$k] ?? 0) + (int)$it['qty']; }
  }
  return $o;
}
/* a booking that holds something limited (rooms or adventure seats) expires if unpaid; day-pass-only orders don't */
function has_hold($items) { foreach ((is_array($items) ? $items : (json_decode((string)$items, true) ?: [])) as $it) if (in_array($it['kind'] ?? '', ['stay','adv'], true)) return true; return false; }
function has_stay($items) { foreach ((is_array($items) ? $items : (json_decode((string)$items, true) ?: [])) as $it) if (($it['kind'] ?? '') === 'stay') return true; return false; }
function show_status($r, $S) { return ($r['status'] === 'pending' && has_hold($r['items']) && !active_booking($r, $S)) ? 'expired' : $r['status']; }
function active_booking($b, $S) {
  if ($b['status'] === 'confirmed' || $b['status'] === 'part') return true;
  if ($b['status'] !== 'pending') return false;
  return (time() - (int)$b['created_at']) < $S['holdHours'] * 3600;
}
/* One calendar per room: festival rooms booked, Calm Shade nights of the same room (Calmshet), and whole-place partner nights. */
function occupancy() {
  $occ = fest_raw_occ(); $U = units();
  foreach (cs_raw_occ() as $pid => $nights) {
    if (strpos($pid, 'L-') === 0) { if (isset($U[$pid])) foreach ($nights as $d => $st) $occ[$pid][$d] = max($occ[$pid][$d] ?? 0, $U[$pid]['rooms']); continue; }
    $m = room_by_cs($pid); if (!$m || !isset($U[$m[1]['id']])) continue;
    foreach ($nights as $d => $st) $occ[$m[1]['id']][$d] = $U[$m[1]['id']]['rooms'];
  }
  foreach (cs_room_occ() as $rid => $nights) foreach ($nights as $d => $n) $occ[$rid][$d] = ($occ[$rid][$d] ?? 0) + $n;
  return $occ;
}
function fest_raw_occ() {
  $S = settings(); $occ = []; $legacy = [];
  foreach (db()->query("SELECT status, created_at, items FROM fest_bookings WHERE status IN ".LIVE) as $b) {
    if (!active_booking($b, $S)) continue;
    foreach (json_decode($b['items'], true) ?: [] as $it) {
      if (($it['kind'] ?? '') !== 'stay') continue;
      if (isset(PLACES[$it['unit']])) { $legacy[] = $it; continue; }
      foreach ($it['nights'] as $d) $occ[$it['unit']][$d] = ($occ[$it['unit']][$d] ?? 0) + (int)$it['rooms'];
    }
  }
  /* bookings made before rooms existed (unit = a whole venue): spread over that venue's rooms, first free first */
  if ($legacy) { $U = units();
    foreach ($legacy as $it) { $ids = array_keys(array_filter($U, fn($u)=>$u['place'] === $it['unit']));
      foreach ($it['nights'] as $d) { $need = (int)$it['rooms'];
        foreach ($ids as $id) { if ($need <= 0) break; $take = min($need, max(0, $U[$id]['rooms'] - ($occ[$id][$d] ?? 0))); $occ[$id][$d] = ($occ[$id][$d] ?? 0) + $take; $need -= $take; }
        if ($need > 0 && $ids) $occ[$ids[0]][$d] = ($occ[$ids[0]][$d] ?? 0) + $need; } } }
  return $occ;
}
function addDays($d, $n) { return gmdate('Y-m-d', strtotime($d.' 00:00:00 UTC') + $n * 86400); }
function r100($x) { return (int)(round($x / 100) * 100); }
function is_weekend_night($d) { $w = (int)gmdate('w', strtotime($d.' 00:00:00 UTC')); return $w === 5 || $w === 6; }
/* how full a place is on a night (0..1): prices rise with it, up to surgeMax% */
function place_fill($u, $d, $occ, $U) {
  if (!in_array($u['kind'], ['room','tent'], true)) return 0;
  $tot = 0; $used = 0; foreach ($U as $id => $x) if ($x['place'] === $u['place']) { $tot += $x['rooms']; $used += $occ[$id][$d] ?? 0; }
  return $tot <= 1 ? 0 : min(1, $used / ($tot - 1));
}
/* One room-night on the festival board, split into who gets what:
   owner = the place's own price (paid to the owner), surge = high-demand add (Calm Shade), tickets = festival entry per guest
   (Calm Shade; tents include it), fee = 3% of the owner price for places that aren't Karthik's (Calm Shade). */
function unit_night($u, $id, $d, $g, $occ, $S, $U) {
  $we = is_weekend_night($d); $rate = $we ? $u['rateWe'] : $u['rate']; $x = $we ? $u['extraWe'] : $u['extra'];
  $owner = $rate + max(0, $g - $u['base']) * $x;
  $surge = $u['kind'] === 'partner' ? 0 : r100($rate * ($S['surgeMax'] / 100) * place_fill($u, $d, $occ, $U));
  $tickets = $u['kind'] === 'tent' ? 0 : $g * ($u['kind'] === 'partner' ? $S['partnerMarkup'] : $S['dayPass']);
  $fee = $u['own'] ? 0 : (int)round($owner * FEE_PCT / 100);
  return ['price'=>$owner + $surge + $tickets + $fee,'owner'=>$owner,'surge'=>$surge,'tickets'=>$tickets,'fee'=>$fee];
}
function valid_date($d) { return is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int)substr($d,5,2),(int)substr($d,8,2),(int)substr($d,0,4)); }
function extras_def() { $j = json_decode((string)kv_get('extras'), true); if (is_array($j)) return $j;
  return [['id'=>'pickup','name'=>'Pickup from Lonavala station (per car, one way)','price'=>1000,'on'=>true]]; }

/* Price and validate a trip against the live inventory. Returns [quote, errors]. */
function quote($stays, $passes, $occ, $advs = [], $extras = []) {
  $S = settings(); $U = units(); $err = []; $lines = []; $prem = []; $want = []; $ownerBy = [];
  if (!is_array($advs)) $advs = []; if (!is_array($extras)) $extras = [];
  if (!is_array($stays) || !is_array($passes) || count($stays) + count($passes) + count($advs) + count($extras) === 0) return [null, ['Your trip is empty.']];
  if (count($stays) > 20 || count($passes) > 40 || count($advs) > 20 || count($extras) > 20) return [null, ['That trip has too many items.']];
  if (!$stays && !$passes && !$advs) return [null, ['Add a stay, a day pass or an adventure to go with your extras.']];
  $sum = ['owner'=>0,'surge'=>0,'tickets'=>0,'fee'=>0];
  foreach ($stays as $s) {
    $id = (string)($s['unit'] ?? ''); $u = $U[$id] ?? null;
    if (!$u) { $err[] = 'One of the stays in your trip is no longer available. Remove it and pick again.'; continue; }
    $from = (string)($s['from'] ?? ''); $n = (int)($s['n'] ?? 0); $rooms = (int)($s['rooms'] ?? 0);
    $g = (int)($s['guests'] ?? 2); if ($u['cap'] === 1) $g = 1;
    if (!valid_date($from) || $n < 1 || $n > 40 || $rooms < 1 || $rooms > $u['rooms'] || $g < 1 || $g > $u['cap']) { $err[] = 'Check the dates, rooms and guests for '.$u['name'].'.'; continue; }
    $nights = []; for ($i = 0; $i < $n; $i++) $nights[] = addDays($from, $i);
    if ($nights[0] < $S['firstNight'] || end($nights) > $S['lastNight']) { $err[] = $u['name'].': those nights are outside the festival.'; continue; }
    $per = []; $part = ['owner'=>0,'surge'=>0,'tickets'=>0,'fee'=>0];
    foreach ($nights as $d) { $x = unit_night($u,$id,$d,$g,$occ,$S,$U); $per[] = $x['price']; foreach ($part as $k => $_) $part[$k] += $x[$k] * $rooms; $want[$id][$d] = ($want[$id][$d] ?? 0) + $rooms; }
    if ($u['kind'] !== 'partner') foreach ($nights as $d) $prem[$d] = 1;
    foreach ($part as $k => $v) $sum[$k] += $v;
    $ownerBy[$u['place']] = ($ownerBy[$u['place']] ?? 0) + ($u['own'] ? 0 : $part['owner']);
    $spot = $u['kind'] === 'tent' && isset(TENT_SPOTS[$s['spot'] ?? '']) ? $s['spot'] : '';
    $lines[] = ['kind'=>'stay','unit'=>$id,'place'=>$u['place'],'name'=>$u['name'],'unitKind'=>$u['kind'],'nights'=>$nights,'rooms'=>$rooms,'guests'=>$g,'per'=>$per,'total'=>array_sum($per) * $rooms,
      'payout'=>$u['own'] ? 0 : $part['owner'],'owner'=>$part['owner'],'fee'=>$part['fee'],'tickets'=>$part['tickets'],'surge'=>$part['surge'],'own'=>$u['own'],'spot'=>$spot];
  }
  foreach ($want as $id => $byNight) foreach ($byNight as $d => $r) {
    $left = $U[$id]['rooms'] - ($occ[$id][$d] ?? 0);
    if ($r > $left) $err[] = $U[$id]['name'].' has only '.max(0,$left).' left on '.gmdate('j M', strtotime($d)).'.';
  }
  $pt = 0;
  foreach ($passes as $p) {
    $d = (string)($p['date'] ?? ''); $q = (int)($p['qty'] ?? 0);
    if (!valid_date($d) || $d < $S['firstNight'] || $d > $S['passLast'] || $q < 1 || $q > 30) { $err[] = 'Check your day pass dates.'; continue; }
    $lines[] = ['kind'=>'pass','date'=>$d,'qty'=>$q,'total'=>$q * $S['dayPass']]; $pt += $q * $S['dayPass'];
  }
  $at = 0; $ao = $advs ? adv_occ() : []; $aw = [];
  foreach ($advs as $a) {
    $id = (string)($a['adv'] ?? ''); $d = (string)($a['date'] ?? ''); $sl = (string)($a['slot'] ?? ''); $q = (int)($a['qty'] ?? 0); $A = ADV[$id] ?? null;
    if (!$A || !valid_date($d) || $d < $S['firstNight'] || $d > $S['lastNight'] || !in_array($sl, $A['slots'], true) || $q < 1 || $q > 20) { $err[] = 'Check the adventure date, slot and people.'; continue; }
    $k = $id.'|'.$d.'|'.$sl; $aw[$k] = ($aw[$k] ?? 0) + $q; $left = (int)$S['advCap_'.$id] - ($ao[$k] ?? 0);
    if ($aw[$k] > $left) { $err[] = $A['name'].' on '.gmdate('j M', strtotime($d)).($sl === 'wind' ? '' : ' at '.$sl).' has only '.max(0, $left).' place'.($left === 1 ? '' : 's').' left.'; continue; }
    $price = (int)$S['adv_'.$id]; $dep = min($price, (int)$S['advDeposit']);
    $lines[] = ['kind'=>'adv','adv'=>$id,'name'=>$A['name'],'date'=>$d,'slot'=>$sl,'qty'=>$q,'price'=>$price,'deposit'=>$dep,'total'=>$dep * $q,'balance'=>($price - $dep) * $q];
    $at += $dep * $q;
  }
  $xt = 0; $XD = []; foreach (extras_def() as $x) if (!empty($x['on'])) $XD[$x['id']] = $x;
  foreach ($extras as $e) {
    $id = (string)($e['id'] ?? ''); $q = (int)($e['qty'] ?? 0); $X = $XD[$id] ?? null;
    if (!$X || $q < 1 || $q > 50) { $err[] = 'One of the extras in your trip is no longer offered. Remove it.'; continue; }
    $lines[] = ['kind'=>'extra','extra'=>$id,'name'=>$X['name'],'qty'=>$q,'price'=>(int)$X['price'],'total'=>(int)$X['price'] * $q]; $xt += (int)$X['price'] * $q;
  }
  $pn = count($prem);
  $tier = $pn >= $S['vvipNights'] ? 'vvip' : ($pn >= $S['vipNights'] ? 'vip' : '');
  $stayT = array_sum(array_map(fn($l)=>$l['kind']==='stay'?$l['total']:0, $lines));
  $payout = array_sum($ownerBy);
  $pct = $tier === 'vvip' ? $S['vvipPct'] : ($tier === 'vip' ? $S['vipPct'] : 0);
  /* the VIP discount comes out of Calm Shade's part; owners always get their full price */
  $disc = min((int)round(($stayT + $pt) * $pct / 100), max(0, $stayT + $pt - $payout));
  $total = max(0,$stayT+$pt-$disc)+$at+$xt;
  return [['items'=>$lines,'stays'=>$stayT,'passes'=>$pt,'advs'=>$at,'extras'=>$xt,'balance'=>array_sum(array_map(fn($l)=>$l['balance']??0, $lines)),'discount'=>$disc,'total'=>$total,'payout'=>$payout,
    'owner'=>$sum['owner'],'fee'=>$sum['fee'],'tickets'=>$sum['tickets'],'surge'=>$sum['surge'],'tier'=>$tier,'premiumNights'=>$pn,'pay'=>pay_split($ownerBy, $total)], array_values(array_unique($err))];
}

/* ---------- helpers ---------- */
function body() {
  $raw = file_get_contents('php://input', false, null, 0, 65536) ?: '{}';
  $j = json_decode($raw, true); return is_array($j) ? $j : [];
}
function clean($s, $max) {
  $s = trim((string)preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$s));
  return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}
function digits($s) { return substr(preg_replace('/\D/', '', (string)$s), -10); }
function client_ip() { return hash('sha256', ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0').'|appa'); }
/* Simple abuse guard: at most $max actions of one kind per visitor per $window seconds. */
function throttle($act, $max, $window, $msg) {
  $p = db(); $ip = client_ip(); $now = time();
  $p->prepare('DELETE FROM fest_hits WHERE at < ?')->execute([$now - 86400 * 2]);
  $st = $p->prepare('SELECT COUNT(*) c FROM fest_hits WHERE ip=? AND act=? AND at > ?'); $st->execute([$ip, $act, $now - $window]);
  if ((int)$st->fetch()['c'] >= $max) fail($msg, 429);
  $p->prepare('INSERT INTO fest_hits (ip,act,at) VALUES (?,?,?)')->execute([$ip, $act, $now]);
}
/* Best-effort email (Hostinger PHP mail). Never blocks a booking. */
function notify($to, $subject, $lines) {
  if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) return;
  $host = preg_replace('/[^a-z0-9.-]/i', '', $_SERVER['HTTP_HOST'] ?? 'calmshade.in');
  $from = defined('FEST_MAIL_FROM') ? FEST_MAIL_FROM : 'bookings@'.preg_replace('/^www\./', '', $host);
  $headers = 'From: APPA Art Fest <'.$from.">\r\nReply-To: ".settings()['contact']."\r\nContent-Type: text/plain; charset=UTF-8";
  if (defined('FEST_MAIL_LOG')) { @file_put_contents(FEST_MAIL_LOG, json_encode(['to'=>$to,'subject'=>$subject,'body'=>implode("\n", $lines)])."\n", FILE_APPEND); return; } /* tests only */
  @mail($to, '=?UTF-8?B?'.base64_encode($subject).'?=', implode("\n", $lines), $headers);
}
function inr($n) { return '₹'.number_format((float)$n); }
function trip_lines($items) {
  $out = [];
  foreach ($items as $it) {
    if ($it['kind'] === 'stay') $out[] = '- '.$it['name'].': '.gmdate('j M', strtotime($it['nights'][0])).' to '.gmdate('j M', strtotime(addDays(end($it['nights']), 1))).', '.count($it['nights']).' night(s), '.$it['rooms'].' room(s), '.$it['guests'].' adult(s) each — '.inr($it['total']);
    elseif ($it['kind'] === 'adv') $out[] = '- '.$it['name'].' '.gmdate('j M', strtotime($it['date'])).($it['slot'] === 'wind' ? ' (time set by the wind)' : ' at '.$it['slot']).' × '.$it['qty'].' — deposit '.inr($it['total']).', balance '.inr($it['balance']).' at the venue';
    else $out[] = '- Day pass '.gmdate('j M', strtotime($it['date'])).' × '.$it['qty'].' — '.inr($it['total']);
  }
  return $out;
}
/* ---------- sign in with a code by email (Karthik, 25 Oct 2026) ----------
   Owner panel: only these. Hosts: the email/phone on their host record. Everyone else: a guest (their own bookings). */
const OWNER_EMAILS = ['karthik@xtrathin.in'];
const OWNER_PHONES = ['9619176007'];
const SESSION_DAYS = 30;
function auth_init() {
  static $d = false; if ($d) return; $d = true;
  db()->exec('CREATE TABLE IF NOT EXISTS cs_codes (who VARCHAR(160) NOT NULL, code_hash VARCHAR(64) NOT NULL, expires BIGINT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, created BIGINT NOT NULL)');
  db()->exec('CREATE TABLE IF NOT EXISTS cs_sessions (token_hash VARCHAR(64) PRIMARY KEY, role VARCHAR(8) NOT NULL, email VARCHAR(160), phone VARCHAR(16), host_id VARCHAR(16), created BIGINT NOT NULL, seen BIGINT NOT NULL)');
}
function session_of($token) {
  static $c = []; $token = (string)$token; if (strlen($token) !== 40 || !ctype_xdigit($token)) return null;
  if (array_key_exists($token, $c)) return $c[$token];
  auth_init(); $st = db()->prepare('SELECT * FROM cs_sessions WHERE token_hash=?'); $st->execute([hash('sha256', $token)]); $r = $st->fetch();
  if ($r && (time() - (int)$r['seen']) > SESSION_DAYS * 86400) { db()->prepare('DELETE FROM cs_sessions WHERE token_hash=?')->execute([$r['token_hash']]); $r = null; }
  if ($r && time() - (int)$r['seen'] > 3600) db()->prepare('UPDATE cs_sessions SET seen=? WHERE token_hash=?')->execute([time(), $r['token_hash']]);
  return $c[$token] = $r ?: null;
}
/* the desk: the desk key, or Karthik signed in */
function is_admin_req() {
  $k = (string)($_SERVER['HTTP_X_FEST_KEY'] ?? '');
  if ($k === '') return false;
  if (defined('FEST_ADMIN_KEY') && strlen(FEST_ADMIN_KEY) >= 12 && hash_equals(FEST_ADMIN_KEY, $k)) return true;
  $s = session_of($k); return $s && $s['role'] === 'owner';
}
function need_admin() {
  if (is_admin_req()) return;
  if ((!defined('FEST_ADMIN_KEY') || strlen(FEST_ADMIN_KEY) < 12) && empty($_SERVER['HTTP_X_FEST_KEY'])) fail('The festival desk is locked until FEST_ADMIN_KEY is set in fest-config.php, or until you sign in.', 403);
  usleep(400000); fail('That desk key is not right. Sign in again.', 403);
}
function mask_email($e) { [$u, $d] = array_pad(explode('@', $e, 2), 2, ''); return mb_substr($u, 0, 1).str_repeat('•', max(2, min(6, strlen($u) - 1))).'@'.$d; }
/* who is signing in: [role, email to send the code to, phone, host row] */
function who_is($id) {
  $id = trim(mb_strtolower((string)$id)); $isMail = strpos($id, '@') !== false; $ph = $isMail ? '' : digits($id);
  if ($isMail && !filter_var($id, FILTER_VALIDATE_EMAIL)) return null;
  if (!$isMail && strlen($ph) !== 10) return null;
  if (($isMail && in_array($id, OWNER_EMAILS, true)) || (!$isMail && in_array($ph, OWNER_PHONES, true))) return ['owner', OWNER_EMAILS[0], OWNER_PHONES[0], null];
  hosts_init();
  foreach (db()->query('SELECT * FROM cs_hosts') as $h) {
    if (($isMail && mb_strtolower(trim((string)$h['email'])) === $id) || (!$isMail && digits($h['phone']) === $ph))
      return filter_var($h['email'], FILTER_VALIDATE_EMAIL) ? ['host', mb_strtolower(trim($h['email'])), digits($h['phone']), $h] : null;
  }
  if ($isMail) return ['guest', $id, '', null];
  /* a guest who typed a phone: send the code to the email on their latest booking with that phone */
  foreach (['fest_bookings','cs_bookings'] as $t) foreach (db()->query("SELECT guest FROM $t ORDER BY created_at DESC") as $r) {
    $g = json_decode($r['guest'], true) ?: [];
    if (digits($g['phone'] ?? '') === $ph && filter_var($g['email'] ?? '', FILTER_VALIDATE_EMAIL)) return ['guest', mb_strtolower($g['email']), $ph, null];
  }
  return ['nomail', '', $ph, null];
}
/* a signed-in guest's bookings (matched on the email, or the phone they signed in with) */
function guest_tickets($email, $phone) {
  $out = ['fest'=>[], 'cs'=>[]];
  foreach (['fest'=>'fest_bookings','cs'=>'cs_bookings'] as $k => $t) foreach (db()->query("SELECT ref, token, guest, status FROM $t ORDER BY created_at DESC") as $r) {
    $g = json_decode($r['guest'], true) ?: [];
    if (($email && mb_strtolower(trim($g['email'] ?? '')) === $email) || ($phone && digits($g['phone'] ?? '') === $phone)) $out[$k][] = ['ref'=>$r['ref'],'token'=>$r['token']];
  }
  return $out;
}
function session_out($s, $token = null) {
  $o = ['ok'=>true,'role'=>$s['role'],'email'=>$s['email'],'name'=>''];
  if ($token) $o['token'] = $token;
  if ($s['role'] === 'owner') $o['name'] = 'Karthik';
  if ($s['role'] === 'host') { hosts_init(); $st = db()->prepare('SELECT name FROM cs_hosts WHERE id=?'); $st->execute([$s['host_id']]); $o['name'] = (string)(($st->fetch() ?: [])['name'] ?? ''); }
  if ($s['role'] === 'guest') $o['tickets'] = guest_tickets($s['email'], $s['phone']);
  return $o;
}
function lock_start() { $p = db(); if (is_mysql()) { $p->query("SELECT GET_LOCK('appa_fest_book', 10)"); $p->beginTransaction(); } else { $p->exec('BEGIN IMMEDIATE'); } }
function lock_end($ok) { $p = db(); if (is_mysql()) { $ok ? $p->commit() : $p->rollBack(); $p->query("SELECT RELEASE_LOCK('appa_fest_book')"); } else { $p->exec($ok ? 'COMMIT' : 'ROLLBACK'); } }
function new_ref() { $a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $r = 'APPA-'; for ($i = 0; $i < 5; $i++) $r .= $a[random_int(0, strlen($a)-1)]; return $r; }
function public_listings() {
  $out = [];
  foreach (listings_all() as $l) if ($l['status'] === 'approved') {
    $d = json_decode($l['data'], true) ?: [];
    if (!empty($d['paused'])) continue;
    $out[] = ['id'=>'L-'.$l['id'],'name'=>$d['name']??'','type'=>$d['type']??'','location'=>$d['location']??'','distance'=>$d['distance']??'','rooms'=>(int)($d['rooms']??1),'maxGuests'=>(int)($d['maxGuests']??2),'rate'=>(int)($d['rate']??0),'desc'=>clean($d['desc']??'',240),'photo'=>($d['photos'][(int)($d['cover']??0)]['src'] ?? ($d['photos'][0]['src'] ?? '')),'maps'=>$d['maps']??'','website'=>$d['website']??'','onCalmShade'=>!empty($d['yearRound'])];
  }
  return $out;
}

/* ---------- Calm Shade homestays (whole place per night) ---------- */
/* id => [name, sleeps, per head with meals, per head without meals, bookable] — defaults; the dashboard editor
   overrides name/price/bookable (and display fields) into cs_builtin below, so this no longer needs hand-syncing
   with PROPS in index.html for day-to-day price changes. Sleeps stays here (no editor field for it yet). */
const CS_PROPS = [
  'p1'=>['Calmshet Lakeview Cottage',8,4000,4000,true],   'p2'=>['Calmshet Lakeview Room 2',3,4000,4000,true],
  'p3'=>['Calmshet Lakeview Room 1',5,4000,4000,true],    'p4'=>['Calmshet Lakeview Triangle',6,4000,4000,true],
  'p5'=>['Appa Art Cottage',2,4000,4000,true],            'p6'=>['Appa Art House',12,4000,4000,true],
  /* p7–p9 are the Grove's demo hosts (Mira, Ravi, Anya) — not real stays, never bookable by guests */
  'p7'=>['The Quiet Courtyard',5,1600,1100,false],        'p8'=>['The Old Millhouse',6,1500,1000,false],
  'p9'=>["Anya's Terrace",4,1300,900,false],
];
const CS_COMM = 0.03;
/* Built-in listing edits (dashboard → Save), keyed by CS_PROPS id. Only present fields override the default. */
function cs_builtin_init() { db()->exec('CREATE TABLE IF NOT EXISTS cs_builtin (id VARCHAR(8) PRIMARY KEY, data TEXT NOT NULL, updated_at BIGINT NOT NULL)'); }
function cs_builtin_overrides() {
  static $o = null; if ($o !== null) return $o;
  cs_builtin_init(); $o = [];
  foreach (db()->query('SELECT id, data FROM cs_builtin') as $r) $o[$r['id']] = json_decode($r['data'], true) ?: [];
  return $o;
}
function cs_builtin_clean($p, $old) {
  $d = $old;
  if (array_key_exists('name', $p)) $d['name'] = clean($p['name'], 80);
  if (array_key_exists('loc', $p)) $d['loc'] = clean($p['loc'], 80);
  if (array_key_exists('cat', $p)) $d['cat'] = in_array($p['cat'], CS_CATS, true) ? $p['cat'] : ($old['cat'] ?? 'room');
  if (array_key_exists('cap', $p)) $d['cap'] = clean($p['cap'], 60);
  if (array_key_exists('link', $p)) $d['link'] = clean_url($p['link']);
  if (array_key_exists('ppWith', $p)) $d['ppWith'] = max(100, min(50000, (int)$p['ppWith']));
  if (array_key_exists('ppWithout', $p)) $d['ppWithout'] = max(100, min(50000, (int)$p['ppWithout']));
  if (array_key_exists('pet', $p)) $d['pet'] = !empty($p['pet']);
  if (array_key_exists('villa', $p)) $d['villa'] = !empty($p['villa']);
  if (array_key_exists('amen', $p)) $d['amen'] = clean($p['amen'], 300);
  if (array_key_exists('desc', $p)) $d['desc'] = clean($p['desc'], 1200);
  if (array_key_exists('bookable', $p)) $d['bookable'] = !empty($p['bookable']);
  return $d;
}
function ist_today() { return gmdate('Y-m-d', time() + 19800); }
function cs_init() { db(); }
/* one pass over Calm Shade bookings: [whole-listing nights 'bk'|'tn' per listing, rooms taken per room id per night] */
function cs_scan() {
  static $c = null; if ($c !== null) return $c;
  $S = settings(); $raw = []; $rooms = [];
  foreach (db()->query("SELECT status, created_at, items FROM cs_bookings WHERE status IN ".LIVE) as $b) {
    if (!active_booking($b, $S)) continue;
    $firm = $b['status'] !== 'pending';
    foreach (json_decode($b['items'], true) ?: [] as $it) foreach ($it['nights'] as $d) {
      if (!empty($it['room'])) { $rooms[$it['prop']][$d] = ($rooms[$it['prop']][$d] ?? 0) + (int)$it['rooms']; continue; }
      $cur = $raw[$it['prop']][$d] ?? '';
      $raw[$it['prop']][$d] = ($firm || $cur === 'bk') ? 'bk' : 'tn';
    }
  }
  return $c = [$raw, $rooms];
}
function cs_raw_occ() { return cs_scan()[0]; }
function cs_room_occ() { return cs_scan()[1]; }
function festival_nights($S) { $out = []; for ($d = $S['firstNight']; $d <= $S['lastNight']; $d = addDays($d, 1)) $out[] = $d; return $out; }
/* Calendar states for calmshade.in: 'bk' booked, 'tn' held, 'fx' festival night (book it with festival tickets), 'ar' reserved for the festival artist */
function cs_occ() {
  $S = settings(); $occ = cs_raw_occ(); $fo = fest_raw_occ(); $ro = cs_room_occ(); $win = festival_nights($S);
  foreach ($fo as $unit => $nights) if (strpos($unit, 'L-') === 0) foreach ($nights as $d => $n) if ($n > 0) $occ[$unit][$d] = 'bk';
  foreach (places() as $pl) foreach ($pl['rooms'] as $r) {
    $keys = $r['cs'] ? [$r['id'], $r['cs']] : [$r['id']]; $used = [];
    foreach ([$fo[$r['id']] ?? [], $ro[$r['id']] ?? []] as $src) foreach ($src as $d => $n) $used[$d] = ($used[$d] ?? 0) + $n;
    if ($r['cs']) foreach ($occ[$r['cs']] ?? [] as $d => $st) $occ[$r['id']][$d] = $st; /* the Calm Shade listing's own nights ('tn' held, 'bk' booked) */
    foreach ($used as $d => $n) if ($n >= $r['count']) foreach ($keys as $k) $occ[$k][$d] = 'bk';
    if ($r['festBlock']) { foreach ($win as $d) foreach ($keys as $k) $occ[$k][$d] = 'ar'; }
    elseif ($r['fest']) foreach ($win as $d) foreach ($keys as $k) if (empty($occ[$k][$d])) $occ[$k][$d] = 'fx';
  }
  return $occ;
}
/* Calm Shade property: built-in ones from CS_PROPS, plus enrolled partner listings ('L-<id>') */
function cs_prop($id) {
  if (isset(CS_PROPS[$id])) {
    $base = CS_PROPS[$id]; $o = cs_builtin_overrides()[$id] ?? [];
    return [$o['name'] ?? $base[0], $base[1], $o['ppWith'] ?? $base[2], $o['ppWithout'] ?? $base[3], array_key_exists('bookable', $o) ? $o['bookable'] : $base[4]];
  }
  if (strpos($id, 'L-') !== 0) return null;
  $st = db()->prepare('SELECT status, data FROM fest_listings WHERE id=?'); $st->execute([substr($id, 2)]); $r = $st->fetch();
  if (!$r || $r['status'] !== 'approved') return null;
  $d = json_decode($r['data'], true) ?: []; if (empty($d['yearRound'])) return null;
  $sleeps = max(1, (int)($d['sleeps'] ?? ((int)($d['rooms'] ?? 1) * (int)($d['maxGuests'] ?? 2))));
  $pw = max(100, (int)($d['ppWith'] ?? round(($d['rate'] ?? 2000) / 2))); $po = max(100, (int)($d['ppWithout'] ?? $pw));
  return [(string)($d['name'] ?? 'Partner stay'), $sleeps, $pw, $po, empty($d['paused'])];
}
function fest_night_msg($name, $d) { return $name.': '.gmdate('j M', strtotime($d)).' is an APPA Art Fest night. During the festival this stay is booked together with festival tickets, on the APPA Art Fest page.'; }
/* A room-night on calmshade.in: the place's own price, plus 3% for places that aren't Karthik's. */
function room_night($pl, $r, $d, $g) {
  $we = is_weekend_night($d); $owner = ($we ? $r['rateWe'] : $r['rate']) + max(0, $g - $r['base']) * ($we ? $r['extraWe'] : $r['extra']);
  $fee = $pl['own'] ? 0 : (int)round($owner * FEE_PCT / 100);
  return [$owner + $fee, $owner, $fee];
}
function cs_quote($legs, $occ) {
  $S = settings(); $err = []; $items = []; $seen = []; $today = ist_today(); $max = addDays($today, 400); $ownerBy = [];
  if (!is_array($legs) || !$legs) return [null, ['Pick at least one night.']];
  if (count($legs) > 14) return [null, ['That trip has too many stops.']];
  $fo = null; $ro = null;
  foreach ($legs as $l) {
    $id = (string)($l['prop'] ?? '');
    $nights = array_values(array_unique(array_map('strval', (array)($l['nights'] ?? []))));
    sort($nights);
    if ($m = room_by_id($id)) {
      [$pl, $r] = $m; $nm = $pl['name'].' · '.$r['name'];
      if ($pl['off'] || $r['count'] < 1) { $err[] = $nm.' is not taking bookings right now.'; continue; }
      $rooms = max(1, (int)($l['rooms'] ?? 1)); $g = (int)($l['guests'] ?? 2);
      if ($g < 1 || $g > $r['max']) { $err[] = $nm.' sleeps up to '.$r['max'].' per room.'; continue; }
      if ($rooms > $r['count']) { $err[] = $pl['name'].' has '.$r['count'].' '.strtolower($r['name']).($r['count'] > 1 ? 's' : '').'.'; continue; }
      if (!$nights || count($nights) > 60) { $err[] = 'Pick between 1 and 60 nights at '.$nm.'.'; continue; }
      $fo = $fo ?? fest_raw_occ(); $ro = $ro ?? cs_room_occ(); $per = []; $own = 0; $fee = 0;
      foreach ($nights as $d) {
        if (!valid_date($d) || $d < $today || $d > $max) { $err[] = $nm.': '.$d.' can\'t be booked.'; continue 2; }
        if (in_festival($d, $S) && $r['festBlock']) { $err[] = $nm.' is reserved for the festival artist from '.gmdate('j M', strtotime($S['firstNight'])).' to '.gmdate('j M Y', strtotime($S['lastNight'])).'.'; continue 2; }
        if (in_festival($d, $S) && $r['fest']) { $err[] = fest_night_msg($nm, $d); continue 2; }
        $used = ($fo[$id][$d] ?? 0) + ($ro[$id][$d] ?? 0) + ($seen[$id][$d] ?? 0);
        if ($used + $rooms > $r['count']) { $err[] = $nm.' is booked on '.gmdate('j M', strtotime($d)).'.'; continue 2; }
        $seen[$id][$d] = ($seen[$id][$d] ?? 0) + $rooms;
        [$p, $o, $f] = room_night($pl, $r, $d, $g); $per[] = $p; $own += $o * $rooms; $fee += $f * $rooms;
      }
      $total = array_sum($per) * $rooms;
      if (!$pl['own']) $ownerBy[$pl['id']] = ($ownerBy[$pl['id']] ?? 0) + $own;
      $items[] = ['prop'=>$id,'room'=>true,'place'=>$pl['id'],'name'=>$nm,'nights'=>$nights,'rooms'=>$rooms,'guests'=>$g,'heads'=>$g * $rooms,'meals'=>false,'per'=>$per,'owner'=>$own,'fee'=>$fee,'own'=>$pl['own'],'total'=>$total];
      continue;
    }
    $p = cs_prop($id);
    if (!$p || !$p[4]) { $err[] = 'One of these stays is not taking bookings right now.'; continue; }
    $heads = (int)($l['heads'] ?? 0); $meals = !empty($l['meals']);
    if ($heads < 1 || $heads > $p[1]) { $err[] = $p[0].' sleeps up to '.$p[1].'.'; continue; }
    if (!$nights || count($nights) > 60) { $err[] = 'Pick between 1 and 60 nights at '.$p[0].'.'; continue; }
    $same = room_by_cs($id);
    foreach ($nights as $d) {
      if (!valid_date($d) || $d < $today || $d > $max) { $err[] = $p[0].': '.$d.' can\'t be booked.'; continue 2; }
      if ($same && in_festival($d, $S) && $same[1]['festBlock']) { $err[] = $p[0].' is reserved for the festival artist from '.gmdate('j M', strtotime($S['firstNight'])).' to '.gmdate('j M Y', strtotime($S['lastNight'])).'.'; continue 2; }
      if ($same && in_festival($d, $S) && $same[1]['fest']) { $err[] = fest_night_msg($p[0], $d); continue 2; }
      if (!empty($occ[$id][$d]) || isset($seen[$id][$d])) { $err[] = $p[0].' is already booked on '.gmdate('j M', strtotime($d)).'.'; continue 2; }
      $seen[$id][$d] = 1;
    }
    $pp = $meals ? $p[2] : $p[3]; $base = $pp * $heads * count($nights);
    /* partner hosts keep their full price; guests pay the 3% Calm Shade fee on top (Karthik, 25 Oct 2026) */
    $fee = strpos($id, 'L-') === 0 ? (int)round($base * FEE_PCT / 100) : 0;
    $items[] = ['prop'=>$id,'name'=>$p[0],'nights'=>$nights,'heads'=>$heads,'meals'=>$meals,'pp'=>$pp,'owner'=>$base,'fee'=>$fee,'total'=>$base + $fee];
  }
  $total = array_sum(array_column($items, 'total'));
  $payout = 0; foreach ($items as $it) $payout += !empty($it['room']) ? ($it['own'] ? 0 : $it['owner']) : (strpos($it['prop'], 'L-') === 0 ? $it['owner'] : 0);
  return [['items'=>$items,'total'=>$total,'payout'=>$payout,'pay'=>pay_split($ownerBy, $total)], array_values(array_unique($err))];
}
function cs_lines($items) {
  return array_map(fn($it)=>'- '.$it['name'].': '.implode(', ', array_map(fn($d)=>gmdate('j M', strtotime($d)), $it['nights'])).' · '.(!empty($it['room']) ? $it['rooms'].' room(s), '.$it['guests'].' guest(s) each' : $it['heads'].' guest(s)'.($it['meals'] ? ' with meals' : '')).' — '.inr($it['total']), $items);
}
/* plain-words payment plan, for emails */
function pay_lines($pay, $S, $ref) {
  if (!$pay || empty($pay['hosts'])) return [];
  $out = ['', 'How to pay (two steps):', 'Step 1 · '.inr($pay['calm']).' to Calm Shade, UPI '.$S['upi'].' ('.$S['payee'].'), note '.$ref.'. This holds your booking.'];
  foreach ($pay['hosts'] as $h) $out[] = 'Step 2 · '.inr($h['amount']).' straight to '.$h['name'].', UPI '.$h['upi'].($h['payee'] ? ' ('.$h['payee'].')' : '').', note '.$ref.'. Pay this once step 1 is confirmed.';
  return $out;
}
function find_booking($table, $ref) { $st = db()->prepare("SELECT * FROM $table WHERE ref=?"); $st->execute([(string)$ref]); return $st->fetch(); }

/* ---------- AI concierge proxy (locked down) ---------- */
function ai_key() {
  if (defined('ANTHROPIC_KEY')) return ANTHROPIC_KEY;
  if (is_file(__DIR__.'/secrets.php')) { require_once __DIR__.'/secrets.php'; if (defined('ANTHROPIC_KEY')) return ANTHROPIC_KEY; }
  return '';
}



/* ---------- Partner listings → Calm Shade listings, host accounts ---------- */
const CS_CATS = ['lake','cabin','room','creative','group'];
function clean_url($u) {
  $u = trim((string)$u); if ($u === '') return '';
  if (!preg_match('#^https?://#i', $u)) $u = 'https://'.$u;
  return (filter_var($u, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $u)) ? substr($u, 0, 300) : '';
}
function clean_photo($u) { $u = (string)$u; return preg_match('#^uploads/\d{6}/[a-f0-9]{24}\.(jpg|png|webp)$#', $u) ? $u : ''; }
function geo_from($maps) {
  if (preg_match('/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/', $maps, $m) || preg_match('/[?&](?:q|ll|query)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/', $maps, $m)
      || preg_match('/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/', $maps, $m)) return [round((float)$m[1], 5), round((float)$m[2], 5)];
  return null;
}
/* Listing fields hosts and applicants may set; $old keeps anything not sent */
function listing_fields($p, $old = []) {
  $d = $old;
  $set = function ($k, $v) use (&$d, $p) { if (array_key_exists($k, $p)) $d[$k] = $v; };
  $set('name', clean($p['name'] ?? '', 80)); $set('type', clean($p['type'] ?? '', 30)); $set('location', clean($p['location'] ?? '', 80));
  $set('distance', clean($p['distance'] ?? '', 8)); $set('desc', clean($p['desc'] ?? '', 1200)); $set('amen', clean($p['amen'] ?? '', 300));
  $set('rooms', max(1, min(60, (int)($p['rooms'] ?? 1)))); $set('maxGuests', max(1, min(8, (int)($p['maxGuests'] ?? 2))));
  $set('rate', max(500, min(200000, (int)($p['rate'] ?? 0)))); $set('sleeps', max(1, min(60, (int)($p['sleeps'] ?? 2))));
  $set('ppWith', max(100, min(50000, (int)($p['ppWith'] ?? 0)))); $set('ppWithout', max(100, min(50000, (int)($p['ppWithout'] ?? 0))));
  $set('pet', !empty($p['pet'])); $set('villa', !empty($p['villa'])); $set('yearRound', !empty($p['yearRound'])); $set('paused', !empty($p['paused']));
  $set('cat', in_array($p['cat'] ?? '', CS_CATS, true) ? $p['cat'] : 'room');
  $set('upi', preg_match('/^[a-zA-Z0-9.\-_]{2,60}@[a-zA-Z0-9.\-]{2,40}$/', trim((string)($p['upi'] ?? ''))) ? trim((string)$p['upi']) : '');
  $set('payee', clean($p['payee'] ?? '', 80));
  $set('maps', clean_url($p['maps'] ?? '')); $set('website', clean_url($p['website'] ?? '')); $set('link', clean_url($p['link'] ?? ''));
  if (array_key_exists('photos', $p)) {
    $ph = []; foreach (array_slice((array)$p['photos'], 0, 12) as $x) { $src = clean_photo(is_array($x) ? ($x['src'] ?? '') : $x); if ($src) $ph[] = ['src'=>$src, 'cap'=>clean(is_array($x) ? ($x['cap'] ?? '') : '', 120)]; }
    $d['photos'] = $ph;
  }
  if (array_key_exists('cover', $p)) $d['cover'] = max(0, min(11, (int)$p['cover']));
  if (array_key_exists('faq', $p)) { $f = []; foreach (array_slice((array)$p['faq'], 0, 20) as $x) { $q = clean($x['q'] ?? '', 200); $a = clean($x['a'] ?? '', 600); if ($q !== '' && $a !== '') $f[] = ['q'=>$q,'a'=>$a]; } $d['faq'] = $f; }
  if (array_key_exists('maps', $p)) { $g = geo_from($d['maps']); if ($g) $d['geo'] = $g; }
  if (array_key_exists('geo', $p) && is_array($p['geo']) && count($p['geo']) === 2 && is_numeric($p['geo'][0]) && is_numeric($p['geo'][1])) $d['geo'] = [round((float)$p['geo'][0], 5), round((float)$p['geo'][1], 5)];
  return $d;
}
function hosts_init() { db()->exec('CREATE TABLE IF NOT EXISTS cs_hosts (id VARCHAR(16) PRIMARY KEY, listing_id VARCHAR(20) NOT NULL, name TEXT, phone VARCHAR(24), email TEXT, key_hash VARCHAR(64), created_at BIGINT NOT NULL)'); }
function host_for_listing($lid) { hosts_init(); $st = db()->prepare('SELECT * FROM cs_hosts WHERE listing_id=?'); $st->execute([$lid]); return $st->fetch(); }
function host_new_key($hostId) { $k = bin2hex(random_bytes(20)); db()->prepare('UPDATE cs_hosts SET key_hash=? WHERE id=?')->execute([hash('sha256', $k), $hostId]); return $k; }
function need_host() {
  hosts_init(); $k = (string)($_SERVER['HTTP_X_HOST_KEY'] ?? '');
  if (strlen($k) < 20) fail('Sign in with your host link first.', 401);
  $st = db()->prepare('SELECT * FROM cs_hosts WHERE key_hash=?'); $st->execute([hash('sha256', $k)]); $h = $st->fetch();
  if (!$h && ($ss = session_of($k)) && $ss['role'] === 'host') { $st = db()->prepare('SELECT * FROM cs_hosts WHERE id=?'); $st->execute([$ss['host_id']]); $h = $st->fetch(); }
  if (!$h) { usleep(300000); fail('That host link has expired. Ask the festival team for a new one, or request it from the host login page.', 401); }
  return $h;
}
function site_base() {
  $h = preg_replace('/[^a-z0-9.:-]/i', '', $_SERVER['HTTP_HOST'] ?? 'calmshade.in');
  $local = preg_match('/^(127\.0\.0\.1|localhost)(:\d+)?$/', $h) && empty($_SERVER['HTTPS']);
  return ($local ? 'http://' : 'https://').$h.'/';
}
/* A partner listing as a Calm Shade property, for the site */
function cs_public_prop($l, $host) {
  $d = json_decode($l['data'], true) ?: [];
  $sleeps = max(1, (int)($d['sleeps'] ?? ((int)($d['rooms'] ?? 1) * (int)($d['maxGuests'] ?? 2))));
  $pw = (int)($d['ppWith'] ?? round(($d['rate'] ?? 2000) / 2)); $po = (int)($d['ppWithout'] ?? $pw);
  return ['id'=>'L-'.$l['id'],'owner'=>'h'.$host['id'],'name'=>$d['name'] ?? '','loc'=>trim(($d['location'] ?? '').' · near APPA Art Fest', ' ·'),'cat'=>$d['cat'] ?? 'room',
    'cap'=>'Up to '.$sleeps.' guests · '.($d['rooms'] ?? 1).' room'.(($d['rooms'] ?? 1) > 1 ? 's' : ''),'sleeps'=>$sleeps,'ppWith'=>$pw,'ppWithout'=>$po,'pet'=>!empty($d['pet']),'villa'=>!empty($d['villa']),
    'amen'=>$d['amen'] ?? '','desc'=>$d['desc'] ?? '','photos'=>$d['photos'] ?? [],'cover'=>(int)($d['cover'] ?? 0),'faq'=>$d['faq'] ?? [],'geo'=>$d['geo'] ?? null,
    'maps'=>$d['maps'] ?? '','website'=>$d['website'] ?? '','link'=>$d['link'] ?? '','live'=>empty($d['paused']),'festival'=>true];
}

/* ---------- APPA Art Passport: venue stamps + timetable ---------- */
const STAMP_SPOTS = ['calmshet','purrom','ctheatre','theeya','lefarm','shambhala','square','island'];
function kv_get($k) { $st = db()->prepare('SELECT v FROM fest_kv WHERE k=?'); $st->execute([$k]); $r = $st->fetch(); return $r ? $r['v'] : null; }
function kv_set($k, $v) { db()->prepare('DELETE FROM fest_kv WHERE k=?')->execute([$k]); db()->prepare('INSERT INTO fest_kv (k,v) VALUES (?,?)')->execute([$k, $v]); }
function stamp_secret() { $s = kv_get('stamp_secret'); if (!$s) { $s = bin2hex(random_bytes(24)); kv_set('stamp_secret', $s); } return $s; }
function stamp_sig($spot) { return substr(hash_hmac('sha256', 'stamp|'.$spot, stamp_secret()), 0, 12); }
function schedule() { $v = kv_get('schedule'); if ($v === null) return default_schedule(); $j = json_decode((string)$v, true); return is_array($j) ? $j : []; }
/* The starting programme (Karthik, 20 Oct 2026), shown until the desk saves its own timetable. Items can run over a range
   (date..to): exhibits and mini-festivals run all 36 days. kind: show | exhibit | fest | dhol | workshop | adventure. */
function default_schedule() {
  $F = '2027-02-12'; $L = '2027-03-19'; $out = []; $n = 0;
  $add = function ($date, $to, $spot, $title, $kind, $time = '') use (&$out, &$n) { $n++; $out[] = ['id'=>'d'.$n,'date'=>$date,'to'=>$to,'time'=>$time,'spot'=>$spot,'title'=>$title,'access'=>'all','kind'=>$kind]; };
  foreach (['calmshet','purrom','ctheatre','theeya','lefarm','shambhala'] as $v) $add($F, $L, $v, 'K. N. Ramachandran exhibit', 'exhibit');
  $add($F, $L, 'lefarm', 'Dashavatar exhibit', 'exhibit'); $add($F, $L, 'theeya', 'Pyoba Awards exhibit', 'exhibit');
  $add($F, $L, 'ctheatre', 'Antique & Kitsch exhibit', 'exhibit'); $add($F, $L, 'purrom', 'Maval Comics exhibit', 'exhibit');
  $add($F, $L, 'lefarm', 'Animela · the anime festival: comics, films, toys', 'fest');
  $add($F, $L, 'purrom', 'Wench Film Festival', 'fest'); $add($F, $L, 'ctheatre', 'The Company Theatre festival', 'fest');
  $add($F, '', 'calmshet', 'Opening day', 'show');
  /* the village dhol pathak: a different venue on every big night (day 3, 6 and 9 of each chapter), and across the lake on Shivaji Jayanti */
  $ven = ['calmshet','purrom','ctheatre','theeya','lefarm','shambhala'];
  for ($c = 0; $c < 4; $c++) foreach ([3, 6, 9] as $i => $k) { $d = addDays($F, $c * 9 + $k - 1); $add($d, '', $ven[($c * 3 + $i) % 6], 'Dhol pathak', 'dhol', '18:30'); }
  $add('2027-02-19', '', '', 'Shivaji Jayanti · the dhol pathak across the lake', 'dhol', '17:00');
  usort($out, fn($x,$y)=>strcmp($x['date'].$x['time'], $y['date'].$y['time']));
  return $out;
}
/* Logo panel on the public timetable: everyone involved (curators, venues, partners) and sponsors (shown beside the APPA logo). */
const LOGO_GROUPS = ['curator','venue','partner','sponsor'];
function default_logos() {
  $l = []; $i = 0;
  foreach (['KRUNK','Bandish Project','Vani','National Permit','Animela','Wench Film Festival'] as $nm) $l[] = ['id'=>'c'.(++$i),'name'=>$nm,'group'=>'curator','img'=>'','url'=>''];
  foreach ([['Calmshet','https://calmshet.com'],['Purrom','https://purrom.com'],['The Company Theatre','https://thecompanytheatre.net'],['Theeya Creation Village',''],['Le Farm','https://lefarm.in'],['Shambhala by the Lake','https://shambalabythelake.com']] as [$nm,$u])
    $l[] = ['id'=>'v'.(++$i),'name'=>$nm,'group'=>'venue','img'=>'','url'=>$u];
  return $l;
}
/* Private sponsor pipeline: desk only, never in the public state. */
const SPONSOR_TIERS = ['Title','Chapter','Venue','Big night','Event or stage','Artist','In-kind / barter','Other'];
const SPONSOR_STATUS = ['Lead','In talks','Proposal sent','Confirmed','Paid','Not now'];
function sponsors() { $j = json_decode((string)kv_get('sponsors'), true); return is_array($j) ? $j : []; }
function logos() { $v = kv_get('logos'); if ($v === null) return default_logos(); $j = json_decode((string)$v, true); return is_array($j) ? $j : []; }
/* Confirmed festival bookings this device holds tickets for, plus their venue stamps */
function passport_data($tickets) {
  db()->exec('CREATE TABLE IF NOT EXISTS fest_stamps (ref VARCHAR(16) NOT NULL, spot VARCHAR(20) NOT NULL, at BIGINT NOT NULL)');
  $bs = []; $pending = 0;
  foreach (array_slice((array)$tickets, 0, 30) as $t) {
    $st = db()->prepare('SELECT ref,token,status,tier,items,guest FROM fest_bookings WHERE ref=?'); $st->execute([(string)($t['ref'] ?? '')]);
    $r = $st->fetch(); if (!$r || !hash_equals($r['token'], (string)($t['token'] ?? ''))) continue;
    if ($r['status'] === 'pending') { $pending++; continue; }
    if ($r['status'] !== 'confirmed' && $r['status'] !== 'part') continue;
    $g = json_decode($r['guest'], true) ?: [];
    $bs[] = ['ref'=>$r['ref'],'tier'=>$r['tier'],'name'=>$g['name'] ?? '','items'=>json_decode($r['items'], true) ?: []];
  }
  $stamps = [];
  if ($bs) {
    $refs = array_column($bs, 'ref'); $in = implode(',', array_fill(0, count($refs), '?'));
    $st = db()->prepare("SELECT spot, MIN(at) at FROM fest_stamps WHERE ref IN ($in) GROUP BY spot"); $st->execute($refs);
    foreach ($st as $row) $stamps[$row['spot']] = (int)$row['at'];
  }
  return ['bookings'=>$bs,'pending'=>$pending,'stamps'=>(object)$stamps];
}

/* the public catalogue (no owner UPI: that is shown only on a booking that pays it) */
function public_units() { $o = []; foreach (units() as $id => $u) $o[] = ['id'=>$id] + $u; return $o; }
function public_places() {
  $o = [];
  foreach (places() as $pid => $pl) { if ($pl['off']) continue;
    $o[] = ['id'=>$pid,'name'=>$pl['name'],'own'=>$pl['own'],'upiReady'=>$pl['upi'] !== '','cat'=>$pl['cat'],'area'=>$pl['area'],'web'=>$pl['web'],'blurb'=>$pl['blurb'],'desc'=>$pl['desc'],'amen'=>$pl['amen'],'photos'=>$pl['photos'],
      'rooms'=>array_values(array_map(fn($r)=>['id'=>$r['id'],'name'=>$r['name'],'count'=>$r['count'],'max'=>$r['max'],'base'=>$r['base'],'rate'=>$r['rate'],'rateWe'=>$r['rateWe'],'extra'=>$r['extra'],'extraWe'=>$r['extraWe'],'fest'=>$r['fest'],'festBlock'=>$r['festBlock'],'cs'=>$r['cs']], $pl['rooms']))]; }
  return $o;
}
function pay_of($r) { $p = json_decode((string)($r['pay'] ?? ''), true); return is_array($p) ? $p : null; }
/* the guest sends the UPI reference of a payment made straight to an owner */
function utr_host($t, $ref, $pay, $place, $utr) {
  if (!$pay) fail('This booking is paid in one step.');
  $hit = false; foreach ($pay['hosts'] as &$h) if ($h['place'] === $place) { $h['utr'] = $utr; $hit = true; } unset($h);
  if (!$hit) fail('That owner is not part of this booking.');
  db()->prepare("UPDATE $t SET pay=? WHERE ref=?")->execute([json_encode($pay), $ref]);
  notify(settings()['contact'], 'Owner payment reference for '.$ref, ['Room money paid to '.$place.': UPI reference '.$utr, 'Check with the owner, then tick it as received in the desk.']);
}
/* after step 1 is confirmed: 'part' until every owner has been paid, then 'confirmed' */
function after_step1($pay) { foreach ($pay['hosts'] ?? [] as $h) if (empty($h['paid'])) return 'part'; return 'confirmed'; }

/* ---------- photos from a place's own website (desk only) ----------
   The server fetches the venue's own web page, finds its photos and keeps copies in uploads/, so listings don't
   depend on the venue's site staying up. Public http(s) addresses only; size and count are capped. */
function public_host($host) {
  if (!preg_match('/^[a-z0-9.-]{1,253}$/i', $host)) return false;
  $ips = @gethostbynamel($host); if (!$ips) return false;
  foreach ($ips as $ip) if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
  return true;
}
function web_get($url, $max) {
  for ($hop = 0; $hop < 4; $hop++) {
    $u = parse_url($url);
    if (!$u || !in_array(strtolower($u['scheme'] ?? ''), ['http','https'], true) || empty($u['host']) || !public_host($u['host'])) return [null, ''];
    $ch = curl_init($url); $buf = '';
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>false, CURLOPT_FOLLOWLOCATION=>false, CURLOPT_TIMEOUT=>20, CURLOPT_CONNECTTIMEOUT=>8,
      CURLOPT_USERAGENT=>'Mozilla/5.0 (compatible; CalmShadeBot/1.0; +https://calmshade.in)', CURLOPT_HEADER=>false,
      CURLOPT_PROTOCOLS=>CURLPROTO_HTTP|CURLPROTO_HTTPS,
      CURLOPT_WRITEFUNCTION=>function ($c, $d) use (&$buf, $max) { $buf .= $d; return strlen($buf) > $max ? 0 : strlen($d); }]);
    curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $loc = (string)curl_getinfo($ch, CURLINFO_REDIRECT_URL); $type = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE); curl_close($ch);
    if ($code >= 300 && $code < 400 && $loc) { $url = $loc; continue; }
    return [$code === 200 && strlen($buf) <= $max ? $buf : null, $type];
  }
  return [null, ''];
}
function abs_url($base, $rel) {
  $rel = trim(html_entity_decode($rel, ENT_QUOTES)); if ($rel === '' || strpos($rel, 'data:') === 0) return '';
  if (preg_match('#^https?://#i', $rel)) return $rel;
  $b = parse_url($base); if (!$b || empty($b['host'])) return '';
  $root = ($b['scheme'] ?? 'https').'://'.$b['host'].(isset($b['port']) ? ':'.$b['port'] : '');
  if (strpos($rel, '//') === 0) return ($b['scheme'] ?? 'https').':'.$rel;
  if ($rel[0] === '/') return $root.$rel;
  $dir = preg_replace('#/[^/]*$#', '/', $b['path'] ?? '/'); return $root.$dir.$rel;
}
/* image addresses on a page, best first: the share image, then large photos in the page (logos and icons skipped) */
function page_images($url) {
  [$html] = web_get($url, 3 * 1024 * 1024); if (!$html) return [];
  $found = [];
  if (preg_match_all('#<meta[^>]+(?:property|name)=["\'](?:og:image|og:image:url|twitter:image)["\'][^>]*content=["\']([^"\']+)#i', $html, $m)) foreach ($m[1] as $x) $found[] = $x;
  if (preg_match_all('#<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\'](?:og:image|twitter:image)["\']#i', $html, $m)) foreach ($m[1] as $x) $found[] = $x;
  if (preg_match_all('#<img[^>]+>#i', $html, $m)) foreach ($m[0] as $tag) {
    if (preg_match('#\s(?:data-src|data-lazy-src|src)=["\']([^"\']+)#i', $tag, $a)) $found[] = $a[1];
    if (preg_match('#\ssrcset=["\']([^"\']+)#i', $tag, $a)) { $parts = array_map('trim', explode(',', $a[1])); $last = end($parts); if ($last) $found[] = preg_split('/\s+/', $last)[0]; }
  }
  if (preg_match_all('#url\(["\']?([^"\')]+\.(?:jpe?g|png|webp)[^"\')]*)#i', $html, $m)) foreach ($m[1] as $x) $found[] = $x;
  $out = [];
  foreach ($found as $x) { $a = abs_url($url, $x); if (!$a || preg_match('#(logo|icon|favicon|sprite|avatar|placeholder|blank|pixel|\.svg|\.gif)#i', $a)) continue; $out[$a] = 1; }
  return array_slice(array_keys($out), 0, 40);
}
function save_image($bin, $minW = 500, $minH = 300) {
  $info = $bin ? @getimagesizefromstring($bin) : false;
  $ext = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$info['mime'] ?? ''] ?? null;
  if (!$info || !$ext || $info[0] < $minW || $info[1] < $minH || $info[0] > 8000 || $info[1] > 8000) return null;
  $dir = __DIR__.'/uploads/'.gmdate('Ym'); if (!is_dir($dir)) @mkdir($dir, 0755, true);
  $root = __DIR__.'/uploads/.htaccess';
  if (!is_file($root)) @file_put_contents($root, "Options -Indexes -ExecCGI\nRemoveHandler .php .phtml .phar .php5 .php7 .cgi .pl\nRemoveType .php .phtml .phar\n<FilesMatch \"\\.(php|phtml|phar|php5|php7|cgi|pl|htaccess)$\">\n  Require all denied\n</FilesMatch>\n<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n");
  $name = bin2hex(random_bytes(12)).'.'.$ext;
  return @file_put_contents($dir.'/'.$name, $bin) === false ? null : 'uploads/'.gmdate('Ym').'/'.$name;
}

/* ---------- routes ---------- */
$a = $_GET['a'] ?? 'state';
$m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($m !== 'GET' && $m !== 'POST') fail('Method not allowed', 405);

try {
switch ($a) {
  case 'state':
    out(['ok'=>true,'settings'=>settings(),'listings'=>public_listings(),'occ'=>(object)occupancy(),'now'=>time(),
         'store'=>is_mysql() ? 'mysql' : 'sqlite','deskReady'=>defined('FEST_ADMIN_KEY') && strlen(FEST_ADMIN_KEY) >= 12,'aiReady'=>ai_key() !== '','schedule'=>schedule(),'logos'=>logos(),'adv'=>ADV,'advOcc'=>(object)adv_occ(),
         'units'=>public_units(),'places'=>public_places(),'tentSpots'=>TENT_SPOTS,'feePct'=>FEE_PCT,'extras'=>array_values(array_filter(extras_def(), fn($x)=>!empty($x['on'])))]);

  case 'book': {
    if ($m !== 'POST') fail('Use POST');
    $b = body(); $g = $b['guest'] ?? [];
    $name = clean($g['name'] ?? '', 80); $phone = preg_replace('/[^\d+]/', '', (string)($g['phone'] ?? '')); $email = clean($g['email'] ?? '', 120); $note = clean($g['note'] ?? '', 300);
    if ($name === '') fail('Add your name.');
    if (strlen(preg_replace('/\D/', '', $phone)) < 10) fail('Add a 10-digit phone number.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('That email address looks wrong.');
    throttle('book', 10, 86400, 'Too many bookings from this device today. Message us on WhatsApp and we will help.');
    $S0 = settings(); $mineOpen = 0;
    foreach (db()->query("SELECT status, created_at, guest, items FROM fest_bookings WHERE status='pending'") as $r)
      if (has_hold($r['items']) && active_booking($r, $S0) && digits((json_decode($r['guest'], true) ?: [])['phone'] ?? '') === digits($phone)) $mineOpen++;
    if ($mineOpen >= 3) fail('You already have 3 unpaid bookings on hold. Pay or cancel one of them first.', 429);
    lock_start(); $ok = false;
    try {
      [$q, $err] = quote($b['stays'] ?? [], $b['passes'] ?? [], occupancy(), $b['advs'] ?? [], $b['extras'] ?? []);
      if ($err) { lock_end(false); out(['error'=>$err[0],'errors'=>$err], 409); }
      if (isset($b['expectTotal']) && (int)$b['expectTotal'] !== $q['total']) { lock_end(false); out(['error'=>'Prices changed while you were booking. Your trip now costs ₹'.number_format($q['total']).'. Review it and book again.','priceChanged'=>true], 409); }
      do { $ref = new_ref(); $st = db()->prepare('SELECT 1 FROM fest_bookings WHERE ref=?'); $st->execute([$ref]); } while ($st->fetch());
      $token = bin2hex(random_bytes(16)); $now = time();
      db()->prepare('INSERT INTO fest_bookings (ref,token,status,created_at,tier,total,payout,items,guest,pay) VALUES (?,?,?,?,?,?,?,?,?,?)')
        ->execute([$ref,$token,'pending',$now,$q['tier'],$q['total'],$q['payout'],json_encode($q['items']),json_encode(['name'=>$name,'phone'=>$phone,'email'=>$email,'note'=>$note,'discount'=>$q['discount']]),json_encode($q['pay'])]);
      $ok = true; lock_end(true);
    } catch (Throwable $e) { if (!$ok) lock_end(false); throw $e; }
    $S = settings(); $until = gmdate('j M, H:i', $now + $S['holdHours']*3600 + 19800).' IST';
    $body = array_merge(['Booking '.$ref.' — '.$name.', '.$phone.($email ? ', '.$email : ''), ''], trip_lines($q['items']),
      [$q['discount'] ? strtoupper($q['tier']).' discount: −'.inr($q['discount']) : '', 'Total: '.inr($q['total']), 'Held until '.$until, $note ? 'Note: '.$note : ''], pay_lines($q['pay'], settings(), $ref));
    $passOnly = !has_hold($q['items']); $what = has_stay($q['items']) ? 'rooms are' : 'adventure slots are';
    if ($passOnly) $body = array_values(array_filter($body, fn($l)=>strpos($l, 'Held until') !== 0));
    notify($S['contact'], ($passOnly ? 'New day-pass order ' : 'New festival booking ').$ref.' · '.inr($q['total']), $body);
    if ($email) notify($email, ($passOnly ? 'Your APPA Art Fest day passes · ' : 'Your APPA Art Fest '.$what.' held · ').$ref, array_merge(['Hi '.$name.',', '', $passOnly
        ? 'Pay '.inr($q['total']).' by UPI to '.$S['upi'].' ('.$S['payee'].') with '.$ref.' in the note, then send us the UPI reference on the booking page. Your ticket is confirmed as soon as the payment arrives.'
        : ($q['pay']['hosts'] ? 'Your '.$what.' held until '.$until.'. You pay in two steps, shown below. Send each UPI reference on the booking page.' : 'Your '.$what.' held until '.$until.'. Pay '.inr($q['total']).' by UPI to '.$S['upi'].' ('.$S['payee'].') with '.$ref.' in the note, then send us the UPI reference on the booking page.'), ''], trip_lines($q['items']), pay_lines($q['pay'], $S, $ref), ['', 'Questions: '.$S['contact'].' or WhatsApp +91 87999 38193', '— APPA Art Fest 2027']));
    out(['ok'=>true,'ref'=>$ref,'token'=>$token,'total'=>$q['total'],'tier'=>$q['tier'],'createdAt'=>$now,'holdUntil'=>$now + $S['holdHours']*3600,'passOnly'=>$passOnly,'pay'=>$q['pay']]);
  }

  case 'quote': {
    $b = body(); [$q, $err] = quote($b['stays'] ?? [], $b['passes'] ?? [], occupancy(), $b['advs'] ?? [], $b['extras'] ?? []);
    out(['ok'=>!$err,'quote'=>$q,'errors'=>$err]);
  }

  case 'find': {
    if ($m !== 'POST') fail('Use POST');
    throttle('find', 20, 3600, 'Too many lookups. Try again in an hour.');
    $b = body(); $ref = strtoupper(clean($b['ref'] ?? '', 16)); $ph = digits($b['phone'] ?? '');
    $st = db()->prepare('SELECT ref, token, guest FROM fest_bookings WHERE ref=?'); $st->execute([$ref]); $r = $st->fetch();
    if (!$r || strlen($ph) < 10 || digits((json_decode($r['guest'], true) ?: [])['phone'] ?? '') !== $ph) { usleep(300000); fail('No booking matches that reference and phone number.', 404); }
    out(['ok'=>true,'ref'=>$r['ref'],'token'=>$r['token']]);
  }

  case 'mine': {
    $b = body(); $res = []; $S = settings();
    foreach (array_slice((array)($b['tickets'] ?? []), 0, 30) as $t) {
      $st = db()->prepare('SELECT ref,token,status,created_at,tier,total,items,utr,guest,pay FROM fest_bookings WHERE ref=?'); $st->execute([(string)($t['ref'] ?? '')]);
      $r = $st->fetch(); if (!$r || !hash_equals($r['token'], (string)($t['token'] ?? ''))) continue;
      $status = show_status($r, $S);
      $res[] = ['ref'=>$r['ref'],'status'=>$status,'name'=>(json_decode($r['guest'], true) ?: [])['name'] ?? '','passOnly'=>!has_hold($r['items']),'tier'=>$r['tier'],'total'=>(int)$r['total'],'createdAt'=>(int)$r['created_at'],'holdUntil'=>(int)$r['created_at'] + $S['holdHours']*3600,'items'=>json_decode($r['items'], true),'utrSent'=>!empty($r['utr']),'pay'=>pay_of($r)];
    }
    out(['ok'=>true,'bookings'=>$res]);
  }

  case 'utr': case 'cancel': {
    if ($m !== 'POST') fail('Use POST');
    $b = body(); $st = db()->prepare('SELECT token,status,pay FROM fest_bookings WHERE ref=?'); $st->execute([(string)($b['ref'] ?? '')]);
    $r = $st->fetch(); if (!$r || !hash_equals($r['token'], (string)($b['token'] ?? ''))) fail('Booking not found.', 404);
    if ($a === 'utr') {
      $utr = clean($b['utr'] ?? '', 200); if (strlen(preg_replace('/\W/', '', $utr)) < 6) fail('That reference number looks short. UPI references are usually 12 digits.');
      if ($r['status'] === 'cancelled') fail('This booking was cancelled. Message us on WhatsApp if you have already paid.');
      if (!empty($b['place'])) { utr_host('fest_bookings', (string)$b['ref'], pay_of($r), (string)$b['place'], $utr); out(['ok'=>true]); }
      db()->prepare('UPDATE fest_bookings SET utr=? WHERE ref=?')->execute([$utr, $b['ref']]);
      notify(settings()['contact'], 'Payment reference for '.$b['ref'], ['UPI reference: '.$utr, 'Check it and confirm the booking in the APPA Fest desk.']);
    } else {
      if ($r['status'] === 'cancelled') out(['ok'=>true]);
      if ($r['status'] !== 'pending') fail('Paid bookings can only be changed by the festival team. Message us on WhatsApp.');
      db()->prepare("UPDATE fest_bookings SET status='cancelled' WHERE ref=?")->execute([$b['ref']]);
    }
    out(['ok'=>true]);
  }

  case 'list': {
    if ($m !== 'POST') fail('Use POST');
    $b = body(); $p = $b['property'] ?? []; $c = $b['contact'] ?? [];
    $p += ['yearRound'=>true];
    $d = listing_fields($p, ['rooms'=>1,'maxGuests'=>2,'rate'=>500,'yearRound'=>true,'cat'=>'room']);
    if (empty($d['sleeps'])) $d['sleeps'] = $d['rooms'] * $d['maxGuests'];
    if (empty($d['ppWith'])) $d['ppWith'] = max(100, (int)round($d['rate'] / 2));
    if (empty($d['ppWithout'])) $d['ppWithout'] = $d['ppWith'];
    $ct = ['name'=>clean($c['name'] ?? '', 80),'phone'=>clean($c['phone'] ?? '', 20),'email'=>clean($c['email'] ?? '', 120)];
    if ($d['name'] === '' || $d['location'] === '' || $ct['name'] === '' || strlen(preg_replace('/\D/', '', $ct['phone'])) < 10) fail('Fill in the property name, area, your name and a 10-digit phone number.');
    $n = (int)db()->query("SELECT COUNT(*) c FROM fest_listings WHERE status='pending'")->fetch()['c'];
    if ($n > 300) fail('We have a lot of applications right now. Write to the festival team instead.', 429);
    throttle('list', 5, 86400, 'Too many applications from this device today. Write to the festival team instead.');
    $id = strtoupper(bin2hex(random_bytes(4)));
    db()->prepare('INSERT INTO fest_listings (id,created_at,status,data,contact) VALUES (?,?,?,?,?)')->execute([$id,time(),'pending',json_encode($d),json_encode($ct)]);
    notify(settings()['contact'], 'New partner stay application: '.$d['name'], [$d['name'].' ('.$d['type'].'), '.$d['location'], $d['rooms'].' rooms × '.$d['maxGuests'].' adults at '.inr($d['rate']).' a night', 'All year on Calm Shade: '.(!empty($d['yearRound']) ? 'yes' : 'no').' · photos: '.count($d['photos'] ?? []), $d['maps'] ? 'Map: '.$d['maps'] : '', $d['website'] ? 'Website: '.$d['website'] : '', 'Contact: '.$ct['name'].', '.$ct['phone'].' '.$ct['email'], '', 'Approve & enroll it in the APPA Fest desk.']);
    out(['ok'=>true,'id'=>$id]);
  }

  /* ---- festival desk (admin) ---- */
  case 'admin': {
    need_admin(); $S = settings();
    $bs = [];
    foreach (db()->query('SELECT * FROM fest_bookings ORDER BY created_at DESC') as $r) {
      $status = show_status($r, $S);
      $bs[] = ['ref'=>$r['ref'],'status'=>$status,'passOnly'=>!has_hold($r['items']),'createdAt'=>(int)$r['created_at'],'tier'=>$r['tier'],'total'=>(int)$r['total'],'payout'=>(int)$r['payout'],'items'=>json_decode($r['items'], true),'guest'=>json_decode($r['guest'], true),'utr'=>$r['utr'],'pay'=>pay_of($r)];
    }
    $ls = array_map(fn($l)=>['id'=>$l['id'],'status'=>$l['status'],'createdAt'=>(int)$l['created_at'],'data'=>json_decode($l['data'], true),'contact'=>json_decode($l['contact'], true)], listings_all());
    out(['ok'=>true,'bookings'=>$bs,'listings'=>$ls,'store'=>is_mysql() ? 'mysql' : 'sqlite','sponsors'=>sponsors()]);
  }
  case 'status': {
    need_admin(); $b = body(); $s = (string)($b['status'] ?? '');
    if (!in_array($s, ['confirmed','cancelled','pending'], true)) fail('Unknown status');
    $ref = (string)($b['ref'] ?? ''); $S = settings();
    $st = db()->prepare('SELECT * FROM fest_bookings WHERE ref=?'); $st->execute([$ref]); $r = $st->fetch();
    if (!$r) fail('Booking not found.', 404);
    lock_start(); $ok = false;
    try {
      if ($s !== 'cancelled' && !active_booking($r, $S)) {
        /* reviving an expired or cancelled booking: its rooms may have gone to someone else */
        $occ = occupancy(); $U = units(); $clash = [];
        foreach (json_decode($r['items'], true) ?: [] as $it) if ($it['kind'] === 'stay') foreach ($it['nights'] as $d) {
          $cap = $U[$it['unit']]['rooms'] ?? 0;
          if (($occ[$it['unit']][$d] ?? 0) + $it['rooms'] > $cap) $clash[] = $it['name'].' on '.gmdate('j M', strtotime($d));
        }
        if ($clash) { lock_end(false); fail('Those rooms were taken after this hold expired: '.implode(', ', array_slice(array_unique($clash), 0, 4)).'. Refund the guest or move them.', 409); }
      }
      $created = ($s === 'pending') ? time() : (int)$r['created_at'];
      if ($s === 'confirmed' && ($pay = pay_of($r))) $s = after_step1($pay);
      db()->prepare('UPDATE fest_bookings SET status=?, created_at=? WHERE ref=?')->execute([$s, $created, $ref]);
      $ok = true; lock_end(true);
    } catch (Throwable $e) { if (!$ok) lock_end(false); throw $e; }
    $g = json_decode($r['guest'], true) ?: [];
    if ($s === 'part') notify($g['email'] ?? '', 'Step 1 received · APPA Art Fest booking '.$ref, array_merge(['Hi '.($g['name'] ?? '').',', '', 'We have your first payment, so your booking is held for you. Now pay the room money straight to the owner(s), then send the UPI reference on the booking page (calmshade.in/#appa).'], pay_lines(pay_of($r), $S, $ref), ['', '— APPA Art Fest 2027']));
    if ($s === 'confirmed') notify($g['email'] ?? '', 'Confirmed: your APPA Art Fest booking '.$ref, array_merge(['Hi '.($g['name'] ?? '').',', '', 'Payment received — your booking is confirmed. Your ticket and your APPA Art Passport (map, itinerary and venue stamps) are ready at calmshade.in/#passport on the phone you booked with. Show the ticket, or just say '.$ref.', at the festival gate. See you at the lake.', ''], trip_lines(json_decode($r['items'], true) ?: []), ['', '— APPA Art Fest 2027']));
    if ($s === 'cancelled') notify($g['email'] ?? '', 'Cancelled: APPA Art Fest booking '.$ref, ['Hi '.($g['name'] ?? '').',', '', 'Booking '.$ref.' has been cancelled and its rooms released. If you already paid, reply to this email and we will sort out the refund.', '', '— APPA Art Fest 2027']);
    out(['ok'=>true,'status'=>$s]);
  }
  /* desk: an owner says the guest's room money arrived (step 2) */
  case 'host_paid': {
    need_admin(); $b = body(); $t = ($b['table'] ?? '') === 'cs' ? 'cs_bookings' : 'fest_bookings';
    $r = find_booking($t, $b['ref'] ?? ''); if (!$r) fail('Booking not found.', 404);
    $pay = pay_of($r); if (!$pay) fail('This booking is paid in one step.');
    $hit = false; foreach ($pay['hosts'] as &$h) if ($h['place'] === ($b['place'] ?? '')) { $h['paid'] = !empty($b['paid']); $hit = true; } unset($h);
    if (!$hit) fail('That owner is not part of this booking.');
    $st = $r['status'];
    if (in_array($st, ['part','confirmed'], true)) $st = after_step1($pay);
    db()->prepare("UPDATE $t SET pay=?, status=? WHERE ref=?")->execute([json_encode($pay), $st, $r['ref']]);
    $g = json_decode($r['guest'], true) ?: [];
    if ($st === 'confirmed' && $r['status'] !== 'confirmed') notify($g['email'] ?? '', 'Confirmed: your booking '.$r['ref'], array_merge(['Hi '.($g['name'] ?? '').',', '', 'Both payments are in: your booking is confirmed.'.($t === 'fest_bookings' ? ' Your ticket and APPA Art Passport are at calmshade.in/#passport on the phone you booked with.' : ''), ''], $t === 'fest_bookings' ? trip_lines(json_decode($r['items'], true) ?: []) : cs_lines(json_decode($r['items'], true) ?: []), ['', '— Calm Shade × APPA Art Fest']));
    out(['ok'=>true,'status'=>$st,'pay'=>$pay]);
  }
  /* desk: places & rooms — owner UPI, room counts and prices, photos, words */
  case 'places_admin': {
    need_admin(); $o = [];
    foreach (places() as $pid => $pl) $o[] = $pl + ['rooms_list'=>array_values($pl['rooms'])];
    out(['ok'=>true,'places'=>$o,'extras'=>extras_def()]);
  }
  case 'places_set': {
    need_admin(); $b = body(); $pid = (string)($b['id'] ?? ''); if (!isset(PLACES[$pid])) fail('Unknown place.', 404);
    $in = (array)($b['place'] ?? []); $all = places_over(); $o = $all[$pid] ?? [];
    foreach (['area'=>120,'desc'=>1500,'amen'=>300,'owner'=>80,'payee'=>80] as $k => $n) if (array_key_exists($k, $in)) $o[$k] = clean($in[$k], $n);
    if (array_key_exists('upi', $in)) { $u = trim((string)$in['upi']); if ($u !== '' && !preg_match('/^[a-zA-Z0-9.\-_]{2,60}@[a-zA-Z0-9.\-]{2,40}$/', $u)) fail('That UPI ID looks wrong. It looks like name@bank.'); $o['upi'] = $u; }
    if (array_key_exists('off', $in)) $o['off'] = !empty($in['off']);
    if (array_key_exists('photos', $in)) { $ph = []; foreach (array_slice((array)$in['photos'], 0, 12) as $x) { $src = clean_photo(is_array($x) ? ($x['src'] ?? '') : $x); if ($src) $ph[] = ['src'=>$src,'cap'=>clean(is_array($x) ? ($x['cap'] ?? '') : '', 120),'from'=>clean_url(is_array($x) ? ($x['from'] ?? '') : '')]; } $o['photos'] = $ph; }
    foreach ((array)($in['rooms'] ?? []) as $rid => $r) { if (!isset(PLACES[$pid]['rooms'][$rid])) continue; $ro = $o['rooms'][$rid] ?? [];
      if (isset($r['name']) && clean($r['name'], 60) !== '') $ro['name'] = clean($r['name'], 60);
      foreach (['count'=>[0,200],'max'=>[1,30],'rate'=>[0,500000],'rateWe'=>[0,500000],'extra'=>[0,100000],'extraWe'=>[0,100000]] as $k => [$lo, $hi]) if (isset($r[$k]) && $r[$k] !== '') $ro[$k] = max($lo, min($hi, (int)$r[$k]));
      $o['rooms'][$rid] = $ro; }
    $all[$pid] = $o; kv_set('places', json_encode($all));
    out(['ok'=>true]);
  }
  /* desk: fetch photos for a place from its own website, or from photo links pasted in the desk */
  case 'places_import': {
    need_admin(); @set_time_limit(120); $b = body(); $pid = (string)($b['id'] ?? ''); if (!isset(PLACES[$pid])) fail('Unknown place.', 404);
    $pl = places()[$pid]; $links = array_values(array_filter(array_map('trim', (array)($b['links'] ?? [])), fn($x)=>preg_match('#^https?://#i', $x)));
    $page = clean_url($b['url'] ?? '') ?: $pl['web'];
    $cands = []; $direct = [];
    foreach (array_slice($links, 0, 12) as $l) { if (preg_match('#\.(jpe?g|png|webp)(\?|$)#i', $l)) $direct[] = $l; else $cands = array_merge($cands, page_images($l)); }
    if (!$links) { if (!$page) fail('This place has no website yet. Paste photo links, or add photos from your phone.'); $cands = page_images($page); }
    $cands = array_values(array_unique(array_merge($direct, $cands)));
    if (!$cands) fail('No photos found on '.($links ? 'those links' : $page).'. The site may build its photos with code we can\'t read; paste direct photo links instead, or add photos from your phone.', 404);
    $o = places_over(); $cur = $o[$pid]['photos'] ?? []; $seen = []; $added = 0; $want = max(1, min(8, (int)($b['max'] ?? 6)));
    foreach ($cands as $c) {
      if ($added >= $want || count($cur) >= 12) break;
      [$bin, $type] = web_get($c, 8 * 1024 * 1024); if (!$bin) continue;
      $h = md5($bin); if (isset($seen[$h])) continue; $seen[$h] = 1;
      $src = save_image($bin); if (!$src) continue;
      $cur[] = ['src'=>$src, 'cap'=>'', 'from'=>substr($c, 0, 300)]; $added++;
    }
    if (!$added) fail('Found '.count($cands).' pictures but none were usable photos (too small, or the site blocked us). Paste direct photo links, or add photos from your phone.', 404);
    $o[$pid]['photos'] = $cur; kv_set('places', json_encode($o));
    out(['ok'=>true,'added'=>$added,'photos'=>$cur]);
  }
  case 'extras_set': {
    need_admin(); $items = [];
    foreach (array_slice((array)(body()['items'] ?? []), 0, 30) as $x) { $nm = clean($x['name'] ?? '', 90); if ($nm === '') continue;
      $items[] = ['id'=>preg_replace('/[^a-z0-9]/i', '', (string)($x['id'] ?? '')) ?: bin2hex(random_bytes(4)),'name'=>$nm,'price'=>max(0, min(200000, (int)($x['price'] ?? 0))),'on'=>!empty($x['on'])]; }
    kv_set('extras', json_encode($items)); out(['ok'=>true,'extras'=>$items]);
  }
  case 'approve': {
    need_admin(); $b = body(); $s = (string)($b['status'] ?? '');
    if (!in_array($s, ['approved','rejected','pending'], true)) fail('Unknown status');
    $lid = (string)($b['id'] ?? ''); $st = db()->prepare('SELECT * FROM fest_listings WHERE id=?'); $st->execute([$lid]); $l = $st->fetch();
    if (!$l) fail('Listing not found.', 404);
    db()->prepare('UPDATE fest_listings SET status=? WHERE id=?')->execute([$s, $lid]);
    if ($s !== 'approved') out(['ok'=>true]);
    $c = json_decode($l['contact'], true) ?: []; $h = host_for_listing($lid); $fresh = !$h;
    if (!$h) { $hid = strtoupper(bin2hex(random_bytes(4)));
      db()->prepare('INSERT INTO cs_hosts (id,listing_id,name,phone,email,created_at) VALUES (?,?,?,?,?,?)')->execute([$hid, $lid, $c['name'] ?? '', $c['phone'] ?? '', $c['email'] ?? '', time()]);
      $h = host_for_listing($lid); }
    $key = ($fresh || !empty($b['newLink'])) ? host_new_key($h['id']) : null;
    $d = json_decode($l['data'], true) ?: [];
    if ($key && !empty($c['email'])) notify($c['email'], 'Welcome to Calm Shade · '.($d['name'] ?? ''), ['Hi '.($c['name'] ?? '').',', '', ($d['name'] ?? 'Your stay').' is now live for APPA Art Fest 2027'.(!empty($d['yearRound']) ? ' and on Calm Shade all year' : '').'.', '', 'Your private host link (keep it to yourself; it signs you straight in):', site_base().'?host='.$key, '', 'From there you can edit your listing and photos, and confirm bookings as they come in. You keep your full price on every booking: guests pay a 3% Calm Shade fee on top.', '', '— Calm Shade × APPA Art Fest']);
    out(['ok'=>true,'enrolled'=>$fresh,'hostKey'=>$key,'hostPhone'=>$c['phone'] ?? '','hostName'=>$c['name'] ?? '','link'=>$key ? site_base().'?host='.$key : null]);
  }
  case 'settings': {
    need_admin(); $b = body(); $in = (array)($b['settings'] ?? []); $s = [];
    foreach (DEF as $k => $v) if (array_key_exists($k, $in)) $s[$k] = is_int($v) ? max(0, (int)$in[$k]) : clean($in[$k], 120);
    foreach (['firstNight','lastNight','passLast'] as $k) if (isset($s[$k]) && !valid_date($s[$k])) fail($k.' must be a date like 2027-02-12');
    $v = json_encode(array_merge(settings(), $s));
    db()->prepare('DELETE FROM fest_kv WHERE k=?')->execute(['settings']);
    db()->prepare('INSERT INTO fest_kv (k,v) VALUES (?,?)')->execute(['settings', $v]);
    out(['ok'=>true,'settings'=>json_decode($v, true)]);
  }

  /* ---- Calm Shade homestays ---- */
  case 'cs_state':
    out(['ok'=>true,'occ'=>(object)cs_occ(),'today'=>ist_today(),'holdHours'=>settings()['holdHours'],'ai'=>ai_key()!=='','fest'=>['from'=>settings()['firstNight'],'to'=>settings()['lastNight']]]);

  case 'cs_book': {
    if ($m !== 'POST') fail('Use POST');
    cs_init(); $b = body(); $g = $b['guest'] ?? [];
    $name = clean($g['name'] ?? '', 80); $phone = preg_replace('/[^\d+]/', '', (string)($g['phone'] ?? '')); $email = clean($g['email'] ?? '', 120); $note = clean($g['note'] ?? '', 300);
    if ($name === '') fail('Add your name.');
    if (strlen(digits($phone)) < 10) fail('Add a 10-digit phone number.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('That email address looks wrong.');
    throttle('csbook', 10, 86400, 'Too many bookings from this device today. Message us on WhatsApp and we will help.');
    $S = settings(); $open = 0;
    foreach (db()->query("SELECT status, created_at, guest FROM cs_bookings WHERE status='pending'") as $r)
      if (active_booking($r, $S) && digits((json_decode($r['guest'], true) ?: [])['phone'] ?? '') === digits($phone)) $open++;
    if ($open >= 3) fail('You already have 3 unpaid holds. Pay or cancel one of them first.', 429);
    lock_start(); $ok = false;
    try {
      [$q, $err] = cs_quote($b['legs'] ?? [], cs_occ());
      if ($err) { lock_end(false); out(['error'=>$err[0],'errors'=>$err], 409); }
      if (isset($b['expectTotal']) && (int)$b['expectTotal'] !== $q['total']) { lock_end(false); out(['error'=>'The price for these nights is '.inr($q['total']).'. Tap hold again to book at that price.','priceChanged'=>true,'total'=>$q['total']], 409); }
      do { $ref = 'CS-'.substr(new_ref(), 5); } while (find_booking('cs_bookings', $ref));
      $token = bin2hex(random_bytes(16)); $now = time();
      db()->prepare('INSERT INTO cs_bookings (ref,token,status,created_at,total,payout,items,guest,pay) VALUES (?,?,?,?,?,?,?,?,?)')
        ->execute([$ref,$token,'pending',$now,$q['total'],$q['payout'],json_encode($q['items']),json_encode(['name'=>$name,'phone'=>$phone,'email'=>$email,'note'=>$note,'via'=>clean($b['via'] ?? 'site', 20)]),json_encode($q['pay'])]);
      $ok = true; lock_end(true);
    } catch (Throwable $e) { if (!$ok) lock_end(false); throw $e; }
    $until = gmdate('j M, H:i', $now + $S['holdHours']*3600 + 19800).' IST';
    notify($S['contact'], 'New Calm Shade booking '.$ref.' · '.inr($q['total']), array_merge(['Booking '.$ref.' — '.$name.', '.$phone.($email ? ', '.$email : ''), ''], cs_lines($q['items']), ['Total: '.inr($q['total']), 'Held until '.$until, $note ? 'Note: '.$note : ''], pay_lines($q['pay'], $S, $ref)));
    if ($email) notify($email, 'Your Calm Shade nights are held · '.$ref, array_merge(['Hi '.$name.',', '', $q['pay']['hosts'] ? 'Your nights are held until '.$until.'. You pay in two steps, shown below.' : 'Your nights are held until '.$until.'. Pay '.inr($q['total']).' by UPI to '.$S['upi'].' with '.$ref.' in the note, then send us the UPI reference.', ''], cs_lines($q['items']), pay_lines($q['pay'], $S, $ref), ['', 'WhatsApp: +91 87999 38193', '— Calm Shade']));
    out(['ok'=>true,'ref'=>$ref,'token'=>$token,'total'=>$q['total'],'holdUntil'=>$now + $S['holdHours']*3600,'pay'=>$q['pay']]);
  }

  case 'cs_mine': {
    cs_init(); $b = body(); $S = settings(); $res = [];
    foreach (array_slice((array)($b['tickets'] ?? []), 0, 30) as $t) {
      $r = find_booking('cs_bookings', $t['ref'] ?? ''); if (!$r || !hash_equals($r['token'], (string)($t['token'] ?? ''))) continue;
      $res[] = ['ref'=>$r['ref'],'status'=>($r['status']==='pending' && !active_booking($r,$S)) ? 'expired' : $r['status'],'total'=>(int)$r['total'],'items'=>json_decode($r['items'], true),'holdUntil'=>(int)$r['created_at'] + $S['holdHours']*3600,'utrSent'=>!empty($r['utr']),'pay'=>pay_of($r)];
    }
    out(['ok'=>true,'bookings'=>$res]);
  }

  case 'cs_utr': case 'cs_cancel': {
    if ($m !== 'POST') fail('Use POST');
    cs_init(); $b = body(); $r = find_booking('cs_bookings', $b['ref'] ?? '');
    if (!$r || !hash_equals($r['token'], (string)($b['token'] ?? ''))) fail('Booking not found.', 404);
    if ($a === 'cs_utr') {
      $utr = clean($b['utr'] ?? '', 200); if (strlen(preg_replace('/\W/', '', $utr)) < 6) fail('That reference number looks short. UPI references are usually 12 digits.');
      if ($r['status'] === 'cancelled') fail('This booking was cancelled. Message us on WhatsApp if you have already paid.');
      if (!empty($b['place'])) { utr_host('cs_bookings', $r['ref'], pay_of($r), (string)$b['place'], $utr); out(['ok'=>true]); }
      db()->prepare('UPDATE cs_bookings SET utr=? WHERE ref=?')->execute([$utr, $r['ref']]);
      notify(settings()['contact'], 'Payment reference for '.$r['ref'], ['UPI reference: '.$utr]);
    } else {
      if ($r['status'] === 'cancelled') out(['ok'=>true]);
      if ($r['status'] !== 'pending') fail('Paid bookings can only be changed by your host. Message us on WhatsApp.');
      db()->prepare("UPDATE cs_bookings SET status='cancelled' WHERE ref=?")->execute([$r['ref']]);
    }
    out(['ok'=>true]);
  }

  case 'cs_admin': {
    need_admin(); cs_init(); $S = settings(); $bs = [];
    foreach (db()->query('SELECT * FROM cs_bookings ORDER BY created_at DESC') as $r)
      $bs[] = ['ref'=>$r['ref'],'status'=>($r['status']==='pending' && !active_booking($r,$S)) ? 'expired' : $r['status'],'createdAt'=>(int)$r['created_at'],'total'=>(int)$r['total'],'payout'=>(int)$r['payout'],'items'=>json_decode($r['items'], true),'guest'=>json_decode($r['guest'], true),'utr'=>$r['utr'],'pay'=>pay_of($r)];
    out(['ok'=>true,'bookings'=>$bs]);
  }

  case 'cs_status': {
    need_admin(); cs_init(); $b = body(); $s = (string)($b['status'] ?? '');
    if (!in_array($s, ['confirmed','cancelled'], true)) fail('Unknown status');
    $r = find_booking('cs_bookings', $b['ref'] ?? ''); if (!$r) fail('Booking not found.', 404);
    lock_start(); $ok = false;
    try {
      if ($s === 'confirmed' && !active_booking($r, settings())) {
        $occ = cs_occ(); $clash = [];
        foreach (json_decode($r['items'], true) ?: [] as $it) foreach ($it['nights'] as $d) if (!empty($occ[$it['prop']][$d])) $clash[] = $it['name'].' on '.gmdate('j M', strtotime($d));
        if ($clash) { lock_end(false); fail('Those nights were taken after this hold lapsed: '.implode(', ', array_slice($clash, 0, 4)).'.', 409); }
      }
      if ($s === 'confirmed' && ($pay = pay_of($r))) $s = after_step1($pay);
      db()->prepare('UPDATE cs_bookings SET status=? WHERE ref=?')->execute([$s, $r['ref']]);
      $ok = true; lock_end(true);
    } catch (Throwable $e) { if (!$ok) lock_end(false); throw $e; }
    $g = json_decode($r['guest'], true) ?: [];
    if ($s === 'part') { notify($g['email'] ?? '', 'Step 1 received · Calm Shade booking '.$r['ref'], array_merge(['Hi '.($g['name'] ?? '').',', '', 'We have your first payment. Now pay the room money straight to the owner, then send the UPI reference on the booking page.'], pay_lines(pay_of($r), settings(), $r['ref']), ['', '— Calm Shade'])); out(['ok'=>true,'status'=>$s]); }
    notify($g['email'] ?? '', ($s === 'confirmed' ? 'Confirmed: ' : 'Cancelled: ').'Calm Shade booking '.$r['ref'],
      $s === 'confirmed' ? array_merge(['Hi '.($g['name'] ?? '').',', '', 'Your host has confirmed your stay.', ''], cs_lines(json_decode($r['items'], true) ?: []), ['', '— Calm Shade'])
                         : ['Hi '.($g['name'] ?? '').',', '', 'Booking '.$r['ref'].' was cancelled and its nights released. If you already paid, reply and we will arrange the refund.', '', '— Calm Shade']);
    out(['ok'=>true]);
  }

  /* ---- AI concierge: fixed model, capped size, throttled, Calm Shade prompts only ---- */
  case 'ai': {
    if ($m !== 'POST') fail('Use POST');
    $key = ai_key(); if (!$key) fail('The concierge is not switched on yet.', 503);
    $b = body(); $sys = (string)($b['system'] ?? ''); $msgs = $b['messages'] ?? null;
    if (strpos($sys, 'Calm Shade') === false || strlen($sys) > 40000 || !is_array($msgs) || !$msgs || count($msgs) > 40) fail('Not a concierge request.', 400);
    $clean = []; $chars = 0;
    foreach ($msgs as $mm) {
      $role = ($mm['role'] ?? '') === 'assistant' ? 'assistant' : 'user'; $c = is_string($mm['content'] ?? null) ? $mm['content'] : '';
      $c = function_exists('mb_substr') ? mb_substr($c, 0, 2000) : substr($c, 0, 2000); $chars += strlen($c);
      if ($c !== '') $clean[] = ['role'=>$role,'content'=>$c];
    }
    if (!$clean || end($clean)['role'] !== 'user' || $chars > 30000) fail('Not a concierge request.', 400);
    throttle('ai', 40, 3600, 'The concierge is busy. Try again in a little while, or message us on WhatsApp.');
    $day = 'ai-'.gmdate('Ymd'); $row = db()->prepare('SELECT v FROM fest_kv WHERE k=?'); $row->execute([$day]); $n = (int)(($row->fetch() ?: ['v'=>0])['v']);
    if ($n >= (defined('AI_DAILY_CAP') ? AI_DAILY_CAP : 1500)) fail('The concierge has hit today\'s limit. Message us on WhatsApp.', 429);
    db()->prepare('DELETE FROM fest_kv WHERE k=?')->execute([$day]); db()->prepare('INSERT INTO fest_kv (k,v) VALUES (?,?)')->execute([$day, (string)($n + 1)]);
    $payload = json_encode(['model'=>defined('AI_MODEL') ? AI_MODEL : 'claude-haiku-4-5-20251001','max_tokens'=>min(800, max(50, (int)($b['max_tokens'] ?? 600))),'system'=>$sys,'messages'=>$clean]);
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>$payload, CURLOPT_TIMEOUT=>45,
      CURLOPT_HTTPHEADER=>['Content-Type: application/json','anthropic-version: 2023-06-01','x-api-key: '.$key]]);
    $res = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $j = json_decode((string)$res, true);
    if ($code !== 200 || !is_array($j)) { error_log('fest ai: '.$code.' '.substr((string)$res, 0, 300)); fail('The concierge is unavailable right now.', 502); }
    out(['content'=>array_values(array_filter($j['content'] ?? [], fn($c)=>($c['type'] ?? '') === 'text'))]);
  }



  /* ---- Photo uploads (applicants, hosts, admin) ---- */
  case 'upload': {
    if ($m !== 'POST') fail('Use POST');
    $isAdmin = is_admin_req();
    $isHost = false; if (!$isAdmin && !empty($_SERVER['HTTP_X_HOST_KEY'])) { need_host(); $isHost = true; }
    if (!$isAdmin) throttle('upload', $isHost ? 60 : 16, 86400, 'Too many photos from this device today. Send the rest on WhatsApp.');
    $raw = file_get_contents('php://input', false, null, 0, 4 * 1024 * 1024 + 1) ?: '';
    if (strlen($raw) > 4 * 1024 * 1024) fail('That photo is too large. Try a smaller one.', 413);
    $j = json_decode($raw, true); $u = (string)($j['data'] ?? '');
    if (!preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#', $u, $mm)) fail('Send a JPEG, PNG or WebP photo.');
    $bin = base64_decode($mm[2], true); $info = $bin ? @getimagesizefromstring($bin) : false;
    $ext = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$info['mime'] ?? ''] ?? null;
    $minW = $isAdmin ? 40 : 200; $minH = $isAdmin ? 30 : 150; /* the desk also uploads logos, which can be small */
    if (!$info || !$ext || $info[0] < $minW || $info[1] < $minH || $info[0] > 6000 || $info[1] > 6000) fail('That file is not a usable photo.');
    $dir = __DIR__.'/uploads/'.gmdate('Ym');
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $root = __DIR__.'/uploads/.htaccess';
    if (!is_file($root)) @file_put_contents($root, "Options -Indexes -ExecCGI\nRemoveHandler .php .phtml .phar .php5 .php7 .cgi .pl\nRemoveType .php .phtml .phar\n<FilesMatch \"\\.(php|phtml|phar|php5|php7|cgi|pl|htaccess)$\">\n  Require all denied\n</FilesMatch>\n<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n");
    $name = bin2hex(random_bytes(12)).'.'.$ext;
    if (@file_put_contents($dir.'/'.$name, $bin) === false) fail('Could not save the photo. Try again.', 500);
    out(['ok'=>true,'src'=>'uploads/'.gmdate('Ym').'/'.$name,'w'=>$info[0],'h'=>$info[1]]);
  }

  /* ---- Enrolled partners as Calm Shade listings (public) ---- */
  case 'cs_props': {
    hosts_init(); $props = []; $hosts = [];
    foreach (listings_all() as $l) {
      if ($l['status'] !== 'approved') continue;
      $d = json_decode($l['data'], true) ?: []; if (empty($d['yearRound'])) continue;
      $h = host_for_listing($l['id']); if (!$h) continue;
      $props[] = cs_public_prop($l, $h); $hosts[] = ['id'=>'h'.$h['id'],'name'=>$h['name']];
    }
    /* the APPA Art Fest venues, as Calm Shade listings with their rooms (Calmshet's rooms are listings of their own) */
    foreach (public_places() as $pl) {
      if ($pl['own']) continue;
      $rooms = array_values(array_filter($pl['rooms'], fn($r)=>$r['count'] > 0));
      if (!$rooms) continue;
      $sleeps = array_sum(array_map(fn($r)=>$r['count'] * $r['max'], $rooms)); $from = min(array_map(fn($r)=>min($r['rate'], $r['rateWe']), $rooms));
      $nr = array_sum(array_column($rooms, 'count'));
      $kinds = count($rooms) > 2 ? $nr.' rooms' : implode(', ', array_map(fn($r)=>$r['count'].' '.strtolower($r['name']).($r['count'] > 1 ? 's' : ''), $rooms));
      $props[] = ['id'=>'v-'.$pl['id'],'owner'=>'v-'.$pl['id'],'name'=>$pl['name'],'loc'=>$pl['area'],'cat'=>$pl['cat'],'cap'=>'Up to '.$sleeps.' guests · '.$kinds,'sleeps'=>$sleeps,
        'ppWith'=>(int)ceil($from / 2),'ppWithout'=>(int)ceil($from / 2),'pet'=>false,'villa'=>false,'amen'=>$pl['amen'],'desc'=>$pl['desc'],'photos'=>$pl['photos'],'cover'=>0,'faq'=>[],'geo'=>null,
        'maps'=>'','website'=>$pl['web'],'link'=>'','live'=>true,'festival'=>true,'place'=>$pl['id'],'rooms'=>$rooms,'from'=>$from,'feePct'=>FEE_PCT];
      $hosts[] = ['id'=>'v-'.$pl['id'],'name'=>$pl['name']];
    }
    out(['ok'=>true,'props'=>$props,'hosts'=>$hosts,'fest'=>['from'=>settings()['firstNight'],'to'=>settings()['lastNight']]]);
  }

  /* ---- Built-in Calm Shade listings (Karthik's own stays) — dashboard edits persist here ---- */
  case 'cs_builtin_state':
    out(['ok'=>true,'props'=>(object)cs_builtin_overrides()]);

  case 'cs_builtin_save': {
    if ($m !== 'POST') fail('Use POST');
    need_admin();
    $b = body(); $id = (string)($b['id'] ?? '');
    if (!isset(CS_PROPS[$id])) fail('Unknown listing.', 404);
    $p = (array)($b['listing'] ?? []);
    $d = cs_builtin_clean($p, cs_builtin_overrides()[$id] ?? []);
    if (array_key_exists('name', $p) && trim($d['name'] ?? '') === '') fail('Give the listing a name.');
    cs_builtin_init();
    $json = json_encode($d);
    $st = db()->prepare('SELECT 1 FROM cs_builtin WHERE id=?'); $st->execute([$id]);
    if ($st->fetch()) db()->prepare('UPDATE cs_builtin SET data=?, updated_at=? WHERE id=?')->execute([$json, time(), $id]);
    else db()->prepare('INSERT INTO cs_builtin (id,data,updated_at) VALUES (?,?,?)')->execute([$id, $json, time()]);
    out(['ok'=>true,'listing'=>$d]);
  }

  /* ---- Host accounts ---- */
  case 'host_me': {
    $h = need_host(); cs_init(); $S = settings();
    $st = db()->prepare('SELECT * FROM fest_listings WHERE id=?'); $st->execute([$h['listing_id']]); $l = $st->fetch();
    if (!$l) fail('Your listing was removed. Write to the festival team.', 404);
    $pid = 'L-'.$l['id']; $cs = []; $fest = [];
    foreach (db()->query('SELECT * FROM cs_bookings ORDER BY created_at DESC') as $r) {
      $items = json_decode($r['items'], true) ?: []; $mine = array_values(array_filter($items, fn($it)=>$it['prop'] === $pid)); if (!$mine) continue;
      $g = json_decode($r['guest'], true) ?: [];
      $cs[] = ['ref'=>$r['ref'],'status'=>($r['status']==='pending' && !active_booking($r,$S)) ? 'expired' : $r['status'],'items'=>$mine,'onlyMine'=>count($mine) === count($items),'guest'=>['name'=>$g['name'] ?? '','phone'=>$g['phone'] ?? ''],'utr'=>$r['utr']];
    }
    foreach (db()->query("SELECT * FROM fest_bookings WHERE status IN ".LIVE." ORDER BY created_at DESC") as $r) {
      $mine = array_values(array_filter(json_decode($r['items'], true) ?: [], fn($it)=>($it['unit'] ?? '') === $pid)); if (!$mine) continue;
      $g = json_decode($r['guest'], true) ?: [];
      $fest[] = ['ref'=>$r['ref'],'status'=>show_status($r, $S),'items'=>$mine,'guest'=>['name'=>$g['name'] ?? '','phone'=>$r['status']==='confirmed' ? ($g['phone'] ?? '') : '']];
    }
    out(['ok'=>true,'host'=>['id'=>'h'.$h['id'],'name'=>$h['name'],'phone'=>$h['phone'],'email'=>$h['email']],'listing'=>['id'=>$l['id'],'status'=>$l['status'],'data'=>json_decode($l['data'], true) ?: []],'prop'=>cs_public_prop($l, $h),'csBookings'=>$cs,'festBookings'=>$fest]);
  }
  case 'host_save': {
    if ($m !== 'POST') fail('Use POST');
    $h = need_host(); $b = body();
    $st = db()->prepare('SELECT data FROM fest_listings WHERE id=?'); $st->execute([$h['listing_id']]); $r = $st->fetch(); if (!$r) fail('Listing not found.', 404);
    $p = (array)($b['listing'] ?? []);
    $d = listing_fields($p, json_decode($r['data'], true) ?: []);
    if (trim($d['name'] ?? '') === '') fail('Give your listing a name.');
    db()->prepare('UPDATE fest_listings SET data=? WHERE id=?')->execute([json_encode($d), $h['listing_id']]);
    out(['ok'=>true]);
  }
  case 'host_status': {
    if ($m !== 'POST') fail('Use POST');
    $h = need_host(); cs_init(); $b = body(); $s = (string)($b['status'] ?? ''); $pid = 'L-'.$h['listing_id'];
    if (!in_array($s, ['confirmed','cancelled'], true)) fail('Unknown status');
    $r = find_booking('cs_bookings', $b['ref'] ?? ''); if (!$r) fail('Booking not found.', 404);
    $items = json_decode($r['items'], true) ?: [];
    if (!$items || array_filter($items, fn($it)=>$it['prop'] !== $pid)) fail('This booking includes other hosts\' stays. The Calm Shade team confirms it.', 403);
    if ($s === 'confirmed' && !active_booking($r, settings())) {
      $occ = cs_occ(); foreach ($items as $it) foreach ($it['nights'] as $d) if (!empty($occ[$pid][$d])) fail('Those nights were taken after this hold lapsed.', 409);
    }
    db()->prepare('UPDATE cs_bookings SET status=? WHERE ref=?')->execute([$s, $r['ref']]);
    $g = json_decode($r['guest'], true) ?: [];
    notify($g['email'] ?? '', ($s === 'confirmed' ? 'Confirmed: ' : 'Cancelled: ').'Calm Shade booking '.$r['ref'], $s === 'confirmed' ? array_merge(['Hi '.($g['name'] ?? '').',', '', 'Your host has confirmed your stay.', ''], cs_lines($items), ['', '— Calm Shade']) : ['Hi '.($g['name'] ?? '').',', '', 'Booking '.$r['ref'].' was cancelled by your host and its nights released. If you already paid, reply and we will arrange the refund.', '', '— Calm Shade']);
    out(['ok'=>true]);
  }
  /* ---- sign in: a 6-digit code by email ---- */
  case 'login_start': {
    if ($m !== 'POST') fail('Use POST');
    auth_init(); $b = body(); $w = who_is($b['id'] ?? '');
    if (!$w) fail('Enter your email address, or a 10-digit phone number.');
    if ($w[0] === 'nomail') fail('We don\'t have an email for that phone number yet. Sign in with your email address instead.', 404);
    throttle('login', 8, 3600, 'Too many sign-in codes from this device. Try again in an hour.');
    $st = db()->prepare('SELECT COUNT(*) c FROM cs_codes WHERE who=? AND created > ?'); $st->execute([$w[1], time() - 900]);
    if ((int)$st->fetch()['c'] >= 3) fail('We have sent 3 codes in the last 15 minutes. Check your inbox (and spam), or try again a little later.', 429);
    db()->prepare('DELETE FROM cs_codes WHERE expires < ?')->execute([time() - 86400]);
    $code = (string)random_int(100000, 999999);
    db()->prepare('INSERT INTO cs_codes (who,code_hash,expires,tries,created) VALUES (?,?,?,0,?)')->execute([$w[1], hash('sha256', $w[1].'|'.$code), time() + 600, time()]);
    notify($w[1], 'Your Calm Shade sign-in code: '.$code, ['Your sign-in code is '.$code, '', 'It works for 10 minutes. If you didn\'t ask for it, ignore this email.', '', '— Calm Shade']);
    out(['ok'=>true,'sentTo'=>mask_email($w[1])]);
  }
  case 'login_verify': {
    if ($m !== 'POST') fail('Use POST');
    auth_init(); $b = body(); $w = who_is($b['id'] ?? ''); $code = preg_replace('/\D/', '', (string)($b['code'] ?? ''));
    if (!$w || $w[0] === 'nomail' || strlen($code) !== 6) fail('Enter the 6-digit code from the email.');
    $st = db()->prepare('SELECT * FROM cs_codes WHERE who=? AND expires > ? ORDER BY created DESC LIMIT 1');
    $st->execute([$w[1], time()]); $r = $st->fetch();
    if (!$r || (int)$r['tries'] >= 5) fail('That code has expired. Ask for a new one.', 400);
    if (!hash_equals($r['code_hash'], hash('sha256', $w[1].'|'.$code))) {
      db()->prepare('UPDATE cs_codes SET tries=tries+1 WHERE who=? AND code_hash=?')->execute([$w[1], $r['code_hash']]); usleep(300000);
      fail('That code doesn\'t match. Check the latest email and try again.', 400);
    }
    db()->prepare('DELETE FROM cs_codes WHERE who=?')->execute([$w[1]]);
    $token = bin2hex(random_bytes(20)); $now = time();
    db()->prepare('INSERT INTO cs_sessions (token_hash,role,email,phone,host_id,created,seen) VALUES (?,?,?,?,?,?,?)')->execute([hash('sha256', $token), $w[0], $w[1], $w[2], $w[3]['id'] ?? null, $now, $now]);
    out(session_out(['role'=>$w[0],'email'=>$w[1],'phone'=>$w[2],'host_id'=>$w[3]['id'] ?? null], $token));
  }
  case 'login_me': {
    $s = session_of($_SERVER['HTTP_X_SESSION'] ?? ''); if (!$s) fail('Signed out.', 401);
    out(session_out($s));
  }
  case 'logout': {
    $t = (string)($_SERVER['HTTP_X_SESSION'] ?? ''); if (strlen($t) === 40) { auth_init(); db()->prepare('DELETE FROM cs_sessions WHERE token_hash=?')->execute([hash('sha256', $t)]); }
    out(['ok'=>true]);
  }

  case 'host_link_request': {
    if ($m !== 'POST') fail('Use POST');
    throttle('hostlink', 5, 3600, 'Too many requests. Try again in an hour.');
    hosts_init(); $ph = digits(body()['phone'] ?? ''); $sent = false;
    if (strlen($ph) === 10) foreach (db()->query('SELECT * FROM cs_hosts') as $h) {
      if (digits($h['phone']) !== $ph || empty($h['email'])) continue;
      $k = host_new_key($h['id']);
      notify($h['email'], 'Your Calm Shade host link', ['Hi '.$h['name'].',', '', 'Here is your private host link. It signs you straight in; older links stop working.', site_base().'?host='.$k, '', '— Calm Shade']);
      $sent = true; break;
    }
    usleep(300000);
    out(['ok'=>true,'message'=>'If that number belongs to a Calm Shade host with an email on file, a new sign-in link is on its way. Otherwise, message us on WhatsApp.']);
  }

  /* ---- APPA Art Passport ---- */
  case 'passport': {
    $b = body(); out(['ok'=>true] + passport_data($b['tickets'] ?? []));
  }
  case 'stamp': {
    if ($m !== 'POST') fail('Use POST');
    throttle('stamp', 60, 3600, 'Too many stamps from this phone. Try again later.');
    $b = body(); $spot = (string)($b['spot'] ?? ''); $sig = (string)($b['sig'] ?? '');
    if (!in_array($spot, STAMP_SPOTS, true) || !hash_equals(stamp_sig($spot), $sig)) fail('That QR code is not a valid APPA stamp.', 400);
    $p = passport_data($b['tickets'] ?? []);
    if (!$p['bookings']) fail($p['pending'] ? 'Your passport opens once your payment is confirmed.' : 'Find your booking first to open your passport.', 403);
    $fresh = !isset(((array)$p['stamps'])[$spot]);
    if ($fresh) db()->prepare('INSERT INTO fest_stamps (ref,spot,at) VALUES (?,?,?)')->execute([$p['bookings'][0]['ref'], $spot, time()]);
    out(['ok'=>true,'spot'=>$spot,'fresh'=>$fresh] + passport_data($b['tickets'] ?? []));
  }
  case 'stamp_links': {
    need_admin(); $out = [];
    foreach (STAMP_SPOTS as $sp) $out[] = ['spot'=>$sp,'sig'=>stamp_sig($sp)];
    db()->exec('CREATE TABLE IF NOT EXISTS fest_stamps (ref VARCHAR(16) NOT NULL, spot VARCHAR(20) NOT NULL, at BIGINT NOT NULL)');
    $cnt = []; foreach (db()->query('SELECT spot, COUNT(*) c FROM fest_stamps GROUP BY spot') as $r) $cnt[$r['spot']] = (int)$r['c'];
    out(['ok'=>true,'links'=>$out,'counts'=>(object)$cnt]);
  }
  case 'schedule_set': {
    need_admin(); $b = body(); $items = [];
    foreach (array_slice((array)($b['items'] ?? []), 0, 350) as $it) {
      $d = (string)($it['date'] ?? ''); $tm = (string)($it['time'] ?? ''); $sp = (string)($it['spot'] ?? '');
      $ac = (string)($it['access'] ?? 'all'); if (!in_array($ac, ['all','vip','vvip'], true)) $ac = 'all';
      $ti = clean($it['title'] ?? '', 100); $to = (string)($it['to'] ?? '');
      $kd = in_array($it['kind'] ?? 'show', ['show','exhibit','fest','dhol','workshop','adventure'], true) ? $it['kind'] : 'show';
      if (!valid_date($d) || $ti === '' || ($tm !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $tm)) || ($sp !== '' && !in_array($sp, STAMP_SPOTS, true))) continue;
      if ($to !== '' && (!valid_date($to) || $to <= $d)) $to = '';
      $items[] = ['id'=>preg_replace('/[^a-z0-9]/i', '', (string)($it['id'] ?? '')) ?: bin2hex(random_bytes(4)),'date'=>$d,'to'=>$to,'time'=>$tm,'spot'=>$sp,'title'=>$ti,'access'=>$ac,'kind'=>$kd];
    }
    usort($items, fn($x,$y)=>strcmp($x['date'].$x['time'], $y['date'].$y['time']));
    kv_set('schedule', json_encode($items));
    out(['ok'=>true,'schedule'=>$items]);
  }
  case 'sponsors_set': {
    need_admin(); $b = body(); $items = [];
    foreach (array_slice((array)($b['items'] ?? []), 0, 300) as $it) {
      $nm = clean($it['name'] ?? '', 80); if ($nm === '') continue;
      $tier = in_array($it['tier'] ?? '', SPONSOR_TIERS, true) ? $it['tier'] : 'Other';
      $st = in_array($it['status'] ?? '', SPONSOR_STATUS, true) ? $it['status'] : 'Lead';
      $items[] = ['id'=>preg_replace('/[^a-z0-9]/i', '', (string)($it['id'] ?? '')) ?: bin2hex(random_bytes(4)),'name'=>$nm,'tier'=>$tier,'what'=>clean($it['what'] ?? '', 80),
        'status'=>$st,'value'=>max(0, (int)($it['value'] ?? 0)),'contact'=>clean($it['contact'] ?? '', 120),'notes'=>clean($it['notes'] ?? '', 600),'updated'=>time()];
    }
    kv_set('sponsors', json_encode($items));
    out(['ok'=>true,'sponsors'=>$items]);
  }
  case 'logos_set': {
    need_admin(); $b = body(); $items = [];
    foreach (array_slice((array)($b['items'] ?? []), 0, 120) as $it) {
      $nm = clean($it['name'] ?? '', 60); $g = (string)($it['group'] ?? ''); if ($nm === '' || !in_array($g, LOGO_GROUPS, true)) continue;
      $img = (string)($it['img'] ?? ''); if ($img !== '' && !preg_match('#^(uploads/\d{6}/[a-f0-9]{24}\.(jpg|png|webp)|https://[^\s"<>]{4,300})$#', $img)) $img = '';
      $url = (string)($it['url'] ?? ''); if ($url !== '' && !preg_match('#^https?://[^\s"<>]{3,300}$#', $url)) $url = '';
      $items[] = ['id'=>preg_replace('/[^a-z0-9]/i', '', (string)($it['id'] ?? '')) ?: bin2hex(random_bytes(4)),'name'=>$nm,'group'=>$g,'img'=>$img,'url'=>$url];
    }
    kv_set('logos', json_encode($items));
    out(['ok'=>true,'logos'=>$items]);
  }

  default: fail('Unknown action', 404);
}
} catch (Throwable $e) {
  error_log('fest.php: '.$e->getMessage());
  fail('Something went wrong on our side. Try again in a minute.', 500);
}
