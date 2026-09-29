<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Current progress state, cached on the candidate for fast list filtering
     * and status badges. The full reason history lives in candidate_remarks.
     */
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->string('progress_status')->default('active')->after('is_completed'); // active | on_hold | dropped | completed
            $table->timestamp('status_changed_at')->nullable()->after('progress_status');
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropColumn(['progress_status', 'status_changed_at']);
        });
    }
};
