<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_visa_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();

            // Romania workflow dates
            $table->date('offer_letter_date')->nullable();
            $table->date('confirmation_letter_date')->nullable();
            $table->date('document_submission_date')->nullable();
            $table->date('work_permit_received_date')->nullable();
            $table->date('embassy_submission_date')->nullable();
            $table->date('police_report_issued_date')->nullable();
            $table->date('process_interview_date')->nullable();
            $table->date('visa_received_date')->nullable();

            // Israel workflow dates
            $table->date('agreement_sign_date')->nullable();
            $table->date('police_report_date')->nullable();

            // Common (both countries)
            $table->string('visa_status')->nullable();          // visa_received | visa_cancel
            $table->date('visa_status_date')->nullable();
            $table->string('piba_submission_status')->nullable(); // submitted | not_yet_submitted

            $table->timestamps();

            $table->unique('candidate_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_visa_details');
    }
};
