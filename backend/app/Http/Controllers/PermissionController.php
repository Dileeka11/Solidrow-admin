<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Staff;
use Illuminate\Http\Request;

class PermissionController extends Controller
{
    /** The action columns, in display order. */
    private const ACTIONS = ['view', 'add', 'edit', 'delete'];

    /**
     * Return the permission definition (modules × actions), the staff list,
     * and which staff hold each permission.
     */
    public function index()
    {
        $staff = Staff::orderBy('name')->get(['id', 'name', 'role']);

        $permissions = Permission::with('staff:id')
            ->orderBy('sort_order')
            ->get()
            ->map(fn (Permission $p) => [
                'id' => $p->id,
                'module' => $p->module,
                'action' => $p->action,
                'allowed' => $p->staff->pluck('id')->all(),
            ]);

        // Modules in first-seen order.
        $modules = $permissions->pluck('module')->unique()->values()->all();

        return response()->json([
            'users' => $staff,
            'modules' => $modules,
            'actions' => self::ACTIONS,
            'permissions' => $permissions,
        ]);
    }

    /**
     * Grant or revoke a single permission for a single staff member.
     */
    public function toggle(Request $request, Permission $permission)
    {
        $data = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staff,id'],
            'allowed' => ['required', 'boolean'],
        ]);

        if ($data['allowed']) {
            $permission->staff()->syncWithoutDetaching([$data['staff_id']]);
        } else {
            $permission->staff()->detach($data['staff_id']);
        }

        return response()->json([
            'id' => $permission->id,
            'allowed' => $permission->staff()->pluck('staff.id')->all(),
        ]);
    }
}
