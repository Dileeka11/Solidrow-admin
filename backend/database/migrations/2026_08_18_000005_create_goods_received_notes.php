<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Goods Received Note (GRN) — third document of the procure-to-pay flow.
 * Records what actually arrived against a PO. On confirmation the PO's received
 * quantities and status are updated. No DB-level foreign keys (host rejects).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goods_received_notes', function (Blueprint $table) {
            $table->id();
            $table->string('grn_number', 30)->unique();
            $table->date('grn_date');
            $table->unsignedBigInteger('po_id')->index();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->string('delivery_note_no', 100)->nullable();  // supplier waybill ref
            $table->string('received_by')->nullable();
            $table->string('warehouse', 100)->nullable();
            $table->enum('status', ['Draft', 'Confirmed', 'Partially Matched', 'Fully Matched'])
                ->default('Draft');
            $table->timestamps();
        });

        Schema::create('grn_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('grn_id')->index();
            $table->unsignedBigInteger('po_item_id')->nullable();
            $table->string('description');
            $table->decimal('quantity_ordered', 15, 2)->default(0);
            $table->decimal('quantity_received', 15, 2)->default(0);
            $table->decimal('quantity_accepted', 15, 2)->default(0);
            $table->decimal('quantity_rejected', 15, 2)->default(0);
            $table->string('rejection_reason')->nullable();
            $table->string('batch_serial_no', 100)->nullable();
            $table->string('condition', 30)->nullable();          // Good / Damaged / Short Shipped
            $table->string('remarks')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grn_items');
        Schema::dropIfExists('goods_received_notes');
    }
};
