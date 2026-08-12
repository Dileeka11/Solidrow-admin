<?php

namespace App\Http\Controllers;

use App\Models\Demand;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DemandController extends Controller
{
    /** List all demands (alphabetical). */
    public function index()
    {
        return Demand::orderBy('name')->get();
    }

    /** Create a new demand. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('demands', 'name')],
        ]);

        $demand = Demand::create($data);

        return response()->json($demand, 201);
    }

    /** Update a demand. */
    public function update(Request $request, Demand $demand)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('demands', 'name')->ignore($demand->id)],
        ]);

        $demand->update($data);

        return response()->json($demand);
    }

    /** Delete a demand. */
    public function destroy(Demand $demand)
    {
        $demand->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
