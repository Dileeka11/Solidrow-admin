<?php

namespace App\Http\Controllers;

use App\Models\AccountGroup;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Account groups (Current Assets, Long Term Liabilities, …) — the middle tier
 * of the chart, each belonging to one category.
 */
class AccountGroupController extends Controller
{
    /** List groups joined up to their category, with account counts. */
    public function index()
    {
        return AccountGroup::query()
            ->with('category:id,code,name,normal_balance,statement_type')
            ->withCount('accounts')
            ->orderBy('code')
            ->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $group = AccountGroup::create($data);

        return response()->json($group->load('category'), 201);
    }

    public function update(Request $request, AccountGroup $accountGroup)
    {
        $data = $this->validated($request, $accountGroup->id);

        $accountGroup->update($data);

        return response()->json($accountGroup->load('category'));
    }

    public function destroy(AccountGroup $accountGroup)
    {
        // Groups cascade to accounts -> journal lines. Refuse to delete a group
        // that still owns accounts so we never silently wipe ledger data.
        if ($accountGroup->accounts()->exists()) {
            return response()->json([
                'message' => 'Cannot delete: this group still has accounts. Move or remove those accounts first.',
            ], 409);
        }

        $accountGroup->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /** Shared validation. Codes are unique; parent category must exist. */
    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'category_id' => ['required', 'integer', 'exists:account_categories,id'],
            'code' => ['required', 'string', 'max:10', Rule::unique('account_groups', 'code')->ignore($ignoreId)],
            'name' => ['required', 'string', 'max:100'],
        ]);
    }
}
