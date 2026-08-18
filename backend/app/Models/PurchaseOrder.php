<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    protected $table = 'purchase_orders';

    protected $fillable = [
        'po_number',
        'po_date',
        'supplier_id',
        'delivery_address',
        'payment_terms',
        'currency',
        'expected_delivery_date',
        'source_pr_ids',
        'status',
    ];

    protected $casts = [
        'po_date' => 'date:Y-m-d',
        'expected_delivery_date' => 'date:Y-m-d',
        'supplier_id' => 'integer',
        'source_pr_ids' => 'array',
    ];

    public function items()
    {
        return $this->hasMany(PoItem::class, 'po_id');
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    /** A PO can only be edited while it is still a Draft. */
    public function isEditable(): bool
    {
        return $this->status === 'Draft';
    }

    /** Can goods still be received against this PO? */
    public function isReceivable(): bool
    {
        return in_array($this->status, ['Approved', 'Sent to Supplier', 'Partially Received'], true);
    }
}
