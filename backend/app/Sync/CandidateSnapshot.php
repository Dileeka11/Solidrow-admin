<?php

namespace App\Sync;

use App\Models\CandidateDocument;
use Illuminate\Support\Facades\DB;

/**
 * Builds a full, raw (DB-format) snapshot of one candidate and every row that
 * hangs off it, so the live server can mirror exactly that candidate.
 *
 * Raw rows (not Eloquent attributes) are used on purpose: JSON / date columns
 * travel as their stored strings and are written back verbatim on live.
 */
class CandidateSnapshot
{
    /** One row per candidate (unique candidate_id). */
    public const SINGLE_TABLES = [
        'training'  => 'candidate_training',
        'documents' => 'candidate_documents',
        'visa'      => 'candidate_visa_details',
        'employee'  => 'candidate_employee_details',
        'departure' => 'candidate_departure_details',
    ];

    /** Many rows per candidate. */
    public const MANY_TABLES = [
        'sections' => 'candidate_sections',
        'remarks'  => 'candidate_remarks',
    ];

    public static function build(int $candidateId): ?array
    {
        $candidate = DB::table('candidates')->where('id', $candidateId)->first();
        if (! $candidate) {
            return null;
        }

        $snapshot = ['candidate' => (array) $candidate];

        foreach (self::SINGLE_TABLES as $key => $table) {
            $row = DB::table($table)->where('candidate_id', $candidateId)->first();
            $snapshot[$key] = $row ? (array) $row : null;
        }

        foreach (self::MANY_TABLES as $key => $table) {
            $snapshot[$key] = DB::table($table)
                ->where('candidate_id', $candidateId)
                ->orderBy('id')
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all();
        }

        return $snapshot;
    }

    /**
     * Every public-disk file path the snapshot references.
     *
     * @return array<int,string>
     */
    public static function filePaths(array $snapshot): array
    {
        $paths = [];

        $paths[] = $snapshot['candidate']['passport_image'] ?? null;
        $paths[] = $snapshot['training']['training_bond'] ?? null;

        if ($docs = $snapshot['documents'] ?? null) {
            foreach (CandidateDocument::FILE_FIELDS as $field) {
                $paths[] = $docs[$field] ?? null;
            }
            foreach (CandidateDocument::MULTI_FILE_FIELDS as $field) {
                foreach (self::decodeList($docs[$field] ?? null) as $path) {
                    $paths[] = is_string($path) ? $path : null;
                }
            }
            foreach (CandidateDocument::DATED_MULTI_FILE_FIELDS as $field) {
                foreach (self::decodeList($docs[$field] ?? null) as $entry) {
                    $paths[] = is_array($entry) ? ($entry['path'] ?? null) : (is_string($entry) ? $entry : null);
                }
            }
        }

        return array_values(array_unique(array_filter(
            $paths,
            fn ($p) => is_string($p) && $p !== '' && self::isAllowedPath($p)
        )));
    }

    /** Guard: only plain paths inside the candidate upload folders. */
    public static function isAllowedPath(string $path): bool
    {
        if (str_contains($path, '..') || str_contains($path, '\\') || str_starts_with($path, '/')) {
            return false;
        }

        foreach (config('sync.file_dirs', []) as $dir) {
            if (str_starts_with($path, $dir . '/')) {
                return true;
            }
        }

        return false;
    }

    private static function decodeList(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);

            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }
}
