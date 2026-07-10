<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();

            // Stored file paths (public disk) for each attachment.
            $table->string('passport_size_photo')->nullable();      // 826px x 1062px
            $table->string('nic_color_copy')->nullable();
            $table->string('passport_color_copy')->nullable();
            $table->string('professional_certificate')->nullable();
            $table->string('working_experience')->nullable();
            $table->string('cv_copy')->nullable();
            $table->string('local_pcc')->nullable();
            $table->string('second_pcc_color_copy')->nullable();

            // Dates
            $table->date('local_pcc_attach_date')->nullable();
            $table->date('second_pcc_submit_date')->nullable();
            $table->date('document_submission_date')->nullable();

            $table->timestamps();

            $table->unique('candidate_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_documents');
    }
};
