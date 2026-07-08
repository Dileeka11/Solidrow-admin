<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SectionAssignment extends Model
{
    protected $fillable = [
        'section_no',
        'staff_id',
        'staff_ids',
    ];

    protected $casts = [
        'staff_ids' => 'array',
    ];
}
