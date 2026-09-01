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

        // Auto-generate supplier code: SUP-001, SUP-002, …
        if (empty($data['supplier_code'])) {
            $last = Supplier::whereNotNull('supplier_code')
                ->orderBy('id', 'desc')
                ->value('supplier_code');
            $seq = $last ? (int) substr($last, 4) + 1 : 1;
            $data['supplier_code'] = 'SUP-' . str_pad($seq, 3, '0', STR_PAD_LEFT);
        }

        return response()->json(Supplier::create($data), 201);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $data = $this->validated($request, $supplier);
        $supplier->update($data);
        return response()->json($supplier);
    }

    public function destroy(Supplier $supplier)
    {
        $supplier->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    private function validated(Request $request, ?Supplier $existing = null): array
    {
        $data = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'contact_person'  => ['nullable', 'string', 'max:255'],
            'phone'           => ['nullable', 'string', 'max:30'],
            'email'           => ['nullable', 'email', 'max:255'],
            'address'         => ['nullable', 'string', 'max:1000'],
            'payment_terms'   => ['nullable', Rule::in(['immediate', '30_days', '60_days', '90_days'])],
            'bank_name'       => ['nullable', 'string', 'max:100'],
            'bank_branch'     => ['nullable', 'string', 'max:100'],
            'bank_account_no' => ['nullable', 'string', 'max:50'],
            'notes'           => ['nullable', 'string', 'max:2000'],
            'status'          => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        $data['status'] = $data['status'] ?? 'Active';
        return $data;
    }
}
