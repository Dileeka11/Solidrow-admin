<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierInvoice extends Model
{
    protected $table = 'supplier_invoices';

    protected $fillable = [
        'internal_ref_no',
        'supplier_invoice_no',
        'invoice_date',
        'po_id',
        'grn_ids',
        'supplier_id',
        'due_date',
        'currency',
        'attached_document',
        'status',
    ];

    protected $casts = [
        'invoice_date' => 'date:Y-m-d',
        'due_date' => 'date:Y-m-d',
        'po_id' => 'integer',
        'supplier_id' => 'integer',
        'grn_ids' => 'array',
    ];

    public function items()
    {
        return $this->hasMany(SupplierInvoiceItem::class, 'invoice_id');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'po_id');
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }
}
