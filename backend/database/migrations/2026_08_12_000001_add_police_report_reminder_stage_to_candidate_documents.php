<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Track which multi-stage Police Report reminder has been sent so a candidate
 * receives at most one SMS per stage (45, 30, then 14 days before expiry).
 * The value stores the last-sent stage in "days before expiry" (45/30/14),
 * and is reset to null whenever the expiry date changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->unsignedSmallInteger('police_report_reminder_stage')
                ->nullable()
                ->after('police_report_expiry_sms_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->dropColumn('police_report_reminder_stage');
        });
    }
};
