<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('module');                // Dashboard, Staff, Roles, Permissions
            $table->string('action');                // view, add, edit, delete
            $table->string('label');                 // e.g. "Staff · View"
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['module', 'action']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('permissions');
    }
};
