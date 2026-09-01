<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sales Invoices table — customer-facing invoices (income side).
 *
 * Differs from supplier_invoices (expense side).
 * Journal entries are auto-generated on save via SalesInvoiceController.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number', 30)->unique();     // e.g. INV-2026-001
            $table->unsignedBigInteger('financial_year_id')->nullable()->index();
            $table->date('invoice_date');
            $table->date('due_date')->nullable();
            $table->string('customer_name', 150);               // plain text (no Customer Master yet)
            $table->string('customer_phone', 30)->nullable();
            $table->string('customer_address', 500)->nullable();
            $table->string('payment_method', 20)->default('cash_in_hand'); // cash_in_hand | bank
            $table->unsignedBigInteger('payment_account_id')->nullable()->index(); // FK → accounts
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);
            $table->string('currency', 10)->default('LKR');
            $table->string('notes', 500)->nullable();
            $table->enum('status', ['Draft', 'Issued', 'Paid', 'Cancelled'])->default('Draft');
            $table->unsignedBigInteger('journal_entry_id')->nullable()->index(); // FK → journal_entries
            $table->timestamps();
        });

        Schema::create('sales_invoice_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('invoice_id')->index();
            $table->string('description', 255);
            $table->decimal('quantity', 10, 2)->default(1);
            $table->string('uom', 20)->nullable();
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('tax_pct', 5, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_invoice_items');
        Schema::dropIfExists('sales_invoices');
    }
};
