<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Staff extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'staff';

    protected $fillable = [
        'name',
        'role',
        'department',
        'status',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
    ];

    /**
     * Permissions granted directly to this staff member.
     */
    public function permissions()
    {
        return $this->belongsToMany(Permission::class, 'permission_staff');
    }

    /**
     * Permission keys this staff member is allowed (e.g. "staff.view").
     *
     * @return array<int, string>
     */
    public function permissionKeys(): array
    {
        return $this->permissions()
            ->orderBy('sort_order')
            ->get()
            ->map(fn (Permission $p) => $p->key)
            ->all();
    }
}
