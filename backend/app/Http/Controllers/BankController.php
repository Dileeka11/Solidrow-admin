<?php

namespace App\Http\Controllers;

use App\Models\Bank;
use App\Models\BankBranch;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BankController extends Controller
{
    /** List banks with their branches. */
    public function index()
    {
        return Bank::with(['branches' => fn ($q) => $q->orderBy('name')])
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('banks', 'name')],
        ]);

        return response()->json(Bank::create($data)->load('branches'), 201);
    }

    public function update(Request $request, Bank $bank)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('banks', 'name')->ignore($bank->id)],
        ]);

        $bank->update($data);

        return response()->json($bank->load('branches'));
    }

    public function destroy(Bank $bank)
    {
        // No DB cascade — remove the bank's branches first, then the bank.
        $bank->branches()->delete();
        $bank->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    // ── Branches ────────────────────────────────────────────────────────────

    public function storeBranch(Request $request, Bank $bank)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'branch_code' => ['nullable', 'string', 'max:20'],
        ]);
        $data['bank_id'] = $bank->id;

        return response()->json(BankBranch::create($data), 201);
    }

    public function updateBranch(Request $request, BankBranch $bankBranch)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'branch_code' => ['nullable', 'string', 'max:20'],
        ]);

        $bankBranch->update($data);

        return response()->json($bankBranch);
    }

    public function destroyBranch(BankBranch $bankBranch)
    {
        $bankBranch->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
