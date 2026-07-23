<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add a manually-entered Police Report expiry date plus a marker for the
 * 45-days-before reminder SMS so it is only sent once per candidate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->date('police_report_expire_date')->nullable()->after('certified_police_report');
            $table->timestamp('police_report_expiry_sms_sent_at')->nullable()->after('police_report_expire_date');
        });
    }

    public function down(): void
    {
        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->dropColumn(['police_report_expire_date', 'police_report_expiry_sms_sent_at']);
        });
    }
};
