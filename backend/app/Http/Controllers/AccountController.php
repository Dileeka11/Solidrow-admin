<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AccountGroup;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Individual GL accounts — the "Chart of Accounts" screen. Each account is
 * joined up to its group, category and statement type. When the code is left
 * blank on create it is auto-generated from the group.
 */
class AccountController extends Controller
{
    /** Flat chart list, each row joined up to group + category + statement type. */
    public function index()
    {
        return Account::query()
            ->join('account_groups as g', 'g.id', '=', 'accounts.group_id')
            ->join('account_categories as c', 'c.id', '=', 'g.category_id')
            ->orderBy('accounts.code')
            ->get([
                'accounts.id',
                'accounts.code',
                'accounts.name',
                'accounts.is_active',
                'accounts.is_default',
                'accounts.created_by',
                'accounts.group_id',
                'g.name as group_name',
                'g.code as group_code',
                'c.id as category_id',
                'c.name as category_name',
                'c.statement_type as type',
            ])
            ->map(function ($r) {
                $r->is_active = (bool) $r->is_active;
                $r->is_default = (bool) $r->is_default;
                return $r;
            });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'group_id' => ['required', 'integer', 'exists:account_groups,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:20', Rule::unique('accounts', 'code')],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $group = AccountGroup::findOrFail($data['group_id']);

        $account = Account::create([
            'group_id' => $group->id,
            'code' => $data['code'] ?? $this->nextAccountCode($group),
            'name' => $data['name'],
            'is_active' => $data['is_active'] ?? true,
            'is_default' => false,
            'created_by' => 'admin',
        ]);

        return response()->json($account, 201);
    }

    public function update(Request $request, Account $account)
    {
        $data = $request->validate([
            'group_id' => ['required', 'integer', 'exists:account_groups,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:20', Rule::unique('accounts', 'code')->ignore($account->id)],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $account->update([
            'group_id' => $data['group_id'],
            'code' => $data['code'],
            'name' => $data['name'],
            'is_active' => $data['is_active'] ?? $account->is_active,
        ]);

        return response()->json($account);
    }

    public function destroy(Account $account)
    {
        // journal_lines has no DB cascade. Block deletion of any account that
        // has been posted to; the user should deactivate it instead.
        if ($account->lines()->exists()) {
            return response()->json([
                'message' => 'Cannot delete: this account is used in journal entries. Deactivate it instead.',
            ], 409);
        }

        $account->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * Next free account code for a group: {groupCode}00, +100 each account.
     * e.g. group 1100 -> 110000, 110100, 110200 … skipping any code already
     * taken. Codes are unique across all groups, so we keep stepping until free.
     */
    private function nextAccountCode(AccountGroup $group): string
    {
        $base = (int) $group->code * 100;

        $current = (int) Account::where('group_id', $group->id)
            ->max(DB::raw('CAST(code AS UNSIGNED)'));

        $next = $current >= $base ? $current + 100 : $base;

        while (Account::where('code', (string) $next)->exists()) {
            $next += 100;
        }

        return (string) $next;
    }
}
