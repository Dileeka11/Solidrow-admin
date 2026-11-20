<?php

/*
|--------------------------------------------------------------------------
| Candidate sync — many offline PCs ⇄ one live hub
|--------------------------------------------------------------------------
|
| Every staff PC runs its own local copy of the app ("node"). The live server
| is the "hub". Nodes work offline and, whenever they are online:
|
|   push  — each candidate change is queued and sent to the hub
|   pull  — every minute, candidates changed by other PCs (or on the live site)
|           and all master data (users, staff, job categories, …) come down
|
| Merging is per row: for the same row the newest `updated_at` wins, so two
| PCs editing different sections of one candidate never overwrite each other.
| Remarks are merged (union). Only candidate rows are ever touched on the hub —
| the live DB is never replaced.
|
| HUB (live .env):   SYNC_ROLE=hub   SYNC_TOKEN=<secret>
| NODE (each PC):    SYNC_ROLE=node  SYNC_TOKEN=<secret>  SYNC_STATION_CODE=PC1
|                    SYNC_TARGET_URL=https://registration.solidrow.lk/api/sync
|
*/

return [

    // hub | node | off
    'role' => env('SYNC_ROLE', 'off'),

    // Shared secret (Bearer token) — same value on hub and every node.
    'token' => (string) env('SYNC_TOKEN', ''),

    // Node: base URL of the hub's sync API (no trailing slash).
    'target_url' => rtrim((string) env('SYNC_TARGET_URL', ''), '/'),

    // Node: short unique code per PC (PC1, PC2, …). Goes into Registration Nos
    // so two offline PCs can never issue the same number.
    'station_code' => strtoupper(trim((string) env('SYNC_STATION_CODE', ''))),

    // Queue the push jobs run on.
    'queue' => env('SYNC_QUEUE', 'sync'),

    // While the hub is unreachable, keep retrying a push for this many hours.
    'retry_hours' => (int) env('SYNC_RETRY_HOURS', 168),

    // Seconds to wait before pushing, so a burst of saves goes as one push.
    'delay_seconds' => (int) env('SYNC_DELAY_SECONDS', 3),

    // Node: refresh master data at most this often (minutes).
    'masters_every_minutes' => (int) env('SYNC_MASTERS_EVERY', 10),

    // Only files under these public-disk folders are transferred.
    'file_dirs' => ['candidates', 'candidate-documents', 'training-bonds'],

    // Hub-owned master tables mirrored onto every node (ids preserved).
    // Edit these on the live site only.
    'master_tables' => [
        'users',
        'roles',
        'departments',
        'locations',
        'staff',
        'permissions',
        'permission_staff',
        'section_assignments',
        'job_categories',
        'demands',
        'agents',
        'countries',
        'provinces',
    ],
];
