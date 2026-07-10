<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CandidateVisaDetail extends Model
{
    protected $table = 'candidate_visa_details';

    /** Date fields, grouped by the country whose workflow they belong to. */
    public const ROMANIA_DATES = [
        'offer_letter_date',
        'confirmation_letter_date',
        'document_submission_date',
        'work_permit_received_date',
        'embassy_submission_date',
        'police_report_issued_date',
        'process_interview_date',
        'visa_received_date',
    ];

    public const ISRAEL_DATES = [
        'agreement_sign_date',
        'police_report_date',
    ];

    public const COMMON_DATES = [
        'visa_status_date',
    ];

    protected $fillable = [
        'candidate_id',
        // Romania
        'offer_letter_date',
        'confirmation_letter_date',
        'document_submission_date',
        'work_permit_received_date',
        'embassy_submission_date',
        'police_report_issued_date',
        'process_interview_date',
        'visa_received_date',
        // Israel
        'agreement_sign_date',
        'police_report_date',
        // Common
        'visa_status',
        'visa_status_date',
        'piba_submission_status',
    ];

    protected $casts = [
        'offer_letter_date'         => 'date',
        'confirmation_letter_date'  => 'date',
        'document_submission_date'  => 'date',
        'work_permit_received_date' => 'date',
        'embassy_submission_date'   => 'date',
        'police_report_issued_date' => 'date',
        'process_interview_date'    => 'date',
        'visa_received_date'        => 'date',
        'agreement_sign_date'       => 'date',
        'police_report_date'        => 'date',
        'visa_status_date'          => 'date',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }
}
