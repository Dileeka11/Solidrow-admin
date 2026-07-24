<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TestNumberCounter extends Model
{
    protected $table = 'test_number_counters';

    protected $fillable = [
        'code',
        'last_number',
    ];
}
