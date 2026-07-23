<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            // Person/agent who conducted the final test (manually entered).
            // Pre-test agents live per-cycle inside the pre_test_cycles JSON.
            $table->string('final_test_agent', 191)->nullable()->after('final_test_result');
        });
    }

    public function down(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            $table->dropColumn('final_test_agent');
        });
    }
};
