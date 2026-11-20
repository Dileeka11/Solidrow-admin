<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Candidate sync bookkeeping. Both tables are also created on first use
 * (App\Sync\ChangeLog / SyncState), since the live host has no terminal.
 *   sync_changes — hub: log of candidate changes the PCs pull
 *   sync_state   — node: pull cursor and timers
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sync_changes')) {
            Schema::create('sync_changes', function (Blueprint $table) {
                $table->id();
                $table->string('registration_no')->index();
                $table->boolean('deleted')->default(false);
                $table->string('station', 20)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('sync_state')) {
            Schema::create('sync_state', function (Blueprint $table) {
                $table->string('key')->primary();
                $table->text('value')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_changes');
        Schema::dropIfExists('sync_state');
    }
};
