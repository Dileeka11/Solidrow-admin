<?php

namespace App\Console\Commands;

use App\Jobs\PushCandidateToLive;
use App\Models\Candidate;
use Illuminate\Console\Command;

/**
 * Queue a push of existing candidates to the live server — for the first
 * hand-over, or to re-send anything that failed while offline.
 *
 *   php artisan sync:push-candidates                 (all)
 *   php artisan sync:push-candidates --since=2026-11-01
 *   php artisan sync:push-candidates --id=12 --id=15
 */
class SyncPushCandidates extends Command
{
    protected $signature = 'sync:push-candidates
        {--id=* : Only these candidate ids}
        {--since= : Only candidates updated on/after this date}';

    protected $description = 'Queue Local → Live sync pushes for existing candidates';

    public function handle(): int
    {
        if (config('sync.target_url') === '' || config('sync.token') === '') {
            $this->error('Set SYNC_TARGET_URL and SYNC_TOKEN in .env first.');

            return self::FAILURE;
        }

        $query = Candidate::query()->select('id')->orderBy('id');

        if ($ids = $this->option('id')) {
            $query->whereIn('id', array_map('intval', $ids));
        }
        if ($since = $this->option('since')) {
            $query->where('updated_at', '>=', $since);
        }

        $count = 0;
        $query->chunkById(200, function ($candidates) use (&$count) {
            foreach ($candidates as $candidate) {
                PushCandidateToLive::dispatch($candidate->id);
                $count++;
            }
        });

        $this->info("Queued {$count} candidate(s) on the '" . config('sync.queue') . "' queue.");
        $this->line('Make sure a worker is running:  php artisan queue:work --queue=' . config('sync.queue'));

        return self::SUCCESS;
    }
}
