<?php

namespace App\Http\Controllers;

use App\Models\PrItem;
use App\Models\PurchaseRequisition;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchaseRequisitionController extends Controller
{
    /** List requisitions (newest first) with department, item count and total. */
    public function index()
    {
        return PurchaseRequisition::query()
            ->with('department:id,name')
            ->withCount('items')
            ->withSum('items', 'est_total')
            ->orderByDesc('pr_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($pr) => [
                'id' => $pr->id,
                'pr_number' => $pr->pr_number,
                'pr_date' => $pr->pr_date?->format('Y-m-d'),
                'requested_by' => $pr->requested_by,
                'department_id' => $pr->department_id,
                'department_name' => $pr->department?->name,
                'priority' => $pr->priority,
                'required_date' => $pr->required_date?->format('Y-m-d'),
                'status' => $pr->status,
                'item_count' => $pr->items_count,
                'total_estimated' => (float) ($pr->items_sum_est_total ?? 0),
            ]);
    }

    public function show(PurchaseRequisition $purchaseRequisition)
    {
        return response()->json(
            $purchaseRequisition->load(['items', 'department'])
        );
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $pr = DB::transaction(function () use ($data, $request) {
            $pr = PurchaseRequisition::create([
                'pr_number' => $this->nextPrNumber(),
                'pr_date' => $data['pr_date'],
                'requested_by' => $data['requested_by'] ?? ($request->user()?->name ?? 'admin'),
                'department_id' => $data['department_id'] ?? null,
                'priority' => $data['priority'] ?? 'Normal',
                'required_date' => $data['required_date'] ?? null,
                'purpose' => $data['purpose'] ?? null,
                'budget_account_id' => $data['budget_account_id'] ?? null,
                'status' => 'Draft',
            ]);
            $this->syncItems($pr, $data['items']);

            return $pr;
        });

        return response()->json($pr->load('items'), 201);
    }

    public function update(Request $request, PurchaseRequisition $purchaseRequisition)
    {
        if (! $purchaseRequisition->isEditable()) {
            return response()->json(['message' => 'Only a Draft requisition can be edited.'], 409);
        }
        $data = $this->validatePayload($request);

        DB::transaction(function () use ($purchaseRequisition, $data) {
            $purchaseRequisition->update([
                'pr_date' => $data['pr_date'],
                'department_id' => $data['department_id'] ?? null,
                'priority' => $data['priority'] ?? 'Normal',
                'required_date' => $data['required_date'] ?? null,
                'purpose' => $data['purpose'] ?? null,
                'budget_account_id' => $data['budget_account_id'] ?? null,
            ]);
            $purchaseRequisition->items()->delete();
            $this->syncItems($purchaseRequisition, $data['items']);
        });

        return response()->json($purchaseRequisition->load('items'));
    }

    public function destroy(PurchaseRequisition $purchaseRequisition)
    {
        if (! in_array($purchaseRequisition->status, ['Draft', 'Rejected'], true)) {
            return response()->json(['message' => 'Only a Draft or Rejected requisition can be deleted.'], 409);
        }
        $purchaseRequisition->items()->delete();
        $purchaseRequisition->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /** Draft -> Pending Approval. Enforces the submit-time validations. */
    public function submit(PurchaseRequisition $purchaseRequisition)
    {
        if ($purchaseRequisition->status !== 'Draft') {
            return response()->json(['message' => 'Only a Draft requisition can be submitted.'], 409);
        }
        if ($purchaseRequisition->items()->count() === 0) {
            return response()->json(['message' => 'Cannot submit a requisition with no line items.'], 422);
        }
        if ($purchaseRequisition->required_date && $purchaseRequisition->required_date->isPast()) {
            return response()->json(['message' => 'Required date cannot be in the past.'], 422);
        }

        $purchaseRequisition->update(['status' => 'Pending Approval']);

        return response()->json($purchaseRequisition->load('items'));
    }

    /** Pending Approval -> Approved (read-only, available for PO conversion). */
    public function approve(PurchaseRequisition $purchaseRequisition)
    {
        if ($purchaseRequisition->status !== 'Pending Approval') {
            return response()->json(['message' => 'Only a requisition pending approval can be approved.'], 409);
        }
        $purchaseRequisition->update(['status' => 'Approved']);

        return response()->json($purchaseRequisition->load('items'));
    }

    /** Pending Approval -> Rejected. */
    public function reject(PurchaseRequisition $purchaseRequisition)
    {
        if ($purchaseRequisition->status !== 'Pending Approval') {
            return response()->json(['message' => 'Only a requisition pending approval can be rejected.'], 409);
        }
        $purchaseRequisition->update(['status' => 'Rejected']);

        return response()->json($purchaseRequisition->load('items'));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function validatePayload(Request $request): array
    {
        $data = $request->validate([
            'pr_date' => ['required', 'date'],
            'requested_by' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'priority' => ['nullable', Rule::in(['Normal', 'Urgent', 'Critical'])],
            'required_date' => ['nullable', 'date'],
            'purpose' => ['nullable', 'string', 'max:2000'],
            'budget_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.category_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.uom' => ['nullable', 'string', 'max:30'],
            'items.*.est_unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.preferred_supplier_id' => ['nullable', 'integer'],
            'items.*.remarks' => ['nullable', 'string', 'max:255'],
        ]);

        // Required date, when given, may not be in the past.
        if (! empty($data['required_date']) && strtotime($data['required_date']) < strtotime(date('Y-m-d'))) {
            throw ValidationException::withMessages(['required_date' => 'Required date cannot be in the past.']);
        }

        return $data;
    }

    private function syncItems(PurchaseRequisition $pr, array $items): void
    {
        foreach ($items as $row) {
            $qty = (float) ($row['quantity'] ?? 0);
            $price = (float) ($row['est_unit_price'] ?? 0);
            PrItem::create([
                'pr_id' => $pr->id,
                'description' => $row['description'],
                'category_id' => $row['category_id'] ?? null,
                'quantity' => $qty,
                'uom' => $row['uom'] ?? null,
                'est_unit_price' => $price,
                'est_total' => round($qty * $price, 2),
                'preferred_supplier_id' => $row['preferred_supplier_id'] ?? null,
                'remarks' => $row['remarks'] ?? null,
            ]);
        }
    }

    /** Next PR number: PR-YYYY-NNNNN, sequential within the calendar year. */
    private function nextPrNumber(): string
    {
        $year = date('Y');
        $prefix = "PR-{$year}-";
        $last = PurchaseRequisition::where('pr_number', 'like', $prefix . '%')
            ->orderByDesc('pr_number')
            ->value('pr_number');
        $seq = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }
}
