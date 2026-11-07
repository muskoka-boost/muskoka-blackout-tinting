<?php
/**
 * Muskoka Blackout Tinting: quote form handler (cPanel / PHP mail()).
 * Settings live in config.php.
 */
declare(strict_types=1);

date_default_timezone_set('America/Toronto');
$cfg = require __DIR__ . '/config.php';

$wantsJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function respond(bool $ok, string $error = '', int $code = 200): void
{
    global $wantsJson;
    http_response_code($code);
    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error]);
    } else {
        header('Location: ' . ($ok ? 'thanks.html' : 'index.html#quote'), true, 303);
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(false, 'Method not allowed.', 405);
}

// Honeypot: real people never fill this hidden field.
if (!empty($_POST['website'])) {
    respond(true); // pretend success for bots
}

// Too-fast submissions (under 3 seconds after page load) are almost always bots.
$ts = (int)($_POST['ts'] ?? 0);
if ($ts > 0 && (time() - $ts) < 3) {
    respond(true);
}

// Simple per-IP rate limit stored in the system temp dir.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir() . '/mbt_rl_' . hash('sha256', $ip);
$now = time();
$hits = [];
if (is_file($rlFile)) {
    $hits = array_filter(
        array_map('intval', explode(',', (string)@file_get_contents($rlFile))),
        fn($t) => $t > $now - 3600
    );
}
if (count($hits) >= (int)$cfg['RATE_LIMIT_PER_HOUR']) {
    respond(false, 'Too many requests. Please call (705) 644-3980 instead.', 429);
}

// Collect + clean input.
$clean = function (string $key, int $max) {
    $v = trim((string)($_POST[$key] ?? ''));
    $v = str_replace(["\r", "\0"], '', $v);
    return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
};
$oneLine = fn(string $v) => preg_replace('/[\n\t]+/', ' ', $v);

$name    = $oneLine($clean('name', 100));
$phone   = $oneLine($clean('phone', 30));
$email   = $oneLine($clean('email', 150));
$vehicle = $oneLine($clean('vehicle', 120));
$service = $oneLine($clean('service', 80));
$shade   = $oneLine($clean('shade', 80));
$film    = $oneLine($clean('film', 80));
$source  = $oneLine($clean('source', 40));
$message = $clean('message', 3000);

if ($name === '' || $vehicle === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Please fill in your name, a valid email and your vehicle or property.', 422);
}

$subject = sprintf('%s%s: %s (%s)', $cfg['SUBJECT_PREFIX'], $source !== '' ? ' via ' . $source : '', $name, $vehicle);
$body = implode("\n", [
    'New quote request from muskokablackouttinting website',
    str_repeat('-', 48),
    'Name:     ' . $name,
    'Phone:    ' . ($phone ?: 'not given'),
    'Email:    ' . $email,
    'Vehicle/property: ' . $vehicle,
    'Service:  ' . $service,
    'Shade:    ' . $shade,
    'Film:     ' . ($film ?: 'not chosen'),
    '',
    'Message:',
    $message !== '' ? $message : '(none)',
    '',
    str_repeat('-', 48),
    'Sent ' . date('Y-m-d H:i T') . ' from ' . $ip,
    'Reply to this email to respond directly to the customer.',
]);

$fromName = '=?UTF-8?B?' . base64_encode($cfg['MAIL_FROM_NAME']) . '?=';
$replyName = '=?UTF-8?B?' . base64_encode($name) . '?=';
$headers = [
    'From' => $fromName . ' <' . $cfg['MAIL_FROM'] . '>',
    'Reply-To' => $replyName . ' <' . $email . '>',
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
    'X-Mailer' => 'MBT-Website',
];

$sent = @mail(
    $cfg['MAIL_TO'],
    '=?UTF-8?B?' . base64_encode($subject) . '?=',
    $body,
    $headers,
    '-f' . $cfg['MAIL_FROM']
);

if (!$sent) {
    error_log('MBT contact form: mail() failed for ' . $email);
    respond(false, 'Sorry, the message could not be sent. Please call (705) 644-3980.', 500);
}

$hits[] = $now;
@file_put_contents($rlFile, implode(',', $hits), LOCK_EX);

respond(true);
