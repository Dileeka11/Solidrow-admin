<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PoItem extends Model
{
    protected $table = 'po_items';

    public $timestamps = false;

    protected $appends = ['quantity_pending'];

    protected $fillable = [
        'po_id',
        'description',
        'category_id',
        'quantity_ordered',
        'uom',
        'unit_price',
        'discount_pct',
        'tax_pct',
        'line_total',
        'quantity_received',
    ];

    protected $casts = [
        'po_id' => 'integer',
        'category_id' => 'integer',
        'quantity_ordered' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'discount_pct' => 'decimal:2',
        'tax_pct' => 'decimal:2',
        'line_total' => 'decimal:2',
        'quantity_received' => 'decimal:2',
    ];

    /** Outstanding quantity still to be received. */
    public function getQuantityPendingAttribute(): float
    {
        return round((float) $this->quantity_ordered - (float) $this->quantity_received, 2);
    }
}
