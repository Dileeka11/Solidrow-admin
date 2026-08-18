<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierInvoiceItem extends Model
{
    protected $table = 'supplier_invoice_items';

    public $timestamps = false;

    protected $fillable = [
        'invoice_id',
        'po_item_id',
        'description',
        'quantity_invoiced',
        'unit_price',
        'tax_pct',
        'line_total',
    ];

    protected $casts = [
        'invoice_id' => 'integer',
        'po_item_id' => 'integer',
        'quantity_invoiced' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'tax_pct' => 'decimal:2',
        'line_total' => 'decimal:2',
    ];
}
