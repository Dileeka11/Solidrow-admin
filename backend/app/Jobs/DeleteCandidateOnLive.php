<?php

namespace App\Jobs;

use App\Sync\LiveClient;
use App\Sync\PermanentSyncException;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

/** Remove a candidate (matched by registration_no) from the live server. */
class DeleteCandidateOnLive implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 0;

    public function __construct(public string $registrationNo)
    {
        $this->onQueue(config('sync.queue'));
    }

    public function retryUntil(): \DateTimeInterface
    {
        return now()->addHours(config('sync.retry_hours'));
    }

    public function backoff(): array
    {
        return [10, 30, 60, 120, 300];
    }

    public function handle(LiveClient $live): void
    {
        try {
            $live->deleteCandidate($this->registrationNo);
        } catch (PermanentSyncException $e) {
            $this->fail($e);
        }
    }

    public function failed(?\Throwable $e): void
    {
        Log::error('sync: candidate delete failed permanently', [
            'registration_no' => $this->registrationNo,
            'error' => $e?->getMessage(),
        ]);
    }
}
