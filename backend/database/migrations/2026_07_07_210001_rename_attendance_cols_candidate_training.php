<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            $table->renameColumn('final_test_attendance_dates', 'final_test_attendance_records');
        });
    }

    public function down(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            $table->renameColumn('final_test_attendance_records', 'final_test_attendance_dates');
        });
    }
};
