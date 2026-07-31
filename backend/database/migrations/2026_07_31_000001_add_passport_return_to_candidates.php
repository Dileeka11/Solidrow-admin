<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            // Passport hand-back: recorded separately once the retained passport is
            // returned to the candidate (the retention fields above stay locked).
            $table->string('passport_returned')->nullable()->after('passport_image');   // yes | no
            $table->date('passport_return_date')->nullable()->after('passport_returned');
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropColumn(['passport_returned', 'passport_return_date']);
        });
    }
};
