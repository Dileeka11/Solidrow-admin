<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Candidate extends Model
{
    protected $fillable = [
        'registration_no',
        'candidate_reg_no',
        'full_name',
        'address',
        'nic',
        'birth_date',
        'gender',
        'passport_retention',
        'passport_collected_date',
        'passport_number',
        'passport_image',
        'email',
        'phone_number',
        'whatsapp_number',
        'province',
        'district',
        'ds_division',
        'gn_division',
        'staff_coordinator',
        'agent',
        'other_coordinator',
        'other_coordinator_name',
        'other_coordinator_mobile',
        'country',
        'candidate_skill',
        'registration_date',
        'current_section',
        'is_completed',
        'created_by',
    ];

    protected $casts = [
        'other_coordinator' => 'boolean',
        'is_completed' => 'boolean',
        'registration_date' => 'date',
        'passport_collected_date' => 'date',
    ];

    protected $appends = ['passport_image_url'];

    public function sections()
    {
        return $this->hasMany(CandidateSection::class)->orderBy('section_no');
    }

    /** Public URL for the uploaded passport photo, if any. */
    public function getPassportImageUrlAttribute(): ?string
    {
        return $this->passport_image
            ? asset('storage/' . $this->passport_image)
            : null;
    }
}
