<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    protected $fillable = [
        'module',
        'action',
        'label',
        'sort_order',
    ];

    /** Expose the derived key (e.g. "staff.view") in JSON. */
    protected $appends = ['key'];

    /**
     * A stable machine key, e.g. "staff.view", used for permission checks.
     */
    protected function key(): Attribute
    {
        return Attribute::make(
            get: fn () => strtolower($this->module) . '.' . strtolower($this->action),
        );
    }

    /**
     * Staff members granted this permission.
     */
    public function staff()
    {
        return $this->belongsToMany(Staff::class, 'permission_staff');
    }
}
