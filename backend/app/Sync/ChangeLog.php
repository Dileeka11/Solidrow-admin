<?php

namespace App\Sync;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Hub-side log of candidate changes. Nodes pull "everything after id N".
 * One row per change; a delete row is the tombstone other PCs act on.
 */
class ChangeLog
{
    public const TABLE = 'sync_changes';

    private static bool $ready = false;

    /**
     * The live host has no terminal, so the table is created on first use
     * when the migration has not been run there.
     */
    public static function ensureTable(): void
    {
        if (self::$ready) {
            return;
        }
        if (! Schema::hasTable(self::TABLE)) {
            Schema::create(self::TABLE, function (Blueprint $table) {
                $table->id();
                $table->string('registration_no')->index();
                $table->boolean('deleted')->default(false);
                $table->string('station', 20)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }
        self::$ready = true;
    }

    public static function record(?string $registrationNo, bool $deleted = false, ?string $station = null): void
    {
        if (! $registrationNo) {
            return;
        }
        self::ensureTable();

        DB::table(self::TABLE)->insert([
            'registration_no' => $registrationNo,
            'deleted' => $deleted,
            'station' => $station,
            'created_at' => now(),
        ]);
    }

    public static function lastId(): int
    {
        self::ensureTable();

        return (int) DB::table(self::TABLE)->max('id');
    }

    /** When was this candidate last deleted on the hub (if ever)? */
    public static function deletedAt(string $registrationNo): ?string
    {
        self::ensureTable();

        $last = DB::table(self::TABLE)->where('registration_no', $registrationNo)->orderByDesc('id')->first();

        return $last && $last->deleted ? (string) $last->created_at : null;
    }

    /**
     * Changes after $afterId: distinct registration numbers, latest state each.
     *
     * @return array{cursor:int, items:array<int,array>}
     */
    public static function since(int $afterId, int $limit = 100): array
    {
        self::ensureTable();

        $rows = DB::table(self::TABLE)->where('id', '>', $afterId)->orderBy('id')->limit($limit)->get();
        if ($rows->isEmpty()) {
            return ['cursor' => $afterId, 'items' => []];
        }

        $items = [];
        foreach ($rows->pluck('registration_no')->unique() as $regNo) {
            $snapshot = CandidateSnapshot::buildByRegistrationNo($regNo);
            $items[] = $snapshot
                ? ['registration_no' => $regNo, 'deleted' => false, 'snapshot' => $snapshot]
                : ['registration_no' => $regNo, 'deleted' => true];
        }

        return ['cursor' => (int) $rows->last()->id, 'items' => $items];
    }
}
