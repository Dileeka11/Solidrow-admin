<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Purchase Requisition (PR) — the first document of the procure-to-pay flow.
 * A PR has a header and repeatable line items. No DB-level foreign keys (the
 * live host rejects them); integrity is enforced in the app layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_requisitions', function (Blueprint $table) {
            $table->id();
            $table->string('pr_number', 30)->unique();
            $table->date('pr_date');
            $table->string('requested_by')->nullable();      // logged-in user's name
            $table->unsignedBigInteger('department_id')->nullable();
            $table->enum('priority', ['Normal', 'Urgent', 'Critical'])->default('Normal');
            $table->date('required_date')->nullable();
            $table->text('purpose')->nullable();
            $table->unsignedBigInteger('budget_account_id')->nullable(); // cost center / budget code
            $table->enum('status', ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Converted to PO'])
                ->default('Draft');
            $table->timestamps();
        });

        Schema::create('pr_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('pr_id')->index();
            $table->string('description');
            $table->unsignedBigInteger('category_id')->nullable();
            $table->decimal('quantity', 15, 2)->default(0);
            $table->string('uom', 30)->nullable();
            $table->decimal('est_unit_price', 15, 2)->default(0);
            $table->decimal('est_total', 15, 2)->default(0);
            $table->unsignedBigInteger('preferred_supplier_id')->nullable();
            $table->string('remarks')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pr_items');
        Schema::dropIfExists('purchase_requisitions');
    }
};
