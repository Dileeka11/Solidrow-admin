<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
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
        // Admin account. The password is taken from ADMIN_DEFAULT_PASSWORD in .env;
        // if that is not set a random one is generated and printed so it is never a
        // predictable, hard-coded value. firstOrCreate means an existing admin (with a
        // password the operator may already have changed) is never overwritten.
        $adminPassword = env('ADMIN_DEFAULT_PASSWORD');
        $generated = false;
        if (! $adminPassword) {
            $adminPassword = \Illuminate\Support\Str::password(16);
            $generated = true;
        }

        $admin = User::firstOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Administrator',
                'email' => env('ADMIN_EMAIL', 'admin@overseascareers.lk'),
                'password' => Hash::make($adminPassword),
            ]
        );

        if ($admin->wasRecentlyCreated && $generated) {
            $this->command?->warn("Admin account created. Username: admin  Password: {$adminPassword}");
            $this->command?->warn('Save this now and change it after first login — it will not be shown again.');
        }

        // Seed the roles used by the permission matrix + staff assignments.
        foreach (['Admin', 'Branch Manager', 'Recruitment Officer', 'Documentation Officer', 'Viewer'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName]);
        }

        // Seed the module × action permissions (Dashboard is view-only).
        $modules = [
            'Dashboard'   => ['view'],
            'Candidates'  => ['view', 'add', 'edit', 'delete'],
            'Baddegama'   => ['view', 'add', 'edit', 'delete'],
            'Staff'       => ['view', 'add', 'edit', 'delete'],
            'Accounting'  => ['view', 'add', 'edit', 'delete'],
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

        // Seed the Chart of Accounts backbone (categories, groups, default accounts).
        $this->call(AccountingSeeder::class);

        // Seed procurement master data (departments, item categories).
        $this->call(ProcurementMasterSeeder::class);
    }
}
