<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CandidateSection extends Model
{
    protected $fillable = [
        'candidate_id',
        'section_no',
        'assigned_staff_id',
        'assigned_staff_ids',
        'status',
        'submitted_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'assigned_staff_ids' => 'array',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function assignedStaff()
    {
        return $this->belongsTo(Staff::class, 'assigned_staff_id');
    }
}
