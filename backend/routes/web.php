<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

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
