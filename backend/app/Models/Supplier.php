<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    protected $table = 'suppliers';

    protected $fillable = [
        'supplier_code',
        'name',
        'contact_person',
        'phone',
        'email',
        'address',
        'payment_terms',
        'bank_name',
        'bank_branch',
        'bank_account_no',
        'notes',
        'status',
    ];
}
