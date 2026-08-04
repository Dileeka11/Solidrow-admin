<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Manage the branch/registration locations used by the Baddegama module.
 * Each public sign-up is attached to the location currently flagged
 * `is_active_registration`.
 */
class BaddegamaLocationController extends Controller
{
    public function index()
    {
        return DB::table('locations')
            ->select('id', 'name', 'agent', 'is_active_registration')
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'agent' => ['nullable', 'string', 'max:255'],
        ]);

        $id = DB::table('locations')->insertGetId([
            'name' => $data['name'],
            'agent' => $data['agent'] ?? null,
            'is_active_registration' => 0,
        ]);

        return response()->json(['status' => 'success', 'id' => $id, 'message' => 'Location added.']);
    }

    public function update(Request $request, int $location)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'agent' => ['nullable', 'string', 'max:255'],
        ]);

        DB::table('locations')->where('id', $location)->update([
            'name' => $data['name'],
            'agent' => $data['agent'] ?? null,
        ]);

        return response()->json(['status' => 'success', 'message' => 'Location updated.']);
    }

    public function destroy(int $location)
    {
        $inUse = DB::table('baddegama_registration')->where('type', $location)->exists();
        if ($inUse) {
            return response()->json(['status' => 'error', 'message' => 'Cannot delete: registrations are attached to this location.'], 422);
        }

        DB::table('locations')->where('id', $location)->delete();

        return response()->json(['status' => 'success', 'message' => 'Location deleted.']);
    }

    /** Make this location the active one that new public sign-ups attach to. */
    public function setActive(int $location)
    {
        DB::table('locations')->update(['is_active_registration' => 0]);
        DB::table('locations')->where('id', $location)->update(['is_active_registration' => 1]);

        return response()->json(['status' => 'success', 'message' => 'Active registration location updated.']);
    }
}
