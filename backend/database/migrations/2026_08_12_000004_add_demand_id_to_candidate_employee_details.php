<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add the demand_id column. We intentionally do NOT add a DB-level foreign
     * key: the live host rejects the FK constraint (errno 150), and referential
     * integrity is already enforced at the app layer (`exists:demands,id`
     * validation in CandidateEmployeeDetailController). Idempotent so it records
     * cleanly even where the column was already added by a partial earlier run.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('candidate_employee_details', 'demand_id')) {
            Schema::table('candidate_employee_details', function (Blueprint $table) {
                $table->unsignedBigInteger('demand_id')->nullable()->after('job_category_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('candidate_employee_details', 'demand_id')) {
            Schema::table('candidate_employee_details', function (Blueprint $table) {
                $table->dropColumn('demand_id');
            });
        }
    }
};
