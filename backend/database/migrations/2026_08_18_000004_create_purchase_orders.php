<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Purchase Order (PO) — second document of the procure-to-pay flow. A PO can
 * consolidate one or more approved PRs. Line items track ordered vs received
 * quantities. No DB-level foreign keys (host rejects them).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_number', 30)->unique();
            $table->date('po_date');
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->text('delivery_address')->nullable();
            $table->string('payment_terms', 50)->nullable();      // Net 30, Advance, COD…
            $table->string('currency', 10)->default('LKR');
            $table->date('expected_delivery_date')->nullable();
            $table->json('source_pr_ids')->nullable();            // consolidated PRs
            $table->enum('status', [
                'Draft', 'Pending Approval', 'Approved', 'Sent to Supplier',
                'Partially Received', 'Fully Received', 'Closed', 'Cancelled',
            ])->default('Draft');
            $table->timestamps();
        });

        Schema::create('po_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('po_id')->index();
            $table->string('description');
            $table->unsignedBigInteger('category_id')->nullable();
            $table->decimal('quantity_ordered', 15, 2)->default(0);
            $table->string('uom', 30)->nullable();
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('discount_pct', 5, 2)->default(0);
            $table->decimal('tax_pct', 5, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);
            $table->decimal('quantity_received', 15, 2)->default(0); // updated by GRNs
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('po_items');
        Schema::dropIfExists('purchase_orders');
    }
};
