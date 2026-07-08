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
}
