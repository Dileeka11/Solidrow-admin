<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

/**
 * TEMPORARY migration runner — this host gives no terminal and no DB access, so
 * pending migrations are run over HTTPS instead.
 *
 *   GET /deploy-migrate/{token}      → migrate:status (read-only — check first)
 *   GET /deploy-migrate/{token}/run  → migrate --force
 *
 * Set the token below back to '' and push again the moment the migration has
 * run: with an empty token no route is registered at all.
 */
$migrateToken = (string) env('DEPLOY_MIGRATE_TOKEN', '70d45a3590edec6f9064f12187a209bf1c6d8c0f912ed482');

if ($migrateToken !== '') {
    $runArtisan = function (string $command, array $options = []) {
        Artisan::call($command, $options);

        return response('<pre style="font:13px/1.5 monospace">'.e(Artisan::output()).'</pre>');
    };

    Route::get('/deploy-migrate/{token}', function (string $token) use ($migrateToken, $runArtisan) {
        abort_unless(hash_equals($migrateToken, $token), 404);

        return $runArtisan('migrate:status');
    });

    Route::get('/deploy-migrate/{token}/run', function (string $token) use ($migrateToken, $runArtisan) {
        abort_unless(hash_equals($migrateToken, $token), 404);

        $response = $runArtisan('migrate', ['--force' => true]);
        Artisan::call('config:clear');

        return $response;
    });
}

// Serve uploaded files (passport photos, training bonds, documents) from the
// public storage disk. Works without a `storage` symlink — important on hosting
// where the Laravel public/ folder is merged into the web root and the name
// `storage` is already taken by the framework storage directory.
Route::get('/media/{path}', function (string $path) {
    abort_unless(Storage::disk('public')->exists($path), 404);

    return response()->file(Storage::disk('public')->path($path));
})->where('path', '.*');

// Serve the built React SPA for every non-API path (deep links included).
// /api/* and /up are handled by their own routes; real files (assets, images)
// are served directly by the web server before reaching Laravel.
Route::get('/{any?}', function () {
    return response(file_get_contents(public_path('index.html')));
})->where('any', '^(?!api|up|storage|media|deploy-migrate).*$');
