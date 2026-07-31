<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

// TEMPORARY — add the passport-return columns from the browser when there is no
// terminal/DB access on the host. Idempotent: it only adds what is missing and does
// NOT invoke the full migrator (so it can't trip over other pending migrations).
// Open /__migrate/<token> once, confirm "OK", then DELETE this route and redeploy.
Route::get('/__migrate/{token}', function (string $token) {
    abort_unless(hash_equals('sldrw-passport-return-2026', $token), 403);

    try {
        $out = [];

        if (! Schema::hasColumn('candidates', 'passport_returned')) {
            DB::statement('ALTER TABLE `candidates` ADD COLUMN `passport_returned` VARCHAR(255) NULL AFTER `passport_image`');
            $out[] = 'added column passport_returned';
        } else {
            $out[] = 'passport_returned already exists';
        }

        if (! Schema::hasColumn('candidates', 'passport_return_date')) {
            DB::statement('ALTER TABLE `candidates` ADD COLUMN `passport_return_date` DATE NULL AFTER `passport_returned`');
            $out[] = 'added column passport_return_date';
        } else {
            $out[] = 'passport_return_date already exists';
        }

        // Record the migration as applied so a future `php artisan migrate` won't re-run it.
        $name = '2026_07_31_000001_add_passport_return_to_candidates';
        if (! DB::table('migrations')->where('migration', $name)->exists()) {
            DB::table('migrations')->insert([
                'migration' => $name,
                'batch' => (int) DB::table('migrations')->max('batch') + 1,
            ]);
            $out[] = 'migration record inserted';
        } else {
            $out[] = 'migration record already present';
        }

        return response('<pre>OK' . "\n" . e(implode("\n", $out)) . '</pre>');
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
