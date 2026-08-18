<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GrnItem extends Model
{
    protected $table = 'grn_items';

    public $timestamps = false;

    protected $fillable = [
        'grn_id',
        'po_item_id',
        'description',
        'quantity_ordered',
        'quantity_received',
        'quantity_accepted',
        'quantity_rejected',
        'rejection_reason',
        'batch_serial_no',
        'condition',
        'remarks',
    ];

    protected $casts = [
        'grn_id' => 'integer',
        'po_item_id' => 'integer',
        'quantity_ordered' => 'decimal:2',
        'quantity_received' => 'decimal:2',
        'quantity_accepted' => 'decimal:2',
        'quantity_rejected' => 'decimal:2',
    ];
}
