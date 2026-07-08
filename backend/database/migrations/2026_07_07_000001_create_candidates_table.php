<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidates', function (Blueprint $table) {
            $table->id();

            // Auto system reference (e.g. SDW/2026/07/07/1/627)
            $table->string('registration_no')->unique();
            // Candidate Reg No (e.g. SDWIT/627) — prefix + manual part
            $table->string('candidate_reg_no')->nullable();

            // Personal details
            $table->string('full_name');                 // name as in passport
            $table->string('address')->nullable();
            $table->string('nic')->nullable();
            $table->string('birth_date')->nullable();
            $table->string('gender')->nullable();

            // Passport
            $table->string('passport_retention')->nullable(); // yes | no
            $table->date('passport_collected_date')->nullable();
            $table->string('passport_number')->nullable();
            $table->string('passport_image')->nullable();     // stored file path

            // Contact
            $table->string('email')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('whatsapp_number')->nullable();

            // Location (free text — this app has no geo tables)
            $table->string('province')->nullable();
            $table->string('district')->nullable();
            $table->string('ds_division')->nullable();
            $table->string('gn_division')->nullable();

            // Coordinator / agent
            $table->string('staff_coordinator')->nullable();
            $table->string('agent')->nullable();
            $table->boolean('other_coordinator')->default(false);
            $table->string('other_coordinator_name')->nullable();
            $table->string('other_coordinator_mobile')->nullable();

            // Placement
            $table->string('country')->nullable();            // Romania | Israel
            $table->string('candidate_skill')->nullable();    // skill | unskill | training
            $table->date('registration_date')->nullable();

            // Workflow
            $table->unsignedInteger('current_section')->default(1);
            $table->boolean('is_completed')->default(false);
            $table->foreignId('created_by')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidates');
    }
};
