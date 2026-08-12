<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_employee_details', function (Blueprint $table) {
            $table->foreignId('demand_id')->nullable()->after('job_category_id')
                ->constrained('demands')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('candidate_employee_details', function (Blueprint $table) {
            $table->dropConstrainedForeignId('demand_id');
        });
    }
};
