<?php
/**
 * One-off migration runner for no-Terminal cPanel deploys.
 *
 * USAGE (run ONCE, then DELETE this file):
 *   https://registration.solidrow.lk/migrate.php?key=8abdf9214a8477e417a45817d5328d84
 *
 * Runs `php artisan migrate --force` and clears stale caches so newly
 * uploaded routes/controllers take effect. Safe to re-run (migrations
 * only apply once). DELETE THIS FILE after you see "Done".
 */

$SECRET = '8abdf9214a8477e417a45817d5328d84';

if (($_GET['key'] ?? '') !== $SECRET) {
    http_response_code(403);
    exit('Forbidden');
}

header('Content-Type: text/plain; charset=utf-8');

// Works whether Laravel lives in this dir (doc root) or one level up.
$base = is_dir(__DIR__ . '/vendor') ? __DIR__ : __DIR__ . '/..';

require $base . '/vendor/autoload.php';

/** @var \Illuminate\Foundation\Application $app */
$app = require $base . '/bootstrap/app.php';

$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);

echo "=== migrate --force ===\n";
$kernel->call('migrate', ['--force' => true]);
echo $kernel->output();

echo "\n=== clearing stale caches ===\n";
$kernel->call('optimize:clear');
echo $kernel->output();

echo "\n=== Done. DELETE migrate.php now. ===\n";
