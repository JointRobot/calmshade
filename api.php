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
