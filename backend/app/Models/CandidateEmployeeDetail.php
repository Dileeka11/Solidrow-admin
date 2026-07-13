<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CandidateEmployeeDetail extends Model
{
    protected $table = 'candidate_employee_details';

    protected $fillable = [
        'candidate_id',
        'registration_number',
        'job_category_id',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function jobCategory()
    {
        return $this->belongsTo(JobCategory::class);
    }
}
