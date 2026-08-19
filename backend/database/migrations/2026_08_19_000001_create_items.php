<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Item master file — the catalogue of items pulled onto PR / PO lines.
 * As with the other procurement masters, no DB-level foreign keys are declared
 * (the live host rejects them, errno 150); integrity is enforced in the app.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->string('item_code', 50)->nullable()->unique();
            $table->string('name');
            $table->unsignedBigInteger('category_id')->nullable()->index();
            $table->string('uom', 30)->nullable();
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->string('description')->nullable();
            $table->enum('status', ['Active', 'Inactive'])->default('Active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
