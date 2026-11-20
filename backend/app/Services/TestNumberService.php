<?php

namespace App\Services;

use App\Models\CandidateTraining;
use App\Models\TestNumberCounter;
use App\Sync\LiveClient;
use App\Sync\Sync;
use Illuminate\Support\Facades\DB;

/**
 * Issues test numbers (<trade code><sequence>, e.g. TI001). One running
 * sequence per trade code; a number is never reused.
 *
 * On a staff PC (sync node) the number is reserved on the live hub, so two
 * PCs can never hand out the same number. That needs internet.
 */
class TestNumberService
{
    public function next(string $code): string
    {
        if (Sync::isNode()) {
            return app(LiveClient::class)->reserveTestNumber($code);
        }

        return DB::transaction(function () use ($code) {
            $counter = TestNumberCounter::where('code', $code)->lockForUpdate()->first();

            if (! $counter) {
                $counter = new TestNumberCounter([
                    'code'        => $code,
                    'last_number' => $this->existingMaxSequence($code),
                ]);
            }

            $counter->last_number += 1;
            $counter->save();

            return $code . str_pad((string) $counter->last_number, 3, '0', STR_PAD_LEFT);
        });
    }

    /** Highest sequence already stored for a code across every test-number source. */
    private function existingMaxSequence(string $code): int
    {
        $seq = fn ($value) => $value && str_starts_with((string) $value, $code)
            ? (int) preg_replace('/\D/', '', substr((string) $value, strlen($code)))
            : 0;

        $max = 0;
        foreach (CandidateTraining::all() as $t) {
            $max = max($max, $seq($t->pre_test_number), $seq($t->final_test_number));
            foreach ($t->pre_test_cycles ?? [] as $cycle) {
                $max = max($max, $seq($cycle['test_number'] ?? null));
            }
        }

        return $max;
    }
}
