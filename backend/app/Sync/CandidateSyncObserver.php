<?php

namespace App\Sync;

use App\Jobs\DeleteCandidateOnLive;
use App\Jobs\PushCandidateToLive;
use App\Models\Candidate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Watches Candidate and every candidate child model.
 *  - node: queue a push of that candidate to the hub
 *  - hub:  log the change so nodes pull it (edits made on the live site)
 *
 * Sync writes themselves use the query builder, so they never reach here.
 */
class CandidateSyncObserver
{
    public function saved(Model $model): void
    {
        $this->changed($model instanceof Candidate ? $model->id : $model->candidate_id, $model);
    }

    public function deleted(Model $model): void
    {
        if ($model instanceof Candidate) {
            $regNo = $model->registration_no;
            $this->safely(function () use ($regNo) {
                if (Sync::isNode()) {
                    DeleteCandidateOnLive::dispatch($regNo)->afterCommit();
                } elseif (Sync::isHub()) {
                    DB::afterCommit(fn () => ChangeLog::record($regNo, true));
                }
            });

            return;
        }

        $this->changed($model->candidate_id, $model);
    }

    private function changed(mixed $candidateId, Model $model): void
    {
        if (! $candidateId) {
            return;
        }

        $this->safely(function () use ($candidateId, $model) {
            if (Sync::isNode()) {
                PushCandidateToLive::dispatch((int) $candidateId)
                    ->delay(now()->addSeconds(config('sync.delay_seconds')))
                    ->afterCommit();
            } elseif (Sync::isHub()) {
                $regNo = $model instanceof Candidate
                    ? $model->registration_no
                    : DB::table('candidates')->where('id', $candidateId)->value('registration_no');
                // After commit: the log table may be created on first use (DDL).
                DB::afterCommit(fn () => ChangeLog::record($regNo));
            }
        });
    }

    /** Sync must never break the user's save — log and carry on. */
    private function safely(callable $fn): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            Log::error('sync: could not record candidate change', ['error' => $e->getMessage()]);
        }
    }
}
