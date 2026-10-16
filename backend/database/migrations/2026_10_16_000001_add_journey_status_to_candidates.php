<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Manually-selected overseas journey status, shown as a colour on the
     * candidate list, form and preview. Null = not set yet.
     */
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->string('journey_status')->nullable()->after('status_changed_at'); // in_process | departed | cancelled
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropColumn('journey_status');
        });
    }
};
