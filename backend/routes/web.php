<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// TEMPORARY — run pending database migrations from the browser when there is no
// terminal/SSH access on the host. Runs the real Laravel migrator with --force, so
// every pending migration is applied in order (and already-applied ones are skipped
// via the `migrations` table — safe to hit more than once).
// Open /__migrate/<token> once, confirm the output, then DELETE this route and redeploy.
Route::get('/__migrate/{token}', function (string $token) {
    abort_unless(hash_equals('57747518ca87f42fa9fccff16a67d942', $token), 403);

    try {
        Artisan::call('migrate', ['--force' => true]);

        return response('<pre>OK' . "\n" . e(Artisan::output()) . '</pre>');
    } catch (\Throwable $e) {
        return response('<pre>ERROR: ' . e($e->getMessage()) . '</pre>', 500);
    }
});

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
})->where('any', '^(?!api|up|storage|media).*$');
