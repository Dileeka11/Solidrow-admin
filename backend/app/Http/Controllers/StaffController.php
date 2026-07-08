<?php

namespace App\Http\Controllers;

use App\Models\Staff;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    /**
     * List all staff members.
     */
    public function index()
    {
        return Staff::orderBy('id')->get();
    }

    /**
     * Create a new staff member.
     */
    public function store(Request $request)
    {
        $data = $this->validateStaff($request);

        // Password is required when creating a login-capable staff member.
        $request->validate([
            'password' => ['required', 'string', 'min:6', 'max:255'],
        ]);
        $data['password'] = $request->input('password');

        $staff = Staff::create($data);

        return response()->json($staff, 201);
    }

    /**
     * Show a single staff member.
     */
    public function show(Staff $staff)
    {
        return $staff;
    }

    /**
     * Update a staff member.
     */
    public function update(Request $request, Staff $staff)
    {
        $data = $this->validateStaff($request, $staff);

        // Only change the password when a new one is supplied; blank = keep current.
        if ($request->filled('password')) {
            $request->validate([
                'password' => ['string', 'min:6', 'max:255'],
            ]);
            $data['password'] = $request->input('password');
        }

        $staff->update($data);

        return response()->json($staff);
    }

    /**
     * Delete a staff member.
     */
    public function destroy(Staff $staff)
    {
        $staff->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function validateStaff(Request $request, ?Staff $staff = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', 'string', 'max:255'],
            'department' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::in(['Active', 'On Leave', 'Inactive'])],
            // Email must be unique — it's the staff login identifier.
            'email' => [
                'required', 'email', 'max:255',
                Rule::unique('staff', 'email')->ignore($staff?->id),
            ],
        ]);
    }
}
