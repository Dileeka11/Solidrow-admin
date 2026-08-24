<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A demand only becomes real once a candidate passes the final test, so the
 * demand now lives with the final-test details on candidate_training rather than
 * on candidate_employee_details (the registration side). This moves the column
 * and copies any existing values across so old data stays filterable by demand.
 *
 * As with the original demand_id column, we deliberately add no DB-level FK
 * (the live host rejects it, errno 150); integrity stays at the app layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('candidate_training', 'demand_id')) {
            Schema::table('candidate_training', function (Blueprint $table) {
                $table->unsignedBigInteger('demand_id')->nullable()->after('final_test_agent');
            });
        }

        // Carry existing demand assignments over to the matching training row.
        if (Schema::hasColumn('candidate_employee_details', 'demand_id')) {
            $rows = DB::table('candidate_employee_details')
                ->whereNotNull('demand_id')
                ->get(['candidate_id', 'demand_id']);

            foreach ($rows as $row) {
                DB::table('candidate_training')->updateOrInsert(
                    ['candidate_id' => $row->candidate_id],
                    ['demand_id' => $row->demand_id]
                );
            }

            Schema::table('candidate_employee_details', function (Blueprint $table) {
                $table->dropColumn('demand_id');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('candidate_employee_details', 'demand_id')) {
            Schema::table('candidate_employee_details', function (Blueprint $table) {
                $table->unsignedBigInteger('demand_id')->nullable()->after('job_category_id');
            });
        }

        if (Schema::hasColumn('candidate_training', 'demand_id')) {
            $rows = DB::table('candidate_training')
                ->whereNotNull('demand_id')
                ->get(['candidate_id', 'demand_id']);

            foreach ($rows as $row) {
                DB::table('candidate_employee_details')->updateOrInsert(
                    ['candidate_id' => $row->candidate_id],
                    ['demand_id' => $row->demand_id]
                );
            }

            Schema::table('candidate_training', function (Blueprint $table) {
                $table->dropColumn('demand_id');
            });
        }
    }
};
