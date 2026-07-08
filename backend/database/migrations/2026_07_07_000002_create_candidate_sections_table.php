<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per section (1..8) per candidate. Each section is assigned to a
     * staff member up front; a section becomes editable only once the previous
     * one has been submitted (sequential hand-off).
     */
    public function up(): void
    {
        Schema::create('candidate_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->unsignedTinyInteger('section_no');            // 1..8
            $table->foreignId('assigned_staff_id')->nullable();   // staff.id
            $table->string('status')->default('pending');         // pending | submitted
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['candidate_id', 'section_no']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_sections');
    }
};
