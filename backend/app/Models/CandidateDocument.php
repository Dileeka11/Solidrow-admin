<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CandidateDocument extends Model
{
    protected $table = 'candidate_documents';

    /** Attachment fields that hold a stored file path. */
    public const FILE_FIELDS = [
        'passport_size_photo',
        'nic_color_copy',
        'passport_color_copy',
        'professional_certificate',
        'working_experience',
        'cv_copy',
        'local_pcc',
        'second_pcc_color_copy',
    ];

    protected $fillable = [
        'candidate_id',
        'passport_size_photo',
        'nic_color_copy',
        'passport_color_copy',
        'professional_certificate',
        'working_experience',
        'cv_copy',
        'local_pcc',
        'second_pcc_color_copy',
        'local_pcc_attach_date',
        'second_pcc_submit_date',
        'document_submission_date',
    ];

    protected $casts = [
        'local_pcc_attach_date'    => 'date',
        'second_pcc_submit_date'   => 'date',
        'document_submission_date' => 'date',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }
}
