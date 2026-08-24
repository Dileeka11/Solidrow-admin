<?php

namespace App\Http\Controllers;

/**
 * Public endpoint powering the mobile app's in-app update flow.
 *
 * The app compares its installed build number against `latest_build` and, when
 * older, downloads `apk_url` and launches the Android package installer.
 */
class AppVersionController extends Controller
{
    public function show()
    {
        // APK ships in the public/ tree (deployed with the code), served as a
        // static file straight from the web root.
        $path = trim((string) config('appversion.apk_path'), '/');

        // Only advertise a download URL when the APK is actually present, so a
        // half-configured release can't push users into a broken download.
        $apkUrl = $path && file_exists(public_path($path))
            ? url($path)
            : null;

        return response()->json([
            'latest_version' => (string) config('appversion.latest_version'),
            'latest_build' => (int) config('appversion.latest_build'),
            'apk_url' => $apkUrl,
            'force_update' => (bool) config('appversion.force_update'),
            'notes' => (string) config('appversion.notes'),
        ]);
    }
}
