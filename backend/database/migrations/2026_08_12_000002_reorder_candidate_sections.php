<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * "Employee Details" moves from section 6 to section 3, pushing Document
     * Attachment, Job & Visa Processing and Departure Details down by one.
     *
     * Old → New: 1→1, 2→2, 3→4, 4→5, 5→6, 6→3.
     *
     * Both candidate_sections (unique candidate_id+section_no) and
     * section_assignments (unique section_no) are remapped. To avoid tripping the
     * unique constraints mid-remap we first offset every row by +100, then map
     * each offset value down to its final number.
     */
    private const UP = [101 => 1, 102 => 2, 103 => 4, 104 => 5, 105 => 6, 106 => 3];

    private const DOWN = [1 => 101, 2 => 102, 4 => 103, 5 => 104, 6 => 105, 3 => 106];

    public function up(): void
    {
        $this->remap(self::UP);
    }

    public function down(): void
    {
        // Reverse mapping: New → Old (1→1, 2→2, 4→3, 5→4, 6→5, 3→6).
        $this->remap([101 => 1, 102 => 2, 104 => 3, 105 => 4, 106 => 5, 103 => 6]);
    }

    /**
     * @param  array<int,int>  $map  offset value (100+old) → new value
     */
    private function remap(array $map): void
    {
        foreach (['candidate_sections', 'section_assignments'] as $table) {
            // Pass 1: shift everything out of the target range.
            DB::table($table)->update(['section_no' => DB::raw('section_no + 100')]);

            // Pass 2: map each offset value to its final section number.
            foreach ($map as $offset => $final) {
                DB::table($table)->where('section_no', $offset)->update(['section_no' => $final]);
            }
        }
    }
};
