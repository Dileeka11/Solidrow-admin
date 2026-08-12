<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// TEMPORARY — run ONLY this feature's new migrations from the browser when there is
// no terminal/SSH access on the host. The live `migrations` table is out of sync with
// the schema (some old columns exist but were never recorded), so the full migrator
// tries to re-add existing columns and fails. We therefore run each new migration by
// its exact --path, which scopes the run to just that file. Each is applied in order
// and independently; already-applied files are skipped via the `migrations` table.
// Open /__migrate/<token> once, confirm the output, then DELETE this route and redeploy.
Route::get('/__migrate/{token}', function (string $token) {
    abort_unless(hash_equals('57747518ca87f42fa9fccff16a67d942', $token), 403);

    $paths = [
        'database/migrations/2026_08_12_000003_create_demands_table.php',
        'database/migrations/2026_08_12_000004_add_demand_id_to_candidate_employee_details.php',
        'database/migrations/2026_08_12_000002_reorder_candidate_sections.php',
    ];

    $out = [];
    foreach ($paths as $path) {
        try {
            Artisan::call('migrate', ['--force' => true, '--path' => $path]);
            $out[] = "== {$path} ==\n" . trim(Artisan::output());
        } catch (\Throwable $e) {
            $out[] = "== {$path} ==\nERROR: " . $e->getMessage();
        }
    }

    return response('<pre>' . e(implode("\n\n", $out)) . '</pre>');
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
