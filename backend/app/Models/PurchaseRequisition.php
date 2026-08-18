<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseRequisition extends Model
{
    protected $table = 'purchase_requisitions';

    protected $fillable = [
        'pr_number',
        'pr_date',
        'requested_by',
        'department_id',
        'priority',
        'required_date',
        'purpose',
        'budget_account_id',
        'status',
    ];

    protected $casts = [
        'pr_date' => 'date:Y-m-d',
        'required_date' => 'date:Y-m-d',
        'department_id' => 'integer',
        'budget_account_id' => 'integer',
    ];

    /** Line items. */
    public function items()
    {
        return $this->hasMany(PrItem::class, 'pr_id');
    }

    /** Requisitioning department. */
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** A PR can only be edited while it is still a Draft. */
    public function isEditable(): bool
    {
        return $this->status === 'Draft';
    }
}
