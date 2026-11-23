<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Some databases (the live one, built from a SQL dump, and staff PCs restored
 * from it) are missing candidate_training columns that earlier migrations were
 * recorded as having added. Saving Test Details then fails with an SQL error as
 * soon as one of those fields (e.g. the final-test Agent) is sent. Add whatever
 * is missing; never touch a column that is already there.
 */
return new class extends Migration
{
    public function up(): void
    {
        $columns = [
            'training_mode'            => fn (Blueprint $t) => $t->string('training_mode', 20)->nullable(),
            'training_bond'            => fn (Blueprint $t) => $t->string('training_bond')->nullable(),
            'pre_test_job_category_id' => fn (Blueprint $t) => $t->unsignedBigInteger('pre_test_job_category_id')->nullable(),
            'pre_test_number'          => fn (Blueprint $t) => $t->string('pre_test_number', 30)->nullable(),
            'pre_test_cycles'          => fn (Blueprint $t) => $t->json('pre_test_cycles')->nullable(),
            'final_test_attendance_records' => fn (Blueprint $t) => $t->json('final_test_attendance_records')->nullable(),
            'final_test_date'          => fn (Blueprint $t) => $t->date('final_test_date')->nullable(),
            'final_test_result'        => fn (Blueprint $t) => $t->string('final_test_result', 10)->nullable(),
            'final_test_number'        => fn (Blueprint $t) => $t->string('final_test_number', 30)->nullable(),
            'final_test_agent'         => fn (Blueprint $t) => $t->string('final_test_agent', 191)->nullable(),
            'demand_id'                => fn (Blueprint $t) => $t->unsignedBigInteger('demand_id')->nullable(),
        ];

        foreach ($columns as $name => $define) {
            if (! Schema::hasColumn('candidate_training', $name)) {
                Schema::table('candidate_training', fn (Blueprint $t) => $define($t));
            }
        }
    }

    public function down(): void
    {
        // Nothing to undo: these columns belong to earlier migrations.
    }
};
