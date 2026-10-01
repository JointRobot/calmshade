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
  } catch (Throwable $e) { fail('Booking store is not reachable', 503); }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  $pdo->exec('CREATE TABLE IF NOT EXISTS fest_bookings (ref VARCHAR(16) PRIMARY KEY, token VARCHAR(40) NOT NULL, status VARCHAR(12) NOT NULL, created_at BIGINT NOT NULL, tier VARCHAR(8), total BIGINT, payout BIGINT, items TEXT, guest TEXT, utr VARCHAR(60))');
  $pdo->exec('CREATE TABLE IF NOT EXISTS fest_listings (id VARCHAR(20) PRIMARY KEY, created_at BIGINT NOT NULL, status VARCHAR(12) NOT NULL, data TEXT, contact TEXT)');
  $pdo->exec('CREATE TABLE IF NOT EXISTS fest_kv (k VARCHAR(40) PRIMARY KEY, v TEXT)');
  $pdo->exec('CREATE TABLE IF NOT EXISTS fest_hits (ip VARCHAR(64) NOT NULL, act VARCHAR(12) NOT NULL, at BIGINT NOT NULL)');
  return $pdo;
}
function is_mysql() { return defined('FEST_DB_DSN') && stripos(FEST_DB_DSN, 'mysql') === 0; }

/* ---------- settings & inventory ---------- */
const DEF = ['coupleNight'=>12000,'singleNight'=>6000,'extraGuest'=>2000,'partnerShareCouple'=>8000,'partnerShareSingle'=>4000,
  'tentNight'=>9000,'tents'=>20,'dayPass'=>2000,'partnerMarkup'=>1000,'surgeMax'=>20,'vipNights'=>7,'vipDiscount'=>7000,
  'vvipNights'=>30,'vvipDiscount'=>40000,'holdHours'=>48,'firstNight'=>'2027-01-25','lastNight'=>'2027-02-28',
  'passLast'=>'2027-02-25','encoreFrom'=>'2027-02-26','upi'=>'xtrathindesign@okicici','payee'=>'Karthikeyan Ramachandran',
  'contact'=>'karthik@xtrathin.in'];
const VIP = [
  'calmshet' => ['name'=>'Calmshet','rooms'=>5,'cap'=>4,'kind'=>'room'],
  'lefarm'   => ['name'=>'Le Farm','rooms'=>8,'cap'=>4,'kind'=>'room'],
  'shambhala'=> ['name'=>'Shambhala by the Lake','rooms'=>6,'cap'=>4,'kind'=>'room'],
  'theeya'   => ['name'=>'Theeya','rooms'=>4,'cap'=>4,'kind'=>'room'],
  'ctheatre' => ['name'=>'The Company Theatre','rooms'=>8,'cap'=>4,'kind'=>'room'],
  'purrom'   => ['name'=>'Purrom','rooms'=>4,'cap'=>1,'kind'=>'single'],
];
function settings() {
  static $s = null; if ($s) return $s;
  $row = db()->query("SELECT v FROM fest_kv WHERE k='settings'")->fetch();
  $saved = $row ? (json_decode($row['v'], true) ?: []) : [];
  $s = DEF;
  foreach ($saved as $k => $v) if (array_key_exists($k, DEF)) $s[$k] = is_int(DEF[$k]) ? (int)$v : (string)$v;
  return $s;
}
function listings_all() { return db()->query('SELECT * FROM fest_listings ORDER BY created_at')->fetchAll(); }
function units() {
  $S = settings(); $u = VIP;
  $u['tents'] = ['name'=>'VIP Tent Village','rooms'=>max(0,(int)$S['tents']),'cap'=>2,'kind'=>'tent'];
  foreach (listings_all() as $l) {
    if ($l['status'] !== 'approved') continue;
    $d = json_decode($l['data'], true) ?: [];
    $u['L-'.$l['id']] = ['name'=>(string)($d['name']??'Partner stay'),'rooms'=>max(1,(int)($d['rooms']??1)),'cap'=>max(1,(int)($d['maxGuests']??2)),'kind'=>'partner','rate'=>max(0,(int)($d['rate']??0))];
  }
  return $u;
}
function active_booking($b, $S) {
  if ($b['status'] === 'confirmed') return true;
  if ($b['status'] !== 'pending') return false;
  return (time() - (int)$b['created_at']) < $S['holdHours'] * 3600;
}
function occupancy() {
  $S = settings(); $occ = [];
  foreach (db()->query("SELECT status, created_at, items FROM fest_bookings WHERE status IN ('pending','confirmed')") as $b) {
    if (!active_booking($b, $S)) continue;
    foreach (json_decode($b['items'], true) ?: [] as $it) {
      if (($it['kind'] ?? '') !== 'stay') continue;
      foreach ($it['nights'] as $d) $occ[$it['unit']][$d] = ($occ[$it['unit']][$d] ?? 0) + (int)$it['rooms'];
    }
  }
  return $occ;
}
function addDays($d, $n) { return gmdate('Y-m-d', strtotime($d.' 00:00:00 UTC') + $n * 86400); }
function r100($x) { return (int)(round($x / 100) * 100); }
function surge($u, $id, $d, $occ, $S) {
  if (!in_array($u['kind'], ['room','single','tent']) || $u['rooms'] <= 1) return 1;
  return 1 + ($S['surgeMax'] / 100) * min(1, ($occ[$id][$d] ?? 0) / ($u['rooms'] - 1));
}
function night_price($u, $id, $d, $g, $occ, $S) {
  switch ($u['kind']) {
    case 'single': return r100($S['singleNight'] * surge($u,$id,$d,$occ,$S));
    case 'room':   return r100($S['coupleNight'] * surge($u,$id,$d,$occ,$S)) + max(0,$g-2) * $S['extraGuest'];
    case 'tent':   return r100($S['tentNight'] * surge($u,$id,$d,$occ,$S)) + max(0,$g-2) * $S['extraGuest'];
    default:       return $u['rate'] + $S['partnerMarkup'] * $g;
  }
}
function host_payout($u, $rooms, $n, $S) {
  if ($u['kind'] === 'room') return $S['partnerShareCouple'] * $rooms * $n;
  if ($u['kind'] === 'single') return $S['partnerShareSingle'] * $rooms * $n;
  if ($u['kind'] === 'partner') return $u['rate'] * $rooms * $n;
  return 0;
}
function valid_date($d) { return is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int)substr($d,5,2),(int)substr($d,8,2),(int)substr($d,0,4)); }

/* Price and validate a trip against the live inventory. Returns [quote, errors]. */
function quote($stays, $passes, $occ) {
  $S = settings(); $U = units(); $err = []; $lines = []; $prem = []; $want = [];
  if (!is_array($stays) || !is_array($passes) || count($stays) + count($passes) === 0) return [null, ['Your trip is empty.']];
  if (count($stays) > 20 || count($passes) > 40) return [null, ['That trip has too many items.']];
  foreach ($stays as $s) {
    $id = (string)($s['unit'] ?? ''); $u = $U[$id] ?? null;
    if (!$u) { $err[] = 'One of the stays in your trip is no longer available.'; continue; }
    $from = (string)($s['from'] ?? ''); $n = (int)($s['n'] ?? 0); $rooms = (int)($s['rooms'] ?? 0);
    $g = $u['kind'] === 'single' ? 1 : (int)($s['guests'] ?? 2);
    if (!valid_date($from) || $n < 1 || $n > 40 || $rooms < 1 || $rooms > $u['rooms'] || $g < 1 || $g > $u['cap']) { $err[] = 'Check the dates, rooms and guests for '.$u['name'].'.'; continue; }
    $nights = []; for ($i = 0; $i < $n; $i++) $nights[] = addDays($from, $i);
    if ($nights[0] < $S['firstNight'] || end($nights) > $S['lastNight']) { $err[] = $u['name'].': those nights are outside the festival.'; continue; }
    $per = []; foreach ($nights as $d) { $per[] = night_price($u,$id,$d,$g,$occ,$S); $want[$id][$d] = ($want[$id][$d] ?? 0) + $rooms; }
    if ($u['kind'] !== 'partner') foreach ($nights as $d) $prem[$d] = 1;
    $total = array_sum($per) * $rooms;
    $lines[] = ['kind'=>'stay','unit'=>$id,'name'=>$u['name'],'unitKind'=>$u['kind'],'nights'=>$nights,'rooms'=>$rooms,'guests'=>$g,'per'=>$per,'total'=>$total,'payout'=>host_payout($u,$rooms,$n,$S)];
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
  $pn = count($prem);
  $tier = $pn >= $S['vvipNights'] ? 'vvip' : ($pn >= $S['vipNights'] ? 'vip' : '');
  if (!$tier) {
    foreach ($lines as $l) {
      if ($l['kind'] !== 'stay') continue;
      if (end($l['nights']) >= $S['encoreFrom']) { $err[] = 'The Encore nights are for VIP and VVIP trips only.'; break; }
    }
  }
  $stayT = array_sum(array_map(fn($l)=>$l['kind']==='stay'?$l['total']:0, $lines));
  $payout = array_sum(array_map(fn($l)=>$l['payout']??0, $lines));
  $disc = $tier === 'vvip' ? $S['vvipDiscount'] : ($tier === 'vip' ? $S['vipDiscount'] : 0);
  return [['items'=>$lines,'stays'=>$stayT,'passes'=>$pt,'discount'=>$disc,'total'=>max(0,$stayT+$pt-$disc),'payout'=>$payout,'tier'=>$tier,'premiumNights'=>$pn], array_values(array_unique($err))];
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
  @mail($to, '=?UTF-8?B?'.base64_encode($subject).'?=', implode("\n", $lines), $headers);
}
function inr($n) { return '₹'.number_format((float)$n); }
function trip_lines($items) {
  $out = [];
  foreach ($items as $it) {
    if ($it['kind'] === 'stay') $out[] = '- '.$it['name'].': '.gmdate('j M', strtotime($it['nights'][0])).' to '.gmdate('j M', strtotime(addDays(end($it['nights']), 1))).', '.count($it['nights']).' night(s), '.$it['rooms'].' room(s), '.$it['guests'].' adult(s) each — '.inr($it['total']);
    else $out[] = '- Day pass '.gmdate('j M', strtotime($it['date'])).' × '.$it['qty'].' — '.inr($it['total']);
  }
  return $out;
}
function need_admin() {
  if (!defined('FEST_ADMIN_KEY') || strlen(FEST_ADMIN_KEY) < 12) fail('The festival desk is locked until FEST_ADMIN_KEY is set in fest-config.php.', 403);
  $k = $_SERVER['HTTP_X_FEST_KEY'] ?? '';
  if (!hash_equals(FEST_ADMIN_KEY, (string)$k)) { usleep(400000); fail('That desk key is not right.', 403); }
}
function lock_start() { $p = db(); if (is_mysql()) { $p->query("SELECT GET_LOCK('appa_fest_book', 10)"); $p->beginTransaction(); } else { $p->exec('BEGIN IMMEDIATE'); } }
function lock_end($ok) { $p = db(); if (is_mysql()) { $ok ? $p->commit() : $p->rollBack(); $p->query("SELECT RELEASE_LOCK('appa_fest_book')"); } else { $p->exec($ok ? 'COMMIT' : 'ROLLBACK'); } }
function new_ref() { $a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $r = 'APPA-'; for ($i = 0; $i < 5; $i++) $r .= $a[random_int(0, strlen($a)-1)]; return $r; }
function public_listings() {
  $out = [];
  foreach (listings_all() as $l) if ($l['status'] === 'approved') {
    $d = json_decode($l['data'], true) ?: [];
    $out[] = ['id'=>'L-'.$l['id'],'name'=>$d['name']??'','type'=>$d['type']??'','location'=>$d['location']??'','distance'=>$d['distance']??'','rooms'=>(int)($d['rooms']??1),'maxGuests'=>(int)($d['maxGuests']??2),'rate'=>(int)($d['rate']??0),'desc'=>$d['desc']??''];
  }
  return $out;
}

/* ---------- routes ---------- */
$a = $_GET['a'] ?? 'state';
$m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($m !== 'GET' && $m !== 'POST') fail('Method not allowed', 405);

try {
switch ($a) {
  case 'state':
    out(['ok'=>true,'settings'=>settings(),'listings'=>public_listings(),'occ'=>(object)occupancy(),'now'=>time(),
         'store'=>is_mysql() ? 'mysql' : 'sqlite','deskReady'=>defined('FEST_ADMIN_KEY') && strlen(FEST_ADMIN_KEY) >= 12]);

  case 'book': {
    if ($m !== 'POST') fail('Use POST');
    $b = body(); $g = $b['guest'] ?? [];
    $name = clean($g['name'] ?? '', 80); $phone = preg_replace('/[^\d+]/', '', (string)($g['phone'] ?? '')); $email = clean($g['email'] ?? '', 120); $note = clean($g['note'] ?? '', 300);
    if ($name === '') fail('Add your name.');
    if (strlen(preg_replace('/\D/', '', $phone)) < 10) fail('Add a 10-digit phone number.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('That email address looks wrong.');
    throttle('book', 10, 86400, 'Too many bookings from this device today. Message us on WhatsApp and we will help.');
    $S0 = settings(); $mineOpen = 0;
    foreach (db()->query("SELECT status, created_at, guest FROM fest_bookings WHERE status='pending'") as $r)
      if (active_booking($r, $S0) && digits((json_decode($r['guest'], true) ?: [])['phone'] ?? '') === digits($phone)) $mineOpen++;
    if ($mineOpen >= 3) fail('You already have 3 unpaid bookings on hold. Pay or cancel one of them first.', 429);
    lock_start(); $ok = false;
    try {
      [$q, $err] = quote($b['stays'] ?? [], $b['passes'] ?? [], occupancy());
      if ($err) { lock_end(false); out(['error'=>$err[0],'errors'=>$err], 409); }
      if (isset($b['expectTotal']) && (int)$b['expectTotal'] !== $q['total']) { lock_end(false); out(['error'=>'Prices changed while you were booking. Your trip now costs ₹'.number_format($q['total']).'. Review it and book again.','priceChanged'=>true], 409); }
      do { $ref = new_ref(); $st = db()->prepare('SELECT 1 FROM fest_bookings WHERE ref=?'); $st->execute([$ref]); } while ($st->fetch());
      $token = bin2hex(random_bytes(16)); $now = time();
      db()->prepare('INSERT INTO fest_bookings (ref,token,status,created_at,tier,total,payout,items,guest) VALUES (?,?,?,?,?,?,?,?,?)')
        ->execute([$ref,$token,'pending',$now,$q['tier'],$q['total'],$q['payout'],json_encode($q['items']),json_encode(['name'=>$name,'phone'=>$phone,'email'=>$email,'note'=>$note,'discount'=>$q['discount']])]);
      $ok = true; lock_end(true);
    } catch (Throwable $e) { if (!$ok) lock_end(false); throw $e; }
    $S = settings(); $until = gmdate('j M, H:i', $now + $S['holdHours']*3600 + 19800).' IST';
    $body = array_merge(['Booking '.$ref.' — '.$name.', '.$phone.($email ? ', '.$email : ''), ''], trip_lines($q['items']),
      [$q['discount'] ? strtoupper($q['tier']).' discount: −'.inr($q['discount']) : '', 'Total: '.inr($q['total']), 'Held until '.$until, $note ? 'Note: '.$note : '']);
    notify($S['contact'], 'New festival booking '.$ref.' · '.inr($q['total']), $body);
    if ($email) notify($email, 'Your APPA Art Fest rooms are held · '.$ref, array_merge(['Hi '.$name.',', '', 'Your rooms are held until '.$until.'. Pay '.inr($q['total']).' by UPI to '.$S['upi'].' ('.$S['payee'].') with '.$ref.' in the note, then send us the UPI reference on the booking page.', ''], trip_lines($q['items']), ['', 'Questions: '.$S['contact'].' or WhatsApp +91 87999 38193', '— APPA Art Fest 2027']));
    out(['ok'=>true,'ref'=>$ref,'token'=>$token,'total'=>$q['total'],'tier'=>$q['tier'],'createdAt'=>$now,'holdUntil'=>$now + $S['holdHours']*3600]);
  }

  case 'quote': {
    $b = body(); [$q, $err] = quote($b['stays'] ?? [], $b['passes'] ?? [], occupancy());
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
      $st = db()->prepare('SELECT ref,token,status,created_at,tier,total,items,utr FROM fest_bookings WHERE ref=?'); $st->execute([(string)($t['ref'] ?? '')]);
      $r = $st->fetch(); if (!$r || !hash_equals($r['token'], (string)($t['token'] ?? ''))) continue;
      $status = ($r['status'] === 'pending' && !active_booking($r, $S)) ? 'expired' : $r['status'];
      $res[] = ['ref'=>$r['ref'],'status'=>$status,'tier'=>$r['tier'],'total'=>(int)$r['total'],'createdAt'=>(int)$r['created_at'],'holdUntil'=>(int)$r['created_at'] + $S['holdHours']*3600,'items'=>json_decode($r['items'], true),'utrSent'=>!empty($r['utr'])];
    }
    out(['ok'=>true,'bookings'=>$res]);
  }

  case 'utr': case 'cancel': {
    if ($m !== 'POST') fail('Use POST');
    $b = body(); $st = db()->prepare('SELECT token,status FROM fest_bookings WHERE ref=?'); $st->execute([(string)($b['ref'] ?? '')]);
    $r = $st->fetch(); if (!$r || !hash_equals($r['token'], (string)($b['token'] ?? ''))) fail('Booking not found.', 404);
    if ($a === 'utr') {
      $utr = clean($b['utr'] ?? '', 200); if (strlen(preg_replace('/\W/', '', $utr)) < 6) fail('That reference number looks short. UPI references are usually 12 digits.');
      if ($r['status'] === 'cancelled') fail('This booking was cancelled. Message us on WhatsApp if you have already paid.');
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
    $d = ['name'=>clean($p['name'] ?? '', 80),'type'=>clean($p['type'] ?? '', 30),'location'=>clean($p['location'] ?? '', 80),'distance'=>clean($p['distance'] ?? '', 8),
          'rooms'=>max(1,min(60,(int)($p['rooms'] ?? 1))),'maxGuests'=>max(1,min(8,(int)($p['maxGuests'] ?? 2))),'rate'=>max(500,min(200000,(int)($p['rate'] ?? 0))),'desc'=>clean($p['desc'] ?? '', 240)];
    $ct = ['name'=>clean($c['name'] ?? '', 80),'phone'=>clean($c['phone'] ?? '', 20),'email'=>clean($c['email'] ?? '', 120)];
    if ($d['name'] === '' || $d['location'] === '' || $ct['name'] === '' || strlen(preg_replace('/\D/', '', $ct['phone'])) < 10) fail('Fill in the property name, area, your name and a 10-digit phone number.');
    $n = (int)db()->query("SELECT COUNT(*) c FROM fest_listings WHERE status='pending'")->fetch()['c'];
    if ($n > 300) fail('We have a lot of applications right now. Write to the festival team instead.', 429);
    throttle('list', 5, 86400, 'Too many applications from this device today. Write to the festival team instead.');
    $id = strtoupper(bin2hex(random_bytes(4)));
    db()->prepare('INSERT INTO fest_listings (id,created_at,status,data,contact) VALUES (?,?,?,?,?)')->execute([$id,time(),'pending',json_encode($d),json_encode($ct)]);
    notify(settings()['contact'], 'New partner stay application: '.$d['name'], [$d['name'].' ('.$d['type'].'), '.$d['location'], $d['rooms'].' rooms × '.$d['maxGuests'].' adults at '.inr($d['rate']).' a night', 'Contact: '.$ct['name'].', '.$ct['phone'].' '.$ct['email'], '', 'Approve it in the APPA Fest desk.']);
    out(['ok'=>true,'id'=>$id]);
  }

  /* ---- festival desk (admin) ---- */
  case 'admin': {
    need_admin(); $S = settings();
    $bs = [];
    foreach (db()->query('SELECT * FROM fest_bookings ORDER BY created_at DESC') as $r) {
      $status = ($r['status'] === 'pending' && !active_booking($r, $S)) ? 'expired' : $r['status'];
      $bs[] = ['ref'=>$r['ref'],'status'=>$status,'createdAt'=>(int)$r['created_at'],'tier'=>$r['tier'],'total'=>(int)$r['total'],'payout'=>(int)$r['payout'],'items'=>json_decode($r['items'], true),'guest'=>json_decode($r['guest'], true),'utr'=>$r['utr']];
    }
    $ls = array_map(fn($l)=>['id'=>$l['id'],'status'=>$l['status'],'createdAt'=>(int)$l['created_at'],'data'=>json_decode($l['data'], true),'contact'=>json_decode($l['contact'], true)], listings_all());
    out(['ok'=>true,'bookings'=>$bs,'listings'=>$ls,'store'=>is_mysql() ? 'mysql' : 'sqlite']);
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
      db()->prepare('UPDATE fest_bookings SET status=?, created_at=? WHERE ref=?')->execute([$s, $created, $ref]);
      $ok = true; lock_end(true);
    } catch (Throwable $e) { if (!$ok) lock_end(false); throw $e; }
    $g = json_decode($r['guest'], true) ?: [];
    if ($s === 'confirmed') notify($g['email'] ?? '', 'Confirmed: your APPA Art Fest booking '.$ref, array_merge(['Hi '.($g['name'] ?? '').',', '', 'Payment received — your booking is confirmed. See you at the lake.', ''], trip_lines(json_decode($r['items'], true) ?: []), ['', '— APPA Art Fest 2027']));
    if ($s === 'cancelled') notify($g['email'] ?? '', 'Cancelled: APPA Art Fest booking '.$ref, ['Hi '.($g['name'] ?? '').',', '', 'Booking '.$ref.' has been cancelled and its rooms released. If you already paid, reply to this email and we will sort out the refund.', '', '— APPA Art Fest 2027']);
    out(['ok'=>true]);
  }
  case 'approve': {
    need_admin(); $b = body(); $s = (string)($b['status'] ?? '');
    if (!in_array($s, ['approved','rejected','pending'], true)) fail('Unknown status');
    db()->prepare('UPDATE fest_listings SET status=? WHERE id=?')->execute([$s, (string)($b['id'] ?? '')]);
    out(['ok'=>true]);
  }
  case 'settings': {
    need_admin(); $b = body(); $in = (array)($b['settings'] ?? []); $s = [];
    foreach (DEF as $k => $v) if (array_key_exists($k, $in)) $s[$k] = is_int($v) ? max(0, (int)$in[$k]) : clean($in[$k], 120);
    foreach (['firstNight','lastNight','passLast','encoreFrom'] as $k) if (isset($s[$k]) && !valid_date($s[$k])) fail($k.' must be a date like 2027-01-25');
    $v = json_encode(array_merge(settings(), $s));
    db()->prepare('DELETE FROM fest_kv WHERE k=?')->execute(['settings']);
    db()->prepare('INSERT INTO fest_kv (k,v) VALUES (?,?)')->execute(['settings', $v]);
    out(['ok'=>true,'settings'=>json_decode($v, true)]);
  }
  default: fail('Unknown action', 404);
}
} catch (Throwable $e) {
  error_log('fest.php: '.$e->getMessage());
  fail('Something went wrong on our side. Try again in a minute.', 500);
}
