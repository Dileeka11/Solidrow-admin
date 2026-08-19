<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    protected $table = 'items';

    protected $fillable = [
        'item_code',
        'name',
        'category_id',
        'uom',
        'unit_price',
        'description',
        'status',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
    ];
}
