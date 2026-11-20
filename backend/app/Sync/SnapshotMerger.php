<?php

namespace App\Sync;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Merges a candidate snapshot (from another PC or from the hub) into THIS
 * database. Used by the hub when a node pushes, and by a node when it pulls.
 *
 * Rules
 *  - Candidate matched by registration_no; local ids are never copied.
 *  - Per row, the newer `updated_at` wins (candidate row, each one-row section
 *    table, each candidate_sections row by section_no).
 *  - Progress only moves forward: current_section = max, is_completed = OR.
 *  - Rows missing from the snapshot are kept (nothing is deleted by a merge).
 *  - Remarks are unioned (history is append-only).
 *  - Writes use the query builder, so no model events fire (no echo pushes).
 */
class SnapshotMerger
{
    /** Foreign keys that must exist here; otherwise nulled + reported. */
    private const FOREIGN_KEYS = [
        'candidate_training' => ['pre_test_job_category_id' => 'job_categories', 'demand_id' => 'demands'],
        'candidate_employee_details' => ['job_category_id' => 'job_categories'],
    ];

    private const REMARK_KEY = ['section_no', 'status', 'reason', 'created_by', 'created_at'];

    /** @var array<string,array<int,string>> */
    private array $columns = [];

    /** @var array<int,string> */
    public array $warnings = [];

    /**
     * @return int local candidate id
     * @throws \Illuminate\Database\QueryException on unique conflicts (NIC, passport…)
     */
    public function apply(array $snapshot): int
    {
        return DB::transaction(function () use ($snapshot) {
            $candidateId = $this->mergeCandidate($snapshot['candidate']);

            foreach (CandidateSnapshot::SINGLE_TABLES as $key => $table) {
                if (is_array($snapshot[$key] ?? null) && $snapshot[$key]) {
                    $this->mergeRow($table, $snapshot[$key], ['candidate_id' => $candidateId]);
                }
            }

            foreach ((array) ($snapshot['sections'] ?? []) as $section) {
                if (is_array($section) && isset($section['section_no'])) {
                    $this->mergeRow('candidate_sections', $section, [
                        'candidate_id' => $candidateId,
                        'section_no' => (int) $section['section_no'],
                    ]);
                }
            }

            $this->mergeRemarks($candidateId, (array) ($snapshot['remarks'] ?? []));

            return $candidateId;
        });
    }

    public function deleteByRegistrationNo(string $registrationNo): int
    {
        // Child rows go with it (ON DELETE CASCADE).
        return DB::table('candidates')->where('registration_no', $registrationNo)->delete();
    }

    private function mergeCandidate(array $incoming): int
    {
        $row = $this->prepare('candidates', $incoming);
        $existing = DB::table('candidates')->where('registration_no', $incoming['registration_no'])->first();

        if (! $existing) {
            return (int) DB::table('candidates')->insertGetId($row);
        }

        $existing = (array) $existing;
        $update = $this->isNewer($row, $existing) ? $row : [];

        // Section progress only moves forward, whichever side is newer.
        foreach (['current_section', 'is_completed'] as $col) {
            if (array_key_exists($col, $row) && array_key_exists($col, $existing)) {
                $merged = max((int) $row[$col], (int) $existing[$col]);
                if ($merged !== (int) $existing[$col] || $update) {
                    $update[$col] = $merged;
                }
            }
        }

        if ($update) {
            DB::table('candidates')->where('id', $existing['id'])->update($update);
        }

        return (int) $existing['id'];
    }

    /** Insert, or overwrite when the incoming row is newer. */
    private function mergeRow(string $table, array $incoming, array $match): void
    {
        $row = array_merge($this->prepare($table, $incoming), $match);

        $existing = DB::table($table)->where($match)->first();

        if (! $existing) {
            DB::table($table)->insert($row);
        } elseif ($this->isNewer($row, (array) $existing)) {
            DB::table($table)->where('id', $existing->id)->update($row);
        }
    }

    private function mergeRemarks(int $candidateId, array $remarks): void
    {
        $have = DB::table('candidate_remarks')->where('candidate_id', $candidateId)->get()
            ->map(fn ($r) => $this->remarkKey((array) $r))
            ->flip();

        foreach ($remarks as $remark) {
            if (! is_array($remark) || $have->has($key = $this->remarkKey($remark))) {
                continue;
            }
            $row = $this->prepare('candidate_remarks', $remark);
            $row['candidate_id'] = $candidateId;
            DB::table('candidate_remarks')->insert($row);
            $have->put($key, true);
        }
    }

    private function remarkKey(array $r): string
    {
        return json_encode(array_map(fn ($k) => isset($r[$k]) ? (string) $r[$k] : null, self::REMARK_KEY));
    }

    private function isNewer(array $incoming, array $existing): bool
    {
        return (string) ($incoming['updated_at'] ?? '') > (string) ($existing['updated_at'] ?? '');
    }

    /**
     * Keep only columns this DB has, drop ids, null foreign keys whose target
     * row is missing here.
     */
    private function prepare(string $table, array $data): array
    {
        $this->columns[$table] ??= Schema::getColumnListing($table);

        unset($data['id'], $data['candidate_id']);
        $row = array_intersect_key($data, array_flip($this->columns[$table]));

        foreach (self::FOREIGN_KEYS[$table] ?? [] as $column => $refTable) {
            $value = $row[$column] ?? null;
            if ($value !== null && ! DB::table($refTable)->where('id', $value)->exists()) {
                $this->warnings[] = "{$table}.{$column}={$value} not found in {$refTable}; saved as NULL";
                $row[$column] = null;
            }
        }

        foreach ($row as $column => $value) {
            if (is_array($value)) { // JSON columns should arrive as strings
                $row[$column] = json_encode($value);
            }
        }

        return $row;
    }
}
