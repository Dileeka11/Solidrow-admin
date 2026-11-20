<?php

namespace App\Http\Controllers;

use App\Services\TestNumberService;
use App\Sync\CandidateSnapshot;
use App\Sync\ChangeLog;
use App\Sync\SnapshotMerger;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * HUB (live) side of the candidate sync. Staff PCs push candidate changes
 * here and pull everyone else's. Only candidate rows are written; the merge
 * is per row (newest updated_at wins), see App\Sync\SnapshotMerger.
 */
class SyncController extends Controller
{
    // ── files ────────────────────────────────────────────────────────

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

        Storage::disk('public')->putFileAs(dirname($data['path']), $request->file('file'), basename($data['path']));

        return response()->json(['ok' => true]);
    }

    public function downloadFile(Request $request)
    {
        $path = (string) $request->query('path', '');
        abort_unless(CandidateSnapshot::isAllowedPath($path) && Storage::disk('public')->exists($path), 404);

        return response()->file(Storage::disk('public')->path($path));
    }

    // ── candidates: push in ──────────────────────────────────────────

    public function upsertCandidate(Request $request)
    {
        // Raw body on purpose: the global TrimStrings / ConvertEmptyStringsToNull
        // middleware would otherwise alter values copied from the PC's DB.
        $payload = json_decode($request->getContent(), true);
        $regNo = $payload['candidate']['registration_no'] ?? null;

        if (! is_array($payload) || ! is_array($payload['candidate'] ?? null) || ! is_string($regNo) || $regNo === '') {
            return response()->json(['message' => 'candidate.registration_no is required.'], 422);
        }

        // Deleted here after the PC last edited it → stay deleted.
        $deletedAt = ChangeLog::deletedAt($regNo);
        if ($deletedAt && (string) ($payload['candidate']['updated_at'] ?? '') <= $deletedAt
            && ! DB::table('candidates')->where('registration_no', $regNo)->exists()) {
            return response()->json(['ok' => true, 'skipped' => 'deleted', 'warnings' => []]);
        }

        $merger = new SnapshotMerger();
        try {
            $candidateId = $merger->apply($payload);
        } catch (QueryException $e) {
            // e.g. NIC / passport already used by a different candidate.
            return response()->json(['message' => 'Live DB rejected the candidate: ' . $e->getMessage()], 409);
        }

        ChangeLog::record($regNo, false, $this->station($request));

        return response()->json(['ok' => true, 'candidate_id' => $candidateId, 'warnings' => $merger->warnings]);
    }

    public function deleteCandidate(Request $request)
    {
        $data = $request->validate(['registration_no' => ['required', 'string', 'max:255']]);

        $deleted = (new SnapshotMerger())->deleteByRegistrationNo($data['registration_no']);
        ChangeLog::record($data['registration_no'], true, $this->station($request));

        return response()->json(['ok' => true, 'deleted' => $deleted]);
    }

    // ── candidates: pull out ─────────────────────────────────────────

    public function changes(Request $request)
    {
        return response()->json(ChangeLog::since((int) $request->query('after', 0), 100));
    }

    /** Paged full listing for a PC's first pull. */
    public function allCandidates(Request $request)
    {
        $afterId = (int) $request->query('after_id', 0);
        $ids = DB::table('candidates')->where('id', '>', $afterId)->orderBy('id')->limit(50)->pluck('id');

        $items = [];
        foreach ($ids as $id) {
            if ($snapshot = CandidateSnapshot::build((int) $id)) {
                $items[] = ['registration_no' => $snapshot['candidate']['registration_no'], 'deleted' => false, 'snapshot' => $snapshot];
            }
        }

        return response()->json([
            'cursor' => ChangeLog::lastId(),
            'next' => $ids->count() === 50 ? (int) $ids->last() : null,
            'items' => $items,
        ]);
    }

    public function masters()
    {
        $tables = [];
        foreach (config('sync.master_tables') as $table) {
            if (Schema::hasTable($table)) {
                $tables[$table] = DB::table($table)->get();
            }
        }

        return response()->json(['tables' => $tables]);
    }

    // ── shared counters ──────────────────────────────────────────────

    public function testNumber(Request $request, TestNumberService $numbers)
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:20']]);

        return response()->json(['number' => $numbers->next(strtoupper(trim($data['code'])))]);
    }

    private function station(Request $request): ?string
    {
        $station = trim((string) $request->header('X-Sync-Station', ''));

        return $station === '' ? null : mb_substr($station, 0, 20);
    }
}
