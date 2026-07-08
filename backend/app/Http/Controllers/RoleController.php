<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    /**
     * List all roles.
     */
    public function index()
    {
        return Role::orderBy('name')->get();
    }

    /**
     * Create a new role.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')],
        ]);

        $role = Role::create($data);

        return response()->json($role, 201);
    }

    /**
     * Rename a role — cascades to staff assignments and the permission matrix.
     */
    public function update(Request $request, Role $role)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')->ignore($role->id)],
        ]);

        $oldName = $role->name;
        $newName = $data['name'];

        if ($oldName !== $newName) {
            DB::transaction(function () use ($role, $oldName, $newName) {
                $role->update(['name' => $newName]);

                // Keep staff assignments in sync.
                Staff::where('role', $oldName)->update(['role' => $newName]);

                // Rename the key inside each permission's roles JSON.
                Permission::all()->each(function (Permission $p) use ($oldName, $newName) {
                    $roles = $p->roles;
                    if (array_key_exists($oldName, $roles)) {
                        $roles[$newName] = $roles[$oldName];
                        unset($roles[$oldName]);
                        $p->roles = $roles;
                        $p->save();
                    }
                });
            });
        }

        return response()->json($role);
    }

    /**
     * Delete a role — blocked while any staff member still uses it.
     */
    public function destroy(Role $role)
    {
        if (Staff::where('role', $role->name)->exists()) {
            return response()->json([
                'message' => 'Cannot delete: staff members are still assigned this role.',
            ], 422);
        }

        $role->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
