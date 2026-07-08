<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_training', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();

            // pre_test | final_test | both
            $table->string('training_mode', 20)->nullable();

            // JSON array of pre-test cycles:
            // [{ cycle_no, attendance_dates: string[], test_date, test_result: pass|fail|null }]
            $table->json('pre_test_cycles')->nullable();

            // Final test
            $table->json('final_test_attendance_dates')->nullable(); // array of date strings
            $table->date('final_test_date')->nullable();
            $table->string('final_test_result', 10)->nullable(); // pass | fail

            $table->timestamps();

            $table->unique('candidate_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_training');
    }
};
