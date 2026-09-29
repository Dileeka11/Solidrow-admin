<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CandidateRemark extends Model
{
    protected $fillable = [
        'candidate_id',
        'section_no',
        'status',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'candidate_id' => 'integer',
        'section_no' => 'integer',
        'created_by' => 'integer',
    ];

    protected $appends = ['created_by_name'];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Name of the staff member who added the remark, if resolvable. */
    public function getCreatedByNameAttribute(): ?string
    {
        return $this->createdBy?->name;
    }
}
