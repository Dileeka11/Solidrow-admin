<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Financial Year (Fiscal Year) table.
 *
 * Schema confirmed by the user:
 *   CREATE TABLE financial_years (
 *       id         INT PRIMARY KEY AUTO_INCREMENT,
 *       year_name  VARCHAR(20)  NOT NULL,
 *       start_date DATE         NOT NULL,
 *       end_date   DATE         NOT NULL,
 *       is_active  BOOLEAN      DEFAULT FALSE
 *   );
 *
 * Seed: (1, '2026/2027', '2026-04-01', '2027-03-31', 1)
 *
 * No DB-level FK constraints — the live host rejects them (errno 150).
 * Integrity is enforced at the app layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_years', function (Blueprint $table) {
            $table->id();
            $table->string('year_name', 20);
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        // Seed the first financial year as confirmed by user.
        DB::table('financial_years')->insert([
            'year_name'  => '2026/2027',
            'start_date' => '2026-04-01',
            'end_date'   => '2027-03-31',
            'is_active'  => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_years');
    }
};
