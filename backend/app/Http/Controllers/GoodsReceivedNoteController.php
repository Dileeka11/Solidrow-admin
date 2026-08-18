<?php

namespace App\Http\Controllers;

use App\Models\GoodsReceivedNote;
use App\Models\GrnItem;
use App\Models\PoItem;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GoodsReceivedNoteController extends Controller
{
    /** List GRNs (newest first) with PO number and item count. */
    public function index()
    {
        return GoodsReceivedNote::query()
            ->leftJoin('purchase_orders as po', 'po.id', '=', 'goods_received_notes.po_id')
            ->leftJoin('suppliers as s', 's.id', '=', 'goods_received_notes.supplier_id')
            ->withCount('items')
            ->orderByDesc('goods_received_notes.grn_date')
            ->orderByDesc('goods_received_notes.id')
            ->get([
                'goods_received_notes.*',
                'po.po_number as po_number',
                's.name as supplier_name',
            ])
            ->map(fn ($g) => [
                'id' => $g->id,
                'grn_number' => $g->grn_number,
                'grn_date' => $g->grn_date?->format('Y-m-d'),
                'po_id' => $g->po_id,
                'po_number' => $g->po_number,
                'supplier_name' => $g->supplier_name,
                'status' => $g->status,
                'item_count' => $g->items_count,
            ]);
    }

    public function show(GoodsReceivedNote $goodsReceivedNote)
    {
        return response()->json(
            $goodsReceivedNote->load(['items', 'purchaseOrder:id,po_number,status'])
        );
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $po = PurchaseOrder::find($data['po_id']);
        if (! $po) {
            return response()->json(['message' => 'Purchase order not found.'], 404);
        }
        if (in_array($po->status, ['Closed', 'Cancelled'], true)) {
            return response()->json(['message' => 'Cannot receive against a Closed or Cancelled purchase order.'], 409);
        }

        $grn = DB::transaction(function () use ($data, $po, $request) {
            $grn = GoodsReceivedNote::create([
                'grn_number' => $this->nextGrnNumber(),
                'grn_date' => $data['grn_date'],
                'po_id' => $po->id,
                'supplier_id' => $po->supplier_id,
                'delivery_note_no' => $data['delivery_note_no'] ?? null,
                'received_by' => $data['received_by'] ?? ($request->user()?->name ?? 'admin'),
                'warehouse' => $data['warehouse'] ?? null,
                'status' => 'Draft',
            ]);
            $this->syncItems($grn, $data['items']);

            return $grn;
        });

        return response()->json($grn->load('items'), 201);
    }

    public function update(Request $request, GoodsReceivedNote $goodsReceivedNote)
    {
        if ($goodsReceivedNote->status !== 'Draft') {
            return response()->json(['message' => 'Only a Draft GRN can be edited.'], 409);
        }
        $data = $this->validatePayload($request);

        DB::transaction(function () use ($goodsReceivedNote, $data) {
            $goodsReceivedNote->update([
                'grn_date' => $data['grn_date'],
                'delivery_note_no' => $data['delivery_note_no'] ?? null,
                'warehouse' => $data['warehouse'] ?? null,
            ]);
            $goodsReceivedNote->items()->delete();
            $this->syncItems($goodsReceivedNote, $data['items']);
        });

        return response()->json($goodsReceivedNote->load('items'));
    }

    public function destroy(GoodsReceivedNote $goodsReceivedNote)
    {
        if ($goodsReceivedNote->status !== 'Draft') {
            return response()->json(['message' => 'Only a Draft GRN can be deleted.'], 409);
        }
        $goodsReceivedNote->items()->delete();
        $goodsReceivedNote->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * Confirm the GRN: apply accepted quantities to the PO's received totals and
     * recompute the PO status (Partially / Fully Received). Blocks over-receipt.
     */
    public function confirm(GoodsReceivedNote $goodsReceivedNote)
    {
        if ($goodsReceivedNote->status !== 'Draft') {
            return response()->json(['message' => 'Only a Draft GRN can be confirmed.'], 409);
        }
        $po = PurchaseOrder::find($goodsReceivedNote->po_id);
        if (! $po) {
            return response()->json(['message' => 'Purchase order not found.'], 404);
        }
        if (in_array($po->status, ['Closed', 'Cancelled'], true)) {
            return response()->json(['message' => 'Cannot receive against a Closed or Cancelled purchase order.'], 409);
        }

        DB::transaction(function () use ($goodsReceivedNote, $po) {
            foreach ($goodsReceivedNote->items as $line) {
                if (! $line->po_item_id) {
                    continue;
                }
                $poItem = PoItem::find($line->po_item_id);
                if (! $poItem) {
                    continue;
                }
                $pending = (float) $poItem->quantity_ordered - (float) $poItem->quantity_received;
                $accepted = (float) $line->quantity_accepted;
                if ($accepted > $pending + 0.001) {
                    throw ValidationException::withMessages([
                        'items' => "Over-receipt on \"{$poItem->description}\": accepted {$accepted} exceeds pending {$pending}.",
                    ]);
                }
                $poItem->quantity_received = round((float) $poItem->quantity_received + $accepted, 2);
                $poItem->save();
            }

            // Recompute PO status from its line receipts.
            $po->load('items');
            $allReceived = $po->items->every(fn ($it) => (float) $it->quantity_received >= (float) $it->quantity_ordered - 0.001);
            $anyReceived = $po->items->contains(fn ($it) => (float) $it->quantity_received > 0);
            if ($allReceived) {
                $po->status = 'Fully Received';
            } elseif ($anyReceived) {
                $po->status = 'Partially Received';
            }
            $po->save();

            $goodsReceivedNote->update(['status' => 'Confirmed']);
        });

        return response()->json($goodsReceivedNote->load('items'));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function validatePayload(Request $request): array
    {
        $data = $request->validate([
            'grn_date' => ['required', 'date'],
            'po_id' => ['required', 'integer', 'exists:purchase_orders,id'],
            'delivery_note_no' => ['nullable', 'string', 'max:100'],
            'received_by' => ['nullable', 'string', 'max:255'],
            'warehouse' => ['nullable', 'string', 'max:100'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.po_item_id' => ['nullable', 'integer'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity_ordered' => ['nullable', 'numeric', 'min:0'],
            'items.*.quantity_received' => ['required', 'numeric', 'min:0'],
            'items.*.quantity_accepted' => ['nullable', 'numeric', 'min:0'],
            'items.*.quantity_rejected' => ['nullable', 'numeric', 'min:0'],
            'items.*.rejection_reason' => ['nullable', 'string', 'max:255'],
            'items.*.batch_serial_no' => ['nullable', 'string', 'max:100'],
            'items.*.condition' => ['nullable', 'string', 'max:30'],
            'items.*.remarks' => ['nullable', 'string', 'max:255'],
        ]);

        foreach ($data['items'] as $i => $row) {
            $received = (float) ($row['quantity_received'] ?? 0);
            $accepted = (float) ($row['quantity_accepted'] ?? $received);
            $rejected = (float) ($row['quantity_rejected'] ?? 0);
            if ($accepted + $rejected > $received + 0.001) {
                throw ValidationException::withMessages([
                    "items.$i" => 'Accepted + Rejected cannot exceed Received quantity.',
                ]);
            }
            if ($rejected > 0 && trim((string) ($row['rejection_reason'] ?? '')) === '') {
                throw ValidationException::withMessages([
                    "items.$i" => 'A rejection reason is required when rejected quantity is greater than zero.',
                ]);
            }
        }

        return $data;
    }

    private function syncItems(GoodsReceivedNote $grn, array $items): void
    {
        foreach ($items as $row) {
            $received = (float) ($row['quantity_received'] ?? 0);
            // Default accepted to received when not explicitly split out.
            $accepted = array_key_exists('quantity_accepted', $row) && $row['quantity_accepted'] !== null
                ? (float) $row['quantity_accepted']
                : $received - (float) ($row['quantity_rejected'] ?? 0);

            GrnItem::create([
                'grn_id' => $grn->id,
                'po_item_id' => $row['po_item_id'] ?? null,
                'description' => $row['description'],
                'quantity_ordered' => (float) ($row['quantity_ordered'] ?? 0),
                'quantity_received' => $received,
                'quantity_accepted' => max($accepted, 0),
                'quantity_rejected' => (float) ($row['quantity_rejected'] ?? 0),
                'rejection_reason' => $row['rejection_reason'] ?? null,
                'batch_serial_no' => $row['batch_serial_no'] ?? null,
                'condition' => $row['condition'] ?? null,
                'remarks' => $row['remarks'] ?? null,
            ]);
        }
    }

    private function nextGrnNumber(): string
    {
        $year = date('Y');
        $prefix = "GRN-{$year}-";
        $last = GoodsReceivedNote::where('grn_number', 'like', $prefix . '%')
            ->orderByDesc('grn_number')
            ->value('grn_number');
        $seq = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }
}
