<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Drop-off / progress remarks. One row per remark so a candidate keeps a
     * full history: they may stall, get a "dropped" remark, later come back
     * (a "resumed" remark), and every reason stays on record.
     */
    public function up(): void
    {
        Schema::create('candidate_remarks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->unsignedTinyInteger('section_no')->nullable();   // step they stalled at
            $table->string('status');                                 // dropped | on_hold | resumed
            $table->text('reason');
            $table->foreignId('created_by')->nullable();              // users.id
            $table->timestamps();

            $table->index('candidate_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_remarks');
    }
};
