<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * TEMPORARY migration runner — this host gives no terminal and no DB access, so
 * the pending migration is run over HTTPS instead.
 *
 *   GET /deploy-migrate/{token}        → migrate:status (read-only)
 *   GET /deploy-migrate/{token}/check  → schema facts (read-only)
 *   GET /deploy-migrate/{token}/run    → runs ONLY the Test Details migration
 *
 * `run` is deliberately pinned to one file: this database was largely built from
 * SQL dumps, so several older migrations sit "Pending" while their columns may
 * already exist. A blanket `migrate --force` would try those first and abort.
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

    // Read-only: does the schema already carry what the older "Pending"
    // migrations would add, and how do the section rows currently look?
    Route::get('/deploy-migrate/{token}/check', function (string $token) use ($migrateToken) {
        abort_unless(hash_equals($migrateToken, $token), 404);

        $columns = [
            'candidate_documents.police_report_expire_date',
            'candidate_documents.police_report_reminder_stage',
            'candidate_training.test_agent',
            'candidate_training.final_test_number',
            'candidate_training.demand_id',
            'candidates.candidate_skill',
        ];

        $lines = ['-- columns --'];
        foreach ($columns as $ref) {
            [$table, $column] = explode('.', $ref);
            $lines[] = sprintf('%-60s %s', $ref, Schema::hasColumn($table, $column) ? 'EXISTS' : 'MISSING');
        }

        $lines[] = '';
        $lines[] = '-- tables --';
        foreach (['test_number_counters', 'agents', 'demands'] as $table) {
            $lines[] = sprintf('%-60s %s', $table, Schema::hasTable($table) ? 'EXISTS' : 'MISSING');
        }

        $lines[] = '';
        $lines[] = '-- candidate_sections by section_no --';
        foreach (DB::table('candidate_sections')->selectRaw('section_no, COUNT(*) AS rows_count')
            ->groupBy('section_no')->orderBy('section_no')->get() as $row) {
            $lines[] = sprintf('section %-3s %s rows', $row->section_no, $row->rows_count);
        }

        return response('<pre style="font:13px/1.5 monospace">'.e(implode("\n", $lines)).'</pre>');
    });

    Route::get('/deploy-migrate/{token}/run', function (string $token) use ($migrateToken, $runArtisan) {
        abort_unless(hash_equals($migrateToken, $token), 404);

        $response = $runArtisan('migrate', [
            '--force' => true,
            '--path' => 'database/migrations/2026_08_24_000002_insert_test_details_section.php',
        ]);
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
