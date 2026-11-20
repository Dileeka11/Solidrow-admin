<?php

/*
|--------------------------------------------------------------------------
| Candidate registration sync (Local → Live)
|--------------------------------------------------------------------------
|
| Candidates are registered on a LOCAL install. Every create / update /
| delete of a candidate (or any of its sections) is queued and pushed to the
| LIVE server, which upserts ONLY that candidate's rows. The live database is
| never replaced.
|
| LOCAL install (.env):
|   SYNC_PUSH_ENABLED=true
|   SYNC_TARGET_URL=https://registration.solidrow.lk/api/sync
|   SYNC_TOKEN=<same secret as live>
|   and keep a worker running:  php artisan queue:work --queue=sync
|
| LIVE install (.env):
|   SYNC_PUSH_ENABLED=false
|   SYNC_RECEIVE_TOKEN=<same secret as local>
|
*/

return [

    // Local side: push candidate changes to the live server.
    'push_enabled' => (bool) env('SYNC_PUSH_ENABLED', false),

    // Base URL of the live sync API (no trailing slash).
    'target_url' => rtrim((string) env('SYNC_TARGET_URL', ''), '/'),

    // Shared secret sent as a Bearer token by the local side.
    'token' => (string) env('SYNC_TOKEN', ''),

    // Live side: accept pushes carrying this token. Empty = endpoints disabled.
    'receive_token' => (string) env('SYNC_RECEIVE_TOKEN', ''),

    // Queue the sync jobs run on.
    'queue' => env('SYNC_QUEUE', 'sync'),

    // While the live server is unreachable, keep retrying for this many hours.
    'retry_hours' => (int) env('SYNC_RETRY_HOURS', 168),

    // Seconds to wait before pushing, so a burst of saves goes as one push.
    'delay_seconds' => (int) env('SYNC_DELAY_SECONDS', 3),

    // Only files under these public-disk folders may be pushed / received.
    'file_dirs' => ['candidates', 'candidate-documents', 'training-bonds'],
];
