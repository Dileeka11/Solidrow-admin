<?php

namespace App\Http\Controllers;

use App\Models\AccountCategory;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Top-level chart categories (Assets, Liabilities, Equity, Income, Expenses).
 * normal_balance encodes double-entry rules: Assets/Expenses are debit,
 * Liabilities/Equity/Income are credit.
 */
class AccountCategoryController extends Controller
{
    /** List all categories (by code) with their group + account counts. */
    public function index()
    {
        return AccountCategory::withCount(['groups'])
            ->orderBy('code')
            ->get();
    }

    /** Categories with their nested groups — for chart dropdowns. */
    public function chart()
    {
        return AccountCategory::with(['groups' => fn ($q) => $q->orderBy('code')])
            ->orderBy('code')
            ->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $category = AccountCategory::create($data);

        return response()->json($category, 201);
    }

    public function update(Request $request, AccountCategory $accountCategory)
    {
        $data = $this->validated($request, $accountCategory->id);

        $accountCategory->update($data);

        return response()->json($accountCategory);
    }

    public function destroy(AccountCategory $accountCategory)
    {
        // Categories cascade to groups (and on to accounts/ledger). Refuse to
        // delete a category that still has groups so nothing is silently wiped.
        if ($accountCategory->groups()->exists()) {
            return response()->json([
                'message' => 'Cannot delete: this category still has groups. Remove those groups first.',
            ], 409);
        }

        $accountCategory->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /** Shared validation. Codes are unique; normal_balance/statement_type constrained. */
    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:10', Rule::unique('account_categories', 'code')->ignore($ignoreId)],
            'name' => ['required', 'string', 'max:100'],
            'normal_balance' => ['required', Rule::in(['debit', 'credit'])],
            'statement_type' => ['nullable', Rule::in(['BS', 'PNL'])],
        ]);
    }
}
