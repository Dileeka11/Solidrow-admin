<?php

namespace App\Http\Controllers;

use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    /** List POs (newest first) with supplier, item count and total. */
    public function index()
    {
        return PurchaseOrder::query()
            ->with('supplier:id,name')
            ->withCount('items')
            ->withSum('items', 'line_total')
            ->orderByDesc('po_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($po) => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'po_date' => $po->po_date?->format('Y-m-d'),
                'supplier_id' => $po->supplier_id,
                'supplier_name' => $po->supplier?->name,
                'currency' => $po->currency,
                'status' => $po->status,
                'item_count' => $po->items_count,
                'total' => (float) ($po->items_sum_line_total ?? 0),
            ]);
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        return response()->json(
            $purchaseOrder->load(['items', 'supplier'])
        );
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $po = DB::transaction(function () use ($data) {
            $po = PurchaseOrder::create([
                'po_number' => $this->nextPoNumber(),
                'po_date' => $data['po_date'],
                'supplier_id' => $data['supplier_id'] ?? null,
                'delivery_address' => $data['delivery_address'] ?? null,
                'payment_terms' => $data['payment_terms'] ?? null,
                'currency' => $data['currency'] ?? 'LKR',
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'source_pr_ids' => $data['source_pr_ids'] ?? null,
                'status' => 'Draft',
            ]);
            $this->syncItems($po, $data['items']);
            $this->markSourcePrs($data['source_pr_ids'] ?? []);

            return $po;
        });

        return response()->json($po->load('items'), 201);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        if (! $purchaseOrder->isEditable()) {
            return response()->json(['message' => 'Only a Draft purchase order can be edited.'], 409);
        }
        $data = $this->validatePayload($request);

        DB::transaction(function () use ($purchaseOrder, $data) {
            $purchaseOrder->update([
                'po_date' => $data['po_date'],
                'supplier_id' => $data['supplier_id'] ?? null,
                'delivery_address' => $data['delivery_address'] ?? null,
                'payment_terms' => $data['payment_terms'] ?? null,
                'currency' => $data['currency'] ?? 'LKR',
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'source_pr_ids' => $data['source_pr_ids'] ?? null,
            ]);
            $purchaseOrder->items()->delete();
            $this->syncItems($purchaseOrder, $data['items']);
            $this->markSourcePrs($data['source_pr_ids'] ?? []);
        });

        return response()->json($purchaseOrder->load('items'));
    }

    public function destroy(PurchaseOrder $purchaseOrder)
    {
        if (! in_array($purchaseOrder->status, ['Draft', 'Cancelled'], true)) {
            return response()->json(['message' => 'Only a Draft or Cancelled purchase order can be deleted.'], 409);
        }
        $purchaseOrder->items()->delete();
        $purchaseOrder->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function submit(PurchaseOrder $purchaseOrder)
    {
        return $this->transition($purchaseOrder, ['Draft'], 'Pending Approval', 'submitted', function () use ($purchaseOrder) {
            if ($purchaseOrder->items()->count() === 0) {
                return 'Cannot submit a purchase order with no line items.';
            }
            if (! $purchaseOrder->supplier_id) {
                return 'Select a supplier before submitting.';
            }
            return null;
        });
    }

    public function approve(PurchaseOrder $purchaseOrder)
    {
        return $this->transition($purchaseOrder, ['Pending Approval'], 'Approved', 'approved');
    }

    public function reject(PurchaseOrder $purchaseOrder)
    {
        return $this->transition($purchaseOrder, ['Pending Approval'], 'Draft', 'sent back to draft');
    }

    /** Approved -> Sent to Supplier (supplier acknowledgment; PO becomes final). */
    public function send(PurchaseOrder $purchaseOrder)
    {
        return $this->transition($purchaseOrder, ['Approved'], 'Sent to Supplier', 'sent to supplier');
    }

    public function cancel(PurchaseOrder $purchaseOrder)
    {
        if (in_array($purchaseOrder->status, ['Partially Received', 'Fully Received', 'Closed'], true)) {
            return response()->json(['message' => 'A purchase order with received goods cannot be cancelled.'], 409);
        }
        $purchaseOrder->update(['status' => 'Cancelled']);

        return response()->json($purchaseOrder->load('items'));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function transition(PurchaseOrder $po, array $from, string $to, string $verb, ?callable $guard = null)
    {
        if (! in_array($po->status, $from, true)) {
            return response()->json(['message' => "This purchase order cannot be {$verb} from its current status."], 409);
        }
        if ($guard) {
            $error = $guard();
            if ($error) {
                return response()->json(['message' => $error], 422);
            }
        }
        $po->update(['status' => $to]);

        return response()->json($po->load('items'));
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'po_date' => ['required', 'date'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'delivery_address' => ['nullable', 'string', 'max:1000'],
            'payment_terms' => ['nullable', 'string', 'max:50'],
            'currency' => ['nullable', 'string', 'max:10'],
            'expected_delivery_date' => ['nullable', 'date'],
            'source_pr_ids' => ['nullable', 'array'],
            'source_pr_ids.*' => ['integer'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.category_id' => ['nullable', 'integer'],
            'items.*.quantity_ordered' => ['required', 'numeric', 'gt:0'],
            'items.*.uom' => ['nullable', 'string', 'max:30'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.tax_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);
    }

    private function syncItems(PurchaseOrder $po, array $items): void
    {
        foreach ($items as $row) {
            $qty = (float) ($row['quantity_ordered'] ?? 0);
            $price = (float) ($row['unit_price'] ?? 0);
            $disc = (float) ($row['discount_pct'] ?? 0);
            $tax = (float) ($row['tax_pct'] ?? 0);

            // (Qty × Price) − Discount% + Tax%.
            $base = $qty * $price;
            $afterDiscount = $base - ($base * $disc / 100);
            $lineTotal = round($afterDiscount + ($afterDiscount * $tax / 100), 2);

            PoItem::create([
                'po_id' => $po->id,
                'description' => $row['description'],
                'category_id' => $row['category_id'] ?? null,
                'quantity_ordered' => $qty,
                'uom' => $row['uom'] ?? null,
                'unit_price' => $price,
                'discount_pct' => $disc,
                'tax_pct' => $tax,
                'line_total' => $lineTotal,
                'quantity_received' => 0,
            ]);
        }
    }

    /** Flag consolidated PRs as converted so they drop out of the open list. */
    private function markSourcePrs(array $prIds): void
    {
        if (empty($prIds)) {
            return;
        }
        PurchaseRequisition::whereIn('id', $prIds)
            ->where('status', 'Approved')
            ->update(['status' => 'Converted to PO']);
    }

    private function nextPoNumber(): string
    {
        $year = date('Y');
        $prefix = "PO-{$year}-";
        $last = PurchaseOrder::where('po_number', 'like', $prefix . '%')
            ->orderByDesc('po_number')
            ->value('po_number');
        $seq = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }
}
