<?php

/*
|--------------------------------------------------------------------------
| Solidrow Staff App — release metadata
|--------------------------------------------------------------------------
|
| Drives the in-app update flow. The mobile app calls GET /api/app-version on
| launch and compares its own build number against `latest_build`. When the
| installed build is older it downloads the APK at `apk_path` and launches the
| Android installer.
|
| Per release: bump `latest_build` (+ `latest_version`), upload the new APK to
| storage/app/public/app/<file>, and set `force_update` as needed. These read
| from .env so a release can be cut without editing code.
|
*/

return [
    // Human-readable version shown in the update dialog, e.g. "1.1.0".
    'latest_version' => env('APP_LATEST_VERSION', '1.0.5'),

    // Integer build number — the source of truth for "is an update needed?".
    // Must match the `+N` suffix in the Flutter pubspec version (1.0.0+N).
    'latest_build' => (int) env('APP_LATEST_BUILD', 6),

    // APK location under the public/ web root. Served as a static file.
    'apk_path' => env('APP_APK_PATH', 'app/solidrow-staff.apk'),

    // When true the app blocks usage until the user updates.
    'force_update' => filter_var(env('APP_FORCE_UPDATE', true), FILTER_VALIDATE_BOOLEAN),

    // Optional "what's new" note shown in the dialog.
    'notes' => env('APP_UPDATE_NOTES', 'Candidate photo added to the progress screen, plus in-app updates.'),
];
