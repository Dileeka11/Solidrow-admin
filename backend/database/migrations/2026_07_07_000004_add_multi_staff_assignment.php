<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Move from a single staff member per section to multiple. Each section can
     * now be assigned to a list of staff (stored as a JSON array of staff ids).
     * The old single-value columns are kept nullable for backward safety.
     */
    public function up(): void
    {
        Schema::table('section_assignments', function (Blueprint $table) {
            $table->json('staff_ids')->nullable()->after('staff_id');
        });
        Schema::table('candidate_sections', function (Blueprint $table) {
            $table->json('assigned_staff_ids')->nullable()->after('assigned_staff_id');
        });

        // Backfill: wrap any existing single assignment in a one-element array.
        foreach (DB::table('section_assignments')->get() as $row) {
            DB::table('section_assignments')->where('id', $row->id)->update([
                'staff_ids' => json_encode($row->staff_id ? [(int) $row->staff_id] : []),
            ]);
        }
        foreach (DB::table('candidate_sections')->get() as $row) {
            DB::table('candidate_sections')->where('id', $row->id)->update([
                'assigned_staff_ids' => json_encode($row->assigned_staff_id ? [(int) $row->assigned_staff_id] : []),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('section_assignments', function (Blueprint $table) {
            $table->dropColumn('staff_ids');
        });
        Schema::table('candidate_sections', function (Blueprint $table) {
            $table->dropColumn('assigned_staff_ids');
        });
    }
};
