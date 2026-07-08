<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Authenticate an admin (by username) or a staff member (by email)
     * and issue a Sanctum token.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        // 1. Try the admin account (users table, by username).
        $user = User::where('username', $credentials['username'])->first();

        if ($user && Hash::check($credentials['password'], $user->password)) {
            $token = $user->createToken('admin-panel')->plainTextToken;

            return response()->json([
                'token' => $token,
                'user' => $this->adminPayload($user),
            ]);
        }

        // 2. Try a staff member (staff table, by email).
        $staff = Staff::where('email', $credentials['username'])->first();

        if ($staff && $staff->password && Hash::check($credentials['password'], $staff->password)) {
            if ($staff->status !== 'Active') {
                throw ValidationException::withMessages([
                    'username' => ['Your account is not active. Contact an administrator.'],
                ]);
            }

            $token = $staff->createToken('staff-panel')->plainTextToken;

            return response()->json([
                'token' => $token,
                'user' => $this->staffPayload($staff),
            ]);
        }

        throw ValidationException::withMessages([
            'username' => ['Invalid credentials. Admins use their username; staff use their email.'],
        ]);
    }

    /**
     * Return the currently authenticated user (admin or staff).
     */
    public function me(Request $request)
    {
        $authenticated = $request->user();

        $payload = $authenticated instanceof Staff
            ? $this->staffPayload($authenticated)
            : $this->adminPayload($authenticated);

        return response()->json(['user' => $payload]);
    }

    /**
     * Revoke the current access token.
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    private function adminPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'role' => 'Admin',
            // The admin always sees everything.
            'permissions' => Permission::orderBy('sort_order')->get()->map(fn ($p) => $p->key)->all(),
        ];
    }

    private function staffPayload(Staff $staff): array
    {
        return [
            'id' => $staff->id,
            'name' => $staff->name,
            'username' => $staff->email,
            'email' => $staff->email,
            'role' => $staff->role,
            'permissions' => $staff->permissionKeys(),
        ];
    }
}
