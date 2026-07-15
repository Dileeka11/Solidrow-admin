<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Replace the single-file police-report attachments (local_pcc / 2nd PCC color
 * copy) and their standalone dates with two multi-file, history-keeping
 * attachment fields:
 *   - police_certificate         → Police Certificate Attachment
 *   - certified_police_report    → Certified (Foreign Ministry) Police Report
 * Each holds a JSON array of { path, uploaded_at } entries so re-uploads add to
 * the history instead of overwriting the previous file. A new
 * document_resubmission_date joins the existing document_submission_date.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->text('police_certificate')->nullable()->after('cv_copy');
            $table->text('certified_police_report')->nullable()->after('police_certificate');
            $table->date('document_resubmission_date')->nullable()->after('document_submission_date');
        });

        // Carry existing single files (and their dates) forward as the first
        // entry of each new attachment history.
        foreach (DB::table('candidate_documents')->get() as $row) {
            $update = [];

            if (! empty($row->local_pcc)) {
                $update['police_certificate'] = json_encode([[
                    'path'        => $row->local_pcc,
                    'uploaded_at' => $this->uploadedAt($row->local_pcc_attach_date, $row->created_at),
                ]]);
            }

            if (! empty($row->second_pcc_color_copy)) {
                $update['certified_police_report'] = json_encode([[
                    'path'        => $row->second_pcc_color_copy,
                    'uploaded_at' => $this->uploadedAt($row->second_pcc_submit_date, $row->created_at),
                ]]);
            }

            if ($update) {
                DB::table('candidate_documents')->where('id', $row->id)->update($update);
            }
        }

        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->dropColumn([
                'local_pcc',
                'second_pcc_color_copy',
                'local_pcc_attach_date',
                'second_pcc_submit_date',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->string('local_pcc')->nullable()->after('cv_copy');
            $table->string('second_pcc_color_copy')->nullable()->after('local_pcc');
            $table->date('local_pcc_attach_date')->nullable();
            $table->date('second_pcc_submit_date')->nullable();
        });

        // Collapse the histories back to their first file + date.
        foreach (DB::table('candidate_documents')->get() as $row) {
            $police = json_decode($row->police_certificate ?? '[]', true) ?: [];
            $certified = json_decode($row->certified_police_report ?? '[]', true) ?: [];
            $update = [];

            if (isset($police[0]['path'])) {
                $update['local_pcc'] = $police[0]['path'];
                $update['local_pcc_attach_date'] = $police[0]['uploaded_at'] ?? null;
            }
            if (isset($certified[0]['path'])) {
                $update['second_pcc_color_copy'] = $certified[0]['path'];
                $update['second_pcc_submit_date'] = $certified[0]['uploaded_at'] ?? null;
            }
            if ($update) {
                DB::table('candidate_documents')->where('id', $row->id)->update($update);
            }
        }

        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->dropColumn([
                'police_certificate',
                'certified_police_report',
                'document_resubmission_date',
            ]);
        });
    }

    /** Best available upload date as Y-m-d: the recorded date, else created_at, else today. */
    private function uploadedAt($date, $createdAt): string
    {
        $value = $date ?: $createdAt;

        return $value ? substr((string) $value, 0, 10) : now()->toDateString();
    }
};
