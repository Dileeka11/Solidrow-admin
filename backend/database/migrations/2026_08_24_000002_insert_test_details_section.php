<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * "Test Details" (Pre Test + Final Test) splits out of Training Details and
     * becomes its own Section 3, pushing everything below it down by one.
     *
     * Old → New: 1→1, 2→2, 3→4, 4→5, 5→6, 6→7, and a brand-new 3.
     *
     * The new section 3 inherits section 2's staff and submitted state, because the
     * test work used to live inside Training Details — a candidate who had finished
     * Training Details had already finished the tests.
     */
    public function up(): void
    {
        DB::transaction(function () {
            $this->shift([6 => 7, 5 => 6, 4 => 5, 3 => 4]);

            // Global staffing for the new section mirrors Training Details.
            $training = DB::table('section_assignments')->where('section_no', 2)->first();
            if ($training) {
                DB::table('section_assignments')->insert([
                    'section_no' => 3,
                    'staff_ids' => $training->staff_ids,
                    'staff_id' => $training->staff_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Per-candidate row for the new section, copied from Training Details.
            $rows = DB::table('candidate_sections')->where('section_no', 2)->get();
            foreach ($rows as $row) {
                DB::table('candidate_sections')->insert([
                    'candidate_id' => $row->candidate_id,
                    'section_no' => 3,
                    'assigned_staff_ids' => $row->assigned_staff_ids,
                    'assigned_staff_id' => $row->assigned_staff_id,
                    'status' => $row->status,
                    'submitted_at' => $row->submitted_at,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Everyone past Training Details moves one step down the new ladder.
            DB::table('candidates')->where('current_section', '>=', 3)
                ->update(['current_section' => DB::raw('current_section + 1')]);
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            DB::table('candidate_sections')->where('section_no', 3)->delete();
            DB::table('section_assignments')->where('section_no', 3)->delete();

            $this->shift([4 => 3, 5 => 4, 6 => 5, 7 => 6]);

            DB::table('candidates')->where('current_section', '>=', 4)
                ->update(['current_section' => DB::raw('current_section - 1')]);
        });
    }

    /**
     * Renumber sections one at a time, in an order that never collides with an
     * existing row (both tables carry a unique constraint on section_no).
     *
     * @param  array<int,int>  $map  old section_no → new section_no
     */
    private function shift(array $map): void
    {
        foreach (['candidate_sections', 'section_assignments'] as $table) {
            foreach ($map as $from => $to) {
                DB::table($table)->where('section_no', $from)->update(['section_no' => $to]);
            }
        }
    }
};
