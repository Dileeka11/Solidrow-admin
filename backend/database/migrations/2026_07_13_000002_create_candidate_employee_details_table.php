<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_employee_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();

            // Registration number — defaults to the candidate reg no but editable locally.
            $table->string('registration_number')->nullable();

            // Job category — from the managed job_categories list.
            $table->foreignId('job_category_id')->nullable()->constrained('job_categories')->nullOnDelete();

            $table->timestamps();

            $table->unique('candidate_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_employee_details');
    }
};
