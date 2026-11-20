<?php

namespace App\Sync;

use App\Jobs\DeleteCandidateOnLive;
use App\Jobs\PushCandidateToLive;
use App\Models\Candidate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Watches Candidate and every candidate child model. Any change queues a push
 * of that one candidate to the live server (local install only).
 */
class CandidateSyncObserver
{
    public function saved(Model $model): void
    {
        $this->queuePush($model instanceof Candidate ? $model->id : $model->candidate_id);
    }

    public function deleted(Model $model): void
    {
        if ($model instanceof Candidate) {
            $this->safely(fn () => DeleteCandidateOnLive::dispatch($model->registration_no)->afterCommit());

            return;
        }

        $this->queuePush($model->candidate_id);
    }

    private function queuePush(mixed $candidateId): void
    {
        if (! $candidateId) {
            return;
        }

        $this->safely(fn () => PushCandidateToLive::dispatch((int) $candidateId)
            ->delay(now()->addSeconds(config('sync.delay_seconds')))
            ->afterCommit());
    }

    /** Sync must never break a registration — log and carry on. */
    private function safely(callable $dispatch): void
    {
        try {
            $dispatch();
        } catch (\Throwable $e) {
            Log::error('sync: could not queue candidate push', ['error' => $e->getMessage()]);
        }
    }
}
