<?php

namespace App\Sync;

/** Small helpers for reading the sync role. */
class Sync
{
    public static function isHub(): bool
    {
        return config('sync.role') === 'hub' && config('sync.token') !== '';
    }

    public static function isNode(): bool
    {
        return config('sync.role') === 'node';
    }
}
