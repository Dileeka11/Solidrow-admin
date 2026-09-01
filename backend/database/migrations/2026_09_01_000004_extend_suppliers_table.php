<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extend suppliers table with:
 *   - supplier_code   : auto-generated code (SUP-001, SUP-002, …)
 *   - payment_terms   : '30_days' | '60_days' | '90_days' | 'immediate'
 *   - bank_name       : supplier's bank name
 *   - bank_branch     : branch name
 *   - bank_account_no : account number
 *   - notes           : free-text remarks
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('supplier_code', 20)->nullable()->unique()->after('id');
            $table->enum('payment_terms', ['immediate', '30_days', '60_days', '90_days'])
                  ->nullable()->after('address');
            $table->string('bank_name', 100)->nullable()->after('payment_terms');
            $table->string('bank_branch', 100)->nullable()->after('bank_name');
            $table->string('bank_account_no', 50)->nullable()->after('bank_branch');
            $table->text('notes')->nullable()->after('bank_account_no');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn([
                'supplier_code', 'payment_terms',
                'bank_name', 'bank_branch', 'bank_account_no', 'notes',
            ]);
        });
    }
};
