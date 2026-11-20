<?php

namespace App\Console\Commands;

use App\Sync\Puller;
use App\Sync\Sync;
use Illuminate\Console\Command;

/**
 * Staff PC: download changes from the live hub.
 *
 *   php artisan sync:pull           changed candidates (+ master data when due)
 *   php artisan sync:pull --full    first install: master data + every candidate
 *
 * Runs every minute from the scheduler (see routes/console.php).
 */
class SyncPull extends Command
{
    protected $signature = 'sync:pull
        {--full : Download master data and every candidate (first install)}
        {--masters : Refresh master data now}';

    protected $description = 'Pull candidate changes and master data from the live hub';

    public function handle(Puller $puller): int
    {
        if (! Sync::isNode()) {
            $this->error('This install is not a staff PC (set SYNC_ROLE=node in .env).');

            return self::FAILURE;
        }

        try {
            if ($this->option('full') || $this->option('masters') || $puller->mastersDue()) {
                $this->line('Master data…');
                $puller->pullMasters();
            }

            if ($this->option('full')) {
                $this->line('All candidates…');
                $count = $puller->pullAll(fn ($n) => $this->output->write("\r  {$n} candidates"));
                $this->newLine();
                $this->info("Downloaded {$count} candidate(s).");
            }

            $changed = $puller->pullChanges();
            $this->info("Applied {$changed} change(s) from the live server.");
        } catch (\Throwable $e) {
            // Offline is normal for a staff PC; the next run tries again.
            $this->warn('Live server not reachable: ' . $e->getMessage());

            return self::SUCCESS;
        }

        foreach ($puller->problems as $problem) {
            $this->warn('Not applied: ' . $problem);
        }

        return self::SUCCESS;
    }
}
