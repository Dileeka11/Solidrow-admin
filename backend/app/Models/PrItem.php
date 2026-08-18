<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrItem extends Model
{
    protected $table = 'pr_items';

    public $timestamps = false;

    protected $fillable = [
        'pr_id',
        'description',
        'category_id',
        'quantity',
        'uom',
        'est_unit_price',
        'est_total',
        'preferred_supplier_id',
        'remarks',
    ];

    protected $casts = [
        'pr_id' => 'integer',
        'category_id' => 'integer',
        'preferred_supplier_id' => 'integer',
        'quantity' => 'decimal:2',
        'est_unit_price' => 'decimal:2',
        'est_total' => 'decimal:2',
    ];
}
