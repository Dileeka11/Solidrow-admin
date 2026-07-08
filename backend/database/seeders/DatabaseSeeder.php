<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Admin account — matches the design's demo credentials (admin / admin123).
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Administrator',
                'email' => 'admin@overseascareers.lk',
                'password' => Hash::make('admin123'),
            ]
        );

        // Seed the roles used by the permission matrix + staff assignments.
        foreach (['Admin', 'Branch Manager', 'Recruitment Officer', 'Documentation Officer', 'Viewer'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName]);
        }

        // Seed initial staff (from the design prototype).
        $staff = [
            ['name' => 'Nadeesha Perera', 'role' => 'Branch Manager', 'department' => 'Recruitment', 'status' => 'Active', 'email' => 'nadeesha.perera@overseascareers.lk'],
            ['name' => 'Kasun Fernando', 'role' => 'Documentation Officer', 'department' => 'Documentation', 'status' => 'Active', 'email' => 'kasun.f@overseascareers.lk'],
            ['name' => 'Ishara Wickramasinghe', 'role' => 'Recruitment Officer', 'department' => 'Recruitment', 'status' => 'On Leave', 'email' => 'ishara.w@overseascareers.lk'],
            ['name' => 'Tharindu Silva', 'role' => 'Client Relations Officer', 'department' => 'Client Relations', 'status' => 'Active', 'email' => 'tharindu.s@overseascareers.lk'],
            ['name' => 'Dilani Rathnayake', 'role' => 'Finance Officer', 'department' => 'Finance', 'status' => 'Active', 'email' => 'dilani.r@overseascareers.lk'],
            ['name' => 'Chamara Bandara', 'role' => 'HR Officer', 'department' => 'HR', 'status' => 'Inactive', 'email' => 'chamara.b@overseascareers.lk'],
        ];

        if (Staff::count() === 0) {
            foreach ($staff as $s) {
                // Default login password for seeded staff: staff123 (hashed by the model cast).
                Staff::create($s + ['password' => 'staff123']);
            }
        }

        // Seed the module × action permissions (Dashboard is view-only).
        $modules = [
            'Dashboard'   => ['view'],
            'Candidates'  => ['view', 'add', 'edit', 'delete'],
            'Staff'       => ['view', 'add', 'edit', 'delete'],
            'Roles'       => ['view', 'add', 'edit', 'delete'],
            'Permissions' => ['view', 'add', 'edit', 'delete'],
        ];

        $order = 0;
        foreach ($modules as $module => $actions) {
            foreach ($actions as $action) {
                Permission::updateOrCreate(
                    ['module' => $module, 'action' => $action],
                    ['label' => "{$module} · " . ucfirst($action), 'sort_order' => $order++],
                );
            }
        }

        // Default per-user grants by role (a sensible starting point).
        // Everyone gets Dashboard view; managers get more.
        $keysByRole = [
            'Branch Manager' => ['dashboard.view', 'candidates.view', 'candidates.add', 'candidates.edit', 'candidates.delete', 'staff.view', 'staff.add', 'staff.edit', 'staff.delete', 'roles.view'],
            'Recruitment Officer' => ['dashboard.view', 'candidates.view', 'candidates.add', 'candidates.edit', 'staff.view'],
            'Documentation Officer' => ['dashboard.view', 'candidates.view', 'candidates.edit'],
        ];
        $default = ['dashboard.view'];

        $permByKey = Permission::all()->keyBy('key');
        foreach (Staff::all() as $member) {
            $keys = $keysByRole[$member->role] ?? $default;
            $ids = collect($keys)
                ->map(fn ($k) => optional($permByKey->get($k))->id)
                ->filter()
                ->all();
            $member->permissions()->sync($ids);
        }
    }
}
