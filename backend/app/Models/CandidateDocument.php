<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CandidateDocument extends Model
{
    protected $table = 'candidate_documents';

    /** Attachment fields that hold a single stored file path. */
    public const FILE_FIELDS = [
        'passport_size_photo',
        'nic_color_copy',
        'passport_color_copy',
        'professional_certificate',
        'cv_copy',
    ];

    /** Attachment fields that hold a JSON array of stored file paths. */
    public const MULTI_FILE_FIELDS = [
        'working_experience',
    ];

    /**
     * Attachment fields that hold a JSON array of { path, uploaded_at } entries.
     * Re-uploads append to the history instead of overwriting the previous file.
     */
    public const DATED_MULTI_FILE_FIELDS = [
        'police_certificate',
        'certified_police_report',
    ];

    protected $fillable = [
        'candidate_id',
        'passport_size_photo',
        'nic_color_copy',
        'passport_color_copy',
        'professional_certificate',
        'working_experience',
        'cv_copy',
        'police_certificate',
        'certified_police_report',
        'police_report_expire_date',
        'police_report_expiry_sms_sent_at',
        'document_submission_date',
        'document_resubmission_date',
    ];

    protected $casts = [
        'working_experience'               => 'array',
        'police_certificate'               => 'array',
        'certified_police_report'          => 'array',
        'police_report_expire_date'        => 'date',
        'police_report_expiry_sms_sent_at' => 'datetime',
        'document_submission_date'         => 'date',
        'document_resubmission_date'       => 'date',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }
}
