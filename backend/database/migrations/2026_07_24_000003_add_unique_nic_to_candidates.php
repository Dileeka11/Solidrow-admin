<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Normalise blank NICs to NULL so they don't collide under the unique index.
        DB::table('candidates')->where('nic', '')->update(['nic' => null]);

        Schema::table('candidates', function (Blueprint $table) {
            // NULLs are allowed to repeat; only real NIC values must be unique.
            $table->unique('nic');
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropUnique(['nic']);
        });
    }
};
