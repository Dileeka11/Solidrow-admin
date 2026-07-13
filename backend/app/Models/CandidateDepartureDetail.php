<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CandidateDepartureDetail extends Model
{
    protected $table = 'candidate_departure_details';

    protected $fillable = [
        'candidate_id',
        'final_approval_date',
        'receipt_number',
        'flight_number',
        'airticket_number',
        'departure_date',
    ];

    protected $casts = [
        'final_approval_date' => 'date',
        'departure_date'      => 'date',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }
}
