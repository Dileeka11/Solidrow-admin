<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankBranch extends Model
{
    protected $table = 'bank_branches';

    protected $fillable = [
        'bank_id',
        'name',
        'branch_code',
    ];

    protected $casts = [
        'bank_id' => 'integer',
    ];

    /** Parent bank. */
    public function bank()
    {
        return $this->belongsTo(Bank::class, 'bank_id');
    }
}
