<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LocationController extends Controller
{
    public function provinces()
    {
        return DB::table('provinces')
            ->select('id', 'name')
            ->orderBy('name')
            ->get();
    }

    public function districts(Request $request)
    {
        $provinceId = $request->query('province_id');

        return DB::table('district')
            ->select('id', 'name')
            ->when($provinceId, fn ($q) => $q->where('province', $provinceId))
            ->orderBy('name')
            ->get();
    }

    public function dsDivisions(Request $request)
    {
        $districtId = $request->query('district_id');

        return DB::table('dsdivision')
            ->select('id', 'name')
            ->when($districtId, fn ($q) => $q->where('district_id', $districtId))
            ->orderBy('name')
            ->get();
    }

    public function gnDivisions(Request $request)
    {
        $districtId = $request->query('district_id');
        $dsDivisionId = $request->query('ds_division_id');

        return DB::table('gndivision')
            ->select('id', 'name')
            ->when($districtId, fn ($q) => $q->where('district_id', $districtId))
            ->when($dsDivisionId, fn ($q) => $q->where('ds_division_id', $dsDivisionId))
            ->orderBy('name')
            ->get();
    }

    // --- Divisional Secretariat (DS division) management ---------------------
    // The legacy `dsdivision` table has no AUTO_INCREMENT on `id` and a
    // NOT NULL `queue` column, so ids are generated manually here.

    public function storeDsDivision(Request $request)
    {
        $data = $request->validate([
            'district_id' => ['required'],
            'name' => ['required', 'string', 'max:38'],
        ]);

        $nextId = (int) DB::table('dsdivision')->max('id') + 1;

        DB::table('dsdivision')->insert([
            'id' => $nextId,
            'district_id' => $data['district_id'],
            'name' => $data['name'],
            'queue' => 0,
        ]);

        return response()->json(['id' => $nextId, 'name' => $data['name']], 201);
    }

    public function updateDsDivision(Request $request, $id)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:38'],
        ]);

        DB::table('dsdivision')->where('id', $id)->update(['name' => $data['name']]);

        return response()->json(['id' => (int) $id, 'name' => $data['name']]);
    }

    public function destroyDsDivision($id)
    {
        // Remove child GN divisions first so they are not orphaned.
        DB::table('gndivision')->where('ds_division_id', $id)->delete();
        DB::table('dsdivision')->where('id', $id)->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    // --- Grama Niladhari (GN division) management ----------------------------

    public function storeGnDivision(Request $request)
    {
        $data = $request->validate([
            'district_id' => ['required'],
            'ds_division_id' => ['required'],
            'name' => ['required', 'string', 'max:34'],
        ]);

        $nextId = (int) DB::table('gndivision')->max('id') + 1;

        DB::table('gndivision')->insert([
            'id' => $nextId,
            'district_id' => $data['district_id'],
            'ds_division_id' => $data['ds_division_id'],
            'name' => $data['name'],
            'queue' => 0,
        ]);

        return response()->json(['id' => $nextId, 'name' => $data['name']], 201);
    }

    public function updateGnDivision(Request $request, $id)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:34'],
        ]);

        DB::table('gndivision')->where('id', $id)->update(['name' => $data['name']]);

        return response()->json(['id' => (int) $id, 'name' => $data['name']]);
    }

    public function destroyGnDivision($id)
    {
        DB::table('gndivision')->where('id', $id)->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
