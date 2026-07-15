<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            // Trade selected for the pre-test + the generated pre-test number (e.g. TI001).
            $table->foreignId('pre_test_job_category_id')->nullable()->after('training_bond')
                ->constrained('job_categories')->nullOnDelete();
            $table->string('pre_test_number', 30)->nullable()->after('pre_test_job_category_id');
        });
    }

    public function down(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pre_test_job_category_id');
            $table->dropColumn('pre_test_number');
        });
    }
};
