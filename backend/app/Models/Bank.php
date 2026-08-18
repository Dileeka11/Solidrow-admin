<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bank extends Model
{
    protected $table = 'banks';

    protected $fillable = [
        'name',
    ];

    /** Branches belonging to this bank. */
    public function branches()
    {
        return $this->hasMany(BankBranch::class, 'bank_id');
    }
}
