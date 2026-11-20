<?php

namespace App\Sync;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Node-side key/value store: pull cursor, last master refresh, … */
class SyncState
{
    public const TABLE = 'sync_state';

    private static bool $ready = false;

    private static function ensureTable(): void
    {
        if (self::$ready) {
            return;
        }
        if (! Schema::hasTable(self::TABLE)) {
            Schema::create(self::TABLE, function (Blueprint $table) {
                $table->string('key')->primary();
                $table->text('value')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        }
        self::$ready = true;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        self::ensureTable();

        return DB::table(self::TABLE)->where('key', $key)->value('value') ?? $default;
    }

    public static function put(string $key, ?string $value): void
    {
        self::ensureTable();

        DB::table(self::TABLE)->updateOrInsert(['key' => $key], ['value' => $value, 'updated_at' => now()]);
    }
}
