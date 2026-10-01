#!/usr/bin/env bash
# Runs every booking test against a throwaway local copy (fresh SQLite, test desk key). Needs PHP 8 + pdo_sqlite, Python 3, playwright (Chromium), Pillow.
set -u
cd "$(dirname "$0")/.."
[ -f fest-config.php ] && { echo "fest-config.php exists here; move it aside first (tests write their own)."; exit 1; }
printf "<?php define('FEST_ADMIN_KEY','test-desk-key-123456');\n" > fest-config.php
php -S 127.0.0.1:8099 -t . > /tmp/fest-test-php.log 2>&1 & PHPPID=$!
sleep 1
for t in api_festival api_homestays ui_festival ui_homestays ui_daypass ui_passport ui_curate ui_hosts; do
  rm -rf fest-data uploads
  printf "%-16s " "$t"
  case $t in api_*) timeout 300 python3 "tests/$t.py" 2>&1 | grep -E "^PASS|^ - " | tr '\n' ' ';;
             *) (cd tests && timeout 300 python3 "$t.py" 2>&1 | grep -E "^PASS|^ - " | tr '\n' ' ');; esac; echo
done
kill $PHPPID; rm -rf fest-data uploads fest-config.php
echo "Note: api_homestays' 4 concierge checks fail by design unless an ANTHROPIC_KEY is configured; booking checks must all pass."
