<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JournalEntry extends Model
{
    protected $table = 'journal_entries';

    protected $fillable = [
        'entry_date',
        'posting_date',
        'reference',
        'source_type',
        'source_id',
        'currency',
        'branch',
        'memo',
    ];

    protected $casts = [
        'entry_date' => 'date:Y-m-d',
        'posting_date' => 'date:Y-m-d',
    ];

    /** Debit/credit legs of this entry. */
    public function lines()
    {
        return $this->hasMany(JournalLine::class, 'entry_id');
    }
}
