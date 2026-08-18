<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Supplier Payment / Invoice — final document of the procure-to-pay flow, with
 * 3-way matching (PO ↔ GRN ↔ Invoice). No DB-level foreign keys (host rejects).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_invoices', function (Blueprint $table) {
            $table->id();
            $table->string('internal_ref_no', 30)->unique();
            $table->string('supplier_invoice_no', 100)->nullable();
            $table->date('invoice_date');
            $table->unsignedBigInteger('po_id')->nullable()->index();
            $table->json('grn_ids')->nullable();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->date('due_date')->nullable();
            $table->string('currency', 10)->default('LKR');
            $table->string('attached_document')->nullable();
            $table->enum('status', [
                'Draft', 'Pending Matching', 'Matched', 'Disputed', 'Approved for Payment', 'Paid',
            ])->default('Draft');
            $table->timestamps();
        });

        Schema::create('supplier_invoice_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('invoice_id')->index();
            $table->unsignedBigInteger('po_item_id')->nullable();
            $table->string('description');
            $table->decimal('quantity_invoiced', 15, 2)->default(0);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('tax_pct', 5, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_invoice_items');
        Schema::dropIfExists('supplier_invoices');
    }
};
