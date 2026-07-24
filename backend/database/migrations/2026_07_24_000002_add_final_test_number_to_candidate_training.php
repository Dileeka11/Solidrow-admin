<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            // Test number issued for the final test (e.g. TI004). Pre-test numbers
            // now live per-cycle inside the pre_test_cycles JSON (test_number key).
            $table->string('final_test_number', 30)->nullable()->after('final_test_result');
        });
    }

    public function down(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            $table->dropColumn('final_test_number');
        });
    }
};
