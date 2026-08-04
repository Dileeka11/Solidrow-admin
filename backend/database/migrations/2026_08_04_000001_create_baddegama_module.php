<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Baddegama public registration module.
 *
 * Ports the legacy procedural-PHP feature into this app:
 *   - baddegama_registration  — the public 2-step (OTP) sign-ups + admin call tracking
 *   - countries               — destination countries (FK: destination_country)
 *   - locations               — branch/location the sign-up belongs to (FK: type)
 *   - provinces               — created only if the shared geo table is not already present
 *
 * The country ids are seeded so Romania = 3 and Israel = 4, which the
 * registration-code generator relies on (3 => R, 4 => I, else O).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Shared geo table — the candidate module reads `provinces` from a
        // separately-imported dump. Only create it when missing, and only seed it
        // when it is empty, so we never clobber or duplicate an existing import.
        if (! Schema::hasTable('provinces')) {
            Schema::create('provinces', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->unsignedInteger('queue')->default(0);
            });
        }
        if (DB::table('provinces')->count() === 0) {
            $provinces = [
                'Western', 'Central', 'Southern', 'Northern', 'Eastern',
                'North Western', 'North Central', 'Uva', 'Sabaragamuwa',
            ];
            foreach ($provinces as $i => $name) {
                DB::table('provinces')->insert(['name' => $name, 'queue' => $i + 1]);
            }
        }

        if (! Schema::hasTable('countries')) {
            Schema::create('countries', function (Blueprint $table) {
                $table->id();
                $table->string('code', 10)->nullable();
                $table->string('name');
            });

            // Explicit ids: the reg-code generator maps id 3 => R (Romania),
            // id 4 => I (Israel), everything else => O.
            $countries = [
                1 => ['code' => 'QA', 'name' => 'Qatar'],
                2 => ['code' => 'AE', 'name' => 'United Arab Emirates'],
                3 => ['code' => 'RO', 'name' => 'Romania'],
                4 => ['code' => 'IL', 'name' => 'Israel'],
                5 => ['code' => 'KW', 'name' => 'Kuwait'],
                6 => ['code' => 'SA', 'name' => 'Saudi Arabia'],
                7 => ['code' => 'PL', 'name' => 'Poland'],
                8 => ['code' => 'JP', 'name' => 'Japan'],
            ];
            foreach ($countries as $id => $row) {
                DB::table('countries')->insert(['id' => $id] + $row);
            }
        }

        if (! Schema::hasTable('locations')) {
            Schema::create('locations', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('agent')->nullable();
                $table->boolean('is_active_registration')->default(false);
            });

            DB::table('locations')->insert([
                ['id' => 1, 'name' => 'Head Office', 'agent' => null, 'is_active_registration' => 0],
                ['id' => 2, 'name' => 'Baddegama', 'agent' => null, 'is_active_registration' => 1],
            ]);
        }

        if (Schema::hasTable('baddegama_registration')) {
            return;
        }

        Schema::create('baddegama_registration', function (Blueprint $table) {
            $table->id();
            $table->string('registration_code')->nullable()->index();

            // Personal
            $table->string('full_name');
            $table->string('nic')->nullable();
            $table->string('passport_number')->nullable();
            $table->string('gender')->nullable();          // male | female
            $table->string('marital_status')->nullable();  // single | married
            $table->date('birthday')->nullable();
            $table->unsignedInteger('age')->nullable();

            // Contact
            $table->string('mobile_number')->nullable();
            $table->string('whatsapp_number')->nullable();
            $table->unsignedBigInteger('province_id')->nullable();

            // Job / placement
            $table->string('current_job')->nullable();
            $table->unsignedInteger('experience')->nullable();
            $table->string('job_abroad')->nullable();
            $table->unsignedBigInteger('destination_country')->nullable();
            $table->unsignedBigInteger('type')->nullable(); // FK locations

            // Result / marks
            $table->string('result')->nullable();           // Pass | Pass + Training | Fail
            $table->integer('marks')->nullable();

            // Call center tracking
            $table->string('call_status')->nullable();
            $table->string('employee_status')->nullable();
            $table->text('call_notes')->nullable();
            $table->dateTime('call_date_time')->nullable();

            $table->dateTime('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('baddegama_registration');
        // Master tables (countries/locations/provinces) are intentionally left in
        // place — they may be shared with other features.
    }
};
