<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoodsReceivedNote extends Model
{
    protected $table = 'goods_received_notes';

    protected $fillable = [
        'grn_number',
        'grn_date',
        'po_id',
        'supplier_id',
        'delivery_note_no',
        'received_by',
        'warehouse',
        'status',
    ];

    protected $casts = [
        'grn_date' => 'date:Y-m-d',
        'po_id' => 'integer',
        'supplier_id' => 'integer',
    ];

    public function items()
    {
        return $this->hasMany(GrnItem::class, 'grn_id');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'po_id');
    }
}
