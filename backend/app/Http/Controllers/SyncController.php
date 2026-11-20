<?php

namespace App\Http\Controllers;

use App\Sync\CandidateSnapshot;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * LIVE side of the Local → Live candidate sync.
 *
 * Receives one candidate at a time and upserts only that candidate's rows
 * (matched by registration_no). Nothing else in the live DB is touched.
 * Writes use the query builder, so no model events fire here.
 */
class SyncController extends Controller
{
    /** Foreign keys that must exist on live; otherwise they are nulled + reported. */
    private const FOREIGN_KEYS = [
        'training'  => ['pre_test_job_category_id' => 'job_categories', 'demand_id' => 'demands'],
        'employee'  => ['job_category_id' => 'job_categories'],
    ];

    /** @var array<string,array<int,string>> */
    private array $columns = [];

    /** @var array<int,string> */
    private array $warnings = [];

    public function checkFiles(Request $request)
    {
        $data = $request->validate([
            'paths' => ['required', 'array', 'max:500'],
            'paths.*' => ['string', 'max:500'],
        ]);

        $disk = Storage::disk('public');
        $missing = array_values(array_filter(
            $data['paths'],
            fn ($p) => CandidateSnapshot::isAllowedPath($p) && ! $disk->exists($p)
        ));

        return response()->json(['missing' => $missing]);
    }

    public function storeFile(Request $request)
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:500'],
            'file' => ['required', 'file', 'max:51200'],
        ]);

        abort_unless(CandidateSnapshot::isAllowedPath($data['path']), 422, 'Path not allowed.');

        Storage::disk('public')->putFileAs(
            dirname($data['path']),
            $request->file('file'),
            basename($data['path'])
        );

        return response()->json(['ok' => true]);
    }

    public function upsertCandidate(Request $request)
    {
        // Raw body on purpose: the global TrimStrings / ConvertEmptyStringsToNull
        // middleware would otherwise alter the values copied from the local DB.
        $payload = json_decode($request->getContent(), true);

        if (! is_array($payload)
            || ! is_array($payload['candidate'] ?? null)
            || ! is_string($payload['candidate']['registration_no'] ?? null)
            || $payload['candidate']['registration_no'] === '') {
            return response()->json(['message' => 'candidate.registration_no is required.'], 422);
        }

        try {
            $candidateId = DB::transaction(fn () => $this->applySnapshot($payload));
        } catch (QueryException $e) {
            // e.g. NIC / passport already used by a different candidate on live.
            return response()->json([
                'message' => 'Live DB rejected the candidate: ' . $e->getMessage(),
            ], 409);
        }

        return response()->json([
            'ok' => true,
            'candidate_id' => $candidateId,
            'warnings' => $this->warnings,
        ]);
    }

    public function deleteCandidate(Request $request)
    {
        $data = $request->validate([
            'registration_no' => ['required', 'string', 'max:255'],
        ]);

        // Child rows go with it (ON DELETE CASCADE).
        $deleted = DB::table('candidates')->where('registration_no', $data['registration_no'])->delete();

        return response()->json(['ok' => true, 'deleted' => $deleted]);
    }

    private function applySnapshot(array $payload): int
    {
        $regNo = $payload['candidate']['registration_no'];

        // ── candidates ────────────────────────────────────────────────────
        $row = $this->prepare('candidates', $payload['candidate'], 'candidate');
        $existingId = DB::table('candidates')->where('registration_no', $regNo)->value('id');

        if ($existingId) {
            DB::table('candidates')->where('id', $existingId)->update($row);
            $candidateId = (int) $existingId;
        } else {
            $candidateId = (int) DB::table('candidates')->insertGetId($row);
        }

        // ── one-row-per-candidate tables ──────────────────────────────────
        foreach (CandidateSnapshot::SINGLE_TABLES as $key => $table) {
            $data = $payload[$key] ?? null;
            $query = DB::table($table)->where('candidate_id', $candidateId);

            if (! is_array($data) || ! $data) {
                $query->delete();
                continue;
            }

            $row = $this->prepare($table, $data, $key);
            $row['candidate_id'] = $candidateId;

            if ((clone $query)->exists()) {
                $query->update($row);
            } else {
                DB::table($table)->insert($row);
            }
        }

        // ── sections: keyed by section_no ─────────────────────────────────
        $sectionNos = [];
        foreach ((array) ($payload['sections'] ?? []) as $section) {
            if (! is_array($section) || ! isset($section['section_no'])) {
                continue;
            }
            $row = $this->prepare('candidate_sections', $section, 'sections');
            $row['candidate_id'] = $candidateId;
            $sectionNos[] = (int) $section['section_no'];

            DB::table('candidate_sections')->updateOrInsert(
                ['candidate_id' => $candidateId, 'section_no' => (int) $section['section_no']],
                $row
            );
        }
        DB::table('candidate_sections')
            ->where('candidate_id', $candidateId)
            ->when($sectionNos, fn ($q) => $q->whereNotIn('section_no', $sectionNos))
            ->delete();

        // ── remarks: mirror the full history ─────────────────────────────
        DB::table('candidate_remarks')->where('candidate_id', $candidateId)->delete();
        foreach ((array) ($payload['remarks'] ?? []) as $remark) {
            if (! is_array($remark)) {
                continue;
            }
            $row = $this->prepare('candidate_remarks', $remark, 'remarks');
            $row['candidate_id'] = $candidateId;
            DB::table('candidate_remarks')->insert($row);
        }

        return $candidateId;
    }

    /**
     * Keep only columns that exist on live, drop local ids, and null any
     * foreign key whose target row is missing on live.
     */
    private function prepare(string $table, array $data, string $key): array
    {
        $this->columns[$table] ??= Schema::getColumnListing($table);

        unset($data['id'], $data['candidate_id']);
        $row = array_intersect_key($data, array_flip($this->columns[$table]));

        foreach (self::FOREIGN_KEYS[$key] ?? [] as $column => $refTable) {
            $value = $row[$column] ?? null;
            if ($value !== null && ! DB::table($refTable)->where('id', $value)->exists()) {
                $this->warnings[] = "{$table}.{$column}={$value} not found in live {$refTable}; saved as NULL";
                $row[$column] = null;
            }
        }

        foreach ($row as $column => $value) {
            if (is_array($value)) { // defensive: JSON columns should arrive as strings
                $row[$column] = json_encode($value);
            }
        }

        return $row;
    }
}
