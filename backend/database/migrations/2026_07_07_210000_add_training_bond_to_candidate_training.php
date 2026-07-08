<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            $table->string('training_bond')->nullable()->after('training_mode');
        });
    }

    public function down(): void
    {
        Schema::table('candidate_training', function (Blueprint $table) {
            $table->dropColumn('training_bond');
        });
    }
};
