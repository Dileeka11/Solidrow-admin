<?php

namespace App\Http\Controllers;

use App\Models\CandidateSection;
use App\Models\SectionAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SectionAssignmentController extends Controller
{
    private const TOTAL_SECTIONS = 4;

    /**
     * Return the current global staff mapping for all sections
     * (missing sections come back as null).
     */
    public function index()
    {
        $map = SectionAssignment::get()->keyBy('section_no');

        $out = [];
        for ($n = 1; $n <= self::TOTAL_SECTIONS; $n++) {
            $out[] = [
                'section_no' => $n,
                'staff_ids' => array_values(array_map('intval', (array) ($map[$n]->staff_ids ?? []))),
            ];
        }

        return $out;
    }

    /**
     * Save the global mapping and push it onto every candidate's
     * not-yet-submitted section rows so it stays consistent.
     */
    public function update(Request $request)
    {
        $raw = $request->input('assignments', []);
        if (is_string($raw)) {
            $raw = json_decode($raw, true) ?: [];
        }

        DB::transaction(function () use ($raw) {
            foreach ((array) $raw as $sectionNo => $staffIds) {
                $n = (int) $sectionNo;
                if ($n < 1 || $n > self::TOTAL_SECTIONS) {
                    continue;
                }
                $ids = $this->cleanIds($staffIds);

                SectionAssignment::updateOrCreate(
                    ['section_no' => $n],
                    [
                        'staff_ids' => $ids,
                        // Mirror the first pick into the legacy single column.
                        'staff_id' => $ids[0] ?? null,
                    ],
                );

                // Keep existing candidates in sync for sections still open.
                CandidateSection::where('section_no', $n)
                    ->where('status', '!=', 'submitted')
                    ->update([
                        'assigned_staff_ids' => json_encode($ids),
                        'assigned_staff_id' => $ids[0] ?? null,
                    ]);
            }
        });

        return $this->index();
    }

    /**
     * Normalise a raw list of staff ids into unique positive integers.
     *
     * @return array<int,int>
     */
    private function cleanIds($raw): array
    {
        if (is_string($raw)) {
            $raw = json_decode($raw, true) ?: [];
        }

        $ids = [];
        foreach ((array) $raw as $id) {
            $id = (int) $id;
            if ($id > 0 && ! in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        return $ids;
    }
}
