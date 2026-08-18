<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    public function index()
    {
        return Supplier::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Supplier::create($data), 201);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $data = $this->validated($request);

        $supplier->update($data);

        return response()->json($supplier);
    }

    public function destroy(Supplier $supplier)
    {
        $supplier->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);
        $data['status'] = $data['status'] ?? 'Active';

        return $data;
    }
}
