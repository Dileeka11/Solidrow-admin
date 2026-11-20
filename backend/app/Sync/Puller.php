<?php

namespace App\Sync;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/** Node side: bring hub changes (other PCs + live site) into this PC's DB. */
class Puller
{
    /** @var array<int,string> */
    public array $problems = [];

    public function __construct(private LiveClient $hub)
    {
    }

    /** Pull changed candidates since the stored cursor. Returns how many applied. */
    public function pullChanges(): int
    {
        $applied = 0;

        for ($i = 0; $i < 50; $i++) { // bounded per run; the next run continues
            $cursor = (int) SyncState::get('changes_cursor', '0');
            $page = $this->hub->changes($cursor);

            foreach ($page['items'] ?? [] as $item) {
                $applied += $this->applyItem($item) ? 1 : 0;
            }

            SyncState::put('changes_cursor', (string) ($page['cursor'] ?? $cursor));

            if (empty($page['items']) || ($page['cursor'] ?? $cursor) <= $cursor) {
                break;
            }
        }

        return $applied;
    }

    /** First-time download of every candidate on the hub. */
    public function pullAll(?callable $progress = null): int
    {
        $applied = 0;
        $afterId = 0;
        $cursor = null;

        do {
            $page = $this->hub->allCandidates($afterId);
            $cursor ??= (int) ($page['cursor'] ?? 0); // change-log position before the listing

            foreach ($page['items'] ?? [] as $item) {
                $applied += $this->applyItem($item) ? 1 : 0;
            }
            $progress && $progress($applied);
            $afterId = $page['next'] ?? null;
        } while ($afterId);

        // Changes made while we were listing are picked up by the next pullChanges().
        SyncState::put('changes_cursor', (string) $cursor);

        return $applied;
    }

    /** Replace this PC's copy of the hub-owned master tables. */
    public function pullMasters(): void
    {
        $tables = $this->hub->masters();
        $allowed = config('sync.master_tables');

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        try {
            DB::transaction(function () use ($tables, $allowed) {
                foreach ($tables as $table => $rows) {
                    if (! in_array($table, $allowed, true) || ! Schema::hasTable($table)) {
                        continue;
                    }
                    $columns = array_flip(Schema::getColumnListing($table));
                    DB::table($table)->delete();
                    foreach (array_chunk((array) $rows, 200) as $chunk) {
                        DB::table($table)->insert(array_map(
                            fn ($row) => array_intersect_key((array) $row, $columns),
                            $chunk
                        ));
                    }
                }
            });
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        SyncState::put('masters_pulled_at', now()->toDateTimeString());
    }

    public function mastersDue(): bool
    {
        $last = SyncState::get('masters_pulled_at');

        return ! $last || now()->diffInMinutes($last, true) >= config('sync.masters_every_minutes');
    }

    private function applyItem(array $item): bool
    {
        $regNo = (string) ($item['registration_no'] ?? '');
        if ($regNo === '') {
            return false;
        }

        $merger = new SnapshotMerger();

        if (! empty($item['deleted'])) {
            return $merger->deleteByRegistrationNo($regNo) > 0;
        }

        $snapshot = $item['snapshot'] ?? null;
        if (! is_array($snapshot)) {
            return false;
        }

        try {
            $this->downloadMissingFiles($snapshot);
            $merger->apply($snapshot);
        } catch (QueryException $e) {
            // e.g. same NIC registered for a different person on this PC.
            $this->problems[] = "{$regNo}: " . $e->getMessage();
            Log::warning('sync: pulled candidate not applied', ['registration_no' => $regNo, 'error' => $e->getMessage()]);

            return false;
        }

        if ($merger->warnings) {
            Log::warning('sync: pulled candidate applied with warnings', ['registration_no' => $regNo, 'warnings' => $merger->warnings]);
        }

        return true;
    }

    private function downloadMissingFiles(array $snapshot): void
    {
        $disk = Storage::disk('public');

        foreach (CandidateSnapshot::filePaths($snapshot) as $path) {
            if ($disk->exists($path)) {
                continue;
            }
            $disk->makeDirectory(dirname($path));
            try {
                $this->hub->downloadFile($path, $disk->path($path));
            } catch (\Throwable $e) {
                @unlink($disk->path($path));
                Log::warning('sync: file download failed', ['path' => $path, 'error' => $e->getMessage()]);
            }
        }
    }
}
