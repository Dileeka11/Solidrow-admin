<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalesInvoice extends Model
{
    protected $table = 'sales_invoices';

    protected $fillable = [
        'invoice_number',
        'financial_year_id',
        'invoice_date',
        'due_date',
        'customer_name',
        'customer_phone',
        'customer_address',
        'payment_method',
        'payment_account_id',
        'subtotal',
        'tax_amount',
        'total',
        'currency',
        'notes',
        'status',
        'journal_entry_id',
    ];

    protected $casts = [
        'invoice_date' => 'date:Y-m-d',
        'due_date'     => 'date:Y-m-d',
        'subtotal'     => 'decimal:2',
        'tax_amount'   => 'decimal:2',
        'total'        => 'decimal:2',
    ];

    public function items()
    {
        return $this->hasMany(SalesInvoiceItem::class, 'invoice_id');
    }

    public function financialYear()
    {
        return $this->belongsTo(FinancialYear::class, 'financial_year_id');
    }

    public function journalEntry()
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function paymentAccount()
    {
        return $this->belongsTo(Account::class, 'payment_account_id');
    }
}
