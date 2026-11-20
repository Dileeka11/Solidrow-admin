<?php

namespace App\Jobs;

use App\Sync\CandidateSnapshot;
use App\Sync\LiveClient;
use App\Sync\PermanentSyncException;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Push one candidate (with all its sections and files) to the live server.
 *
 * The job snapshots the candidate when it RUNS, so it always sends the latest
 * state; several quick saves collapse into one push (unique per candidate).
 * While the live server is unreachable the job keeps retrying with back-off.
 */
class PushCandidateToLive implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 0; // unlimited — bounded by retryUntil()

    public int $timeout = 300;

    public function __construct(public int $candidateId)
    {
        $this->onQueue(config('sync.queue'));
    }

    public function uniqueId(): string
    {
        return 'candidate-' . $this->candidateId;
    }

    public function retryUntil(): \DateTimeInterface
    {
        return now()->addHours(config('sync.retry_hours'));
    }

    /** Seconds between attempts: quick at first, then every 5 minutes. */
    public function backoff(): array
    {
        return [10, 30, 60, 120, 300];
    }

    public function handle(LiveClient $live): void
    {
        try {
            $this->push($live);
        } catch (PermanentSyncException $e) {
            $this->fail($e);
        }
    }

    private function push(LiveClient $live): void
    {
        $snapshot = CandidateSnapshot::build($this->candidateId);
        if (! $snapshot) {
            return; // deleted meanwhile — the delete job handles live.
        }

        // 1) Upload only the files live doesn't already have.
        $paths = CandidateSnapshot::filePaths($snapshot);
        $missing = $paths ? $live->missingFiles($paths) : [];

        $disk = Storage::disk('public');
        foreach ($missing as $path) {
            if (! CandidateSnapshot::isAllowedPath($path) || ! $disk->exists($path)) {
                Log::warning('sync: local file missing, skipped', ['path' => $path, 'candidate' => $this->candidateId]);
                continue;
            }
            $live->uploadFile($path, $disk->path($path));
        }

        // 2) Upsert the candidate rows.
        $result = $live->pushCandidate($snapshot);

        if (! empty($result['warnings'])) {
            Log::warning('sync: candidate pushed with warnings', [
                'candidate' => $this->candidateId,
                'warnings' => $result['warnings'],
            ]);
        }
    }

    public function failed(?\Throwable $e): void
    {
        Log::error('sync: candidate push failed permanently', [
            'candidate' => $this->candidateId,
            'error' => $e?->getMessage(),
        ]);
    }
}
