<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_departure_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();

            // Section 6 — Departure Details
            $table->date('final_approval_date')->nullable();
            $table->string('receipt_number')->nullable();
            $table->string('flight_number')->nullable();
            $table->string('airticket_number')->nullable();
            $table->date('departure_date')->nullable();

            $table->timestamps();

            $table->unique('candidate_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_departure_details');
    }
};
