<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CandidateTraining extends Model
{
    protected $table = 'candidate_training';

    protected $fillable = [
        'candidate_id',
        'training_mode',
        'training_bond',
        'pre_test_job_category_id',
        'pre_test_number',
        'pre_test_cycles',
        'final_test_attendance_records',
        'final_test_date',
        'final_test_result',
    ];

    protected $casts = [
        'pre_test_cycles'               => 'array',
        'final_test_attendance_records' => 'array',
        'final_test_date'               => 'date',
    ];

    protected $appends = ['training_bond_url'];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function getTrainingBondUrlAttribute(): ?string
    {
        return $this->training_bond
            ? url('media/' . $this->training_bond)
            : null;
    }
}
