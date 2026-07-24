<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One monotonically-increasing counter per trade code. A number is only
        // ever handed out by incrementing last_number, so a previously issued
        // test number is never reused even if a candidate/cycle is deleted.
        Schema::create('test_number_counters', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->unsignedInteger('last_number')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_number_counters');
    }
};
