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
ini_set('display_errors', '1');
error_reporting(E_ALL);

// Works whether Laravel lives in this dir (doc root) or one level up.
$base = is_dir(__DIR__ . '/vendor') ? __DIR__ : __DIR__ . '/..';

require $base . '/vendor/autoload.php';

/** @var \Illuminate\Foundation\Application $app */
$app = require $base . '/bootstrap/app.php';

$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);

try {
    // Run ONLY the demand-move migration. A full `migrate` fails here because the
    // live DB was built from a SQL dump (schema is ahead of the migrations ledger),
    // so older "pending" migrations try to re-add columns that already exist.
    // The migration is idempotent (hasColumn guards) so it's safe if re-run.
    echo "=== migrate (move demand_id to candidate_training, via --path) ===\n";
    $kernel->call('migrate', [
        '--force' => true,
        '--path' => 'database/migrations/2026_08_24_000001_move_demand_id_to_candidate_training.php',
    ]);
    echo $kernel->output();

    echo "\n=== db:seed --force (roles/permissions incl. Baddegama) ===\n";
    $kernel->call('db:seed', ['--force' => true]);
    echo $kernel->output();

    echo "\n=== clearing stale caches ===\n";
    $kernel->call('optimize:clear');
    echo $kernel->output();

    echo "\n=== Done. DELETE migrate.php now. ===\n";
} catch (\Throwable $e) {
    echo "\n!!! ERROR !!!\n";
    echo get_class($e) . ": " . $e->getMessage() . "\n";
    echo $e->getFile() . ":" . $e->getLine() . "\n\n";
    echo $e->getTraceAsString() . "\n";
}
