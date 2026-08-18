<?php

namespace App\Http\Controllers;

use App\Models\PurchaseOrder;
use App\Models\SupplierInvoice;
use App\Models\SupplierInvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupplierInvoiceController extends Controller
{
    /** List invoices (newest first) with supplier, PO and total. */
    public function index()
    {
        return SupplierInvoice::query()
            ->with(['supplier:id,name', 'purchaseOrder:id,po_number'])
            ->withSum('items', 'line_total')
            ->orderByDesc('invoice_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->id,
                'internal_ref_no' => $inv->internal_ref_no,
                'supplier_invoice_no' => $inv->supplier_invoice_no,
                'invoice_date' => $inv->invoice_date?->format('Y-m-d'),
                'due_date' => $inv->due_date?->format('Y-m-d'),
                'po_id' => $inv->po_id,
                'po_number' => $inv->purchaseOrder?->po_number,
                'supplier_name' => $inv->supplier?->name,
                'currency' => $inv->currency,
                'status' => $inv->status,
                'total' => (float) ($inv->items_sum_line_total ?? 0),
            ]);
    }

    public function show(SupplierInvoice $supplierInvoice)
    {
        return response()->json(
            $supplierInvoice->load(['items', 'purchaseOrder:id,po_number,payment_terms', 'supplier:id,name'])
        );
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $po = $data['po_id'] ? PurchaseOrder::find($data['po_id']) : null;

        $invoice = DB::transaction(function () use ($data, $po) {
            $invoice = SupplierInvoice::create([
                'internal_ref_no' => $this->nextRefNo(),
                'supplier_invoice_no' => $data['supplier_invoice_no'] ?? null,
                'invoice_date' => $data['invoice_date'],
                'po_id' => $data['po_id'] ?? null,
                'grn_ids' => $data['grn_ids'] ?? null,
                'supplier_id' => $po?->supplier_id ?? ($data['supplier_id'] ?? null),
                'due_date' => $data['due_date'] ?? $this->deriveDueDate($data['invoice_date'], $po?->payment_terms),
                'currency' => $data['currency'] ?? ($po?->currency ?? 'LKR'),
                'attached_document' => $data['attached_document'] ?? null,
                'status' => 'Draft',
            ]);
            $this->syncItems($invoice, $data['items']);

            return $invoice;
        });

        return response()->json($invoice->load('items'), 201);
    }

    public function update(Request $request, SupplierInvoice $supplierInvoice)
    {
        if ($supplierInvoice->status !== 'Draft') {
            return response()->json(['message' => 'Only a Draft invoice can be edited.'], 409);
        }
        $data = $this->validatePayload($request);
        $po = $data['po_id'] ? PurchaseOrder::find($data['po_id']) : null;

        DB::transaction(function () use ($supplierInvoice, $data, $po) {
            $supplierInvoice->update([
                'supplier_invoice_no' => $data['supplier_invoice_no'] ?? null,
                'invoice_date' => $data['invoice_date'],
                'po_id' => $data['po_id'] ?? null,
                'grn_ids' => $data['grn_ids'] ?? null,
                'supplier_id' => $po?->supplier_id ?? ($data['supplier_id'] ?? null),
                'due_date' => $data['due_date'] ?? $this->deriveDueDate($data['invoice_date'], $po?->payment_terms),
                'currency' => $data['currency'] ?? ($po?->currency ?? 'LKR'),
                'attached_document' => $data['attached_document'] ?? null,
            ]);
            $supplierInvoice->items()->delete();
            $this->syncItems($supplierInvoice, $data['items']);
        });

        return response()->json($supplierInvoice->load('items'));
    }

    public function destroy(SupplierInvoice $supplierInvoice)
    {
        if ($supplierInvoice->status !== 'Draft') {
            return response()->json(['message' => 'Only a Draft invoice can be deleted.'], 409);
        }
        $supplierInvoice->items()->delete();
        $supplierInvoice->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function submit(SupplierInvoice $supplierInvoice)
    {
        return $this->transition($supplierInvoice, ['Draft'], 'Pending Matching', 'submitted for matching');
    }

    /** Run 3-way matching; sets Matched when everything reconciles, else Disputed. */
    public function runMatch(SupplierInvoice $supplierInvoice)
    {
        if (! in_array($supplierInvoice->status, ['Pending Matching', 'Disputed', 'Matched'], true)) {
            return response()->json(['message' => 'Only an invoice pending matching can be matched.'], 409);
        }
        $result = $this->buildMatching($supplierInvoice);
        $supplierInvoice->update(['status' => $result['matched'] ? 'Matched' : 'Disputed']);

        return response()->json(['status' => $supplierInvoice->status, 'matching' => $result]);
    }

    /** The 3-way matching comparison (read-only, callable anytime). */
    public function matching(SupplierInvoice $supplierInvoice)
    {
        return response()->json($this->buildMatching($supplierInvoice));
    }

    public function approve(SupplierInvoice $supplierInvoice)
    {
        return $this->transition($supplierInvoice, ['Matched'], 'Approved for Payment', 'approved for payment');
    }

    public function pay(SupplierInvoice $supplierInvoice)
    {
        return $this->transition($supplierInvoice, ['Approved for Payment'], 'Paid', 'marked paid');
    }

    public function dispute(SupplierInvoice $supplierInvoice)
    {
        return $this->transition($supplierInvoice, ['Pending Matching', 'Matched'], 'Disputed', 'disputed');
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function transition(SupplierInvoice $inv, array $from, string $to, string $verb)
    {
        if (! in_array($inv->status, $from, true)) {
            return response()->json(['message' => "This invoice cannot be {$verb} from its current status."], 409);
        }
        $inv->update(['status' => $to]);

        return response()->json($inv->load('items'));
    }

    /**
     * Build the PO ↔ GRN ↔ Invoice comparison. One row per PO line (or per
     * invoice line when there is no PO), flagging quantity / price / total
     * variances.
     */
    private function buildMatching(SupplierInvoice $invoice): array
    {
        $invoice->loadMissing('items');
        $po = $invoice->po_id ? PurchaseOrder::with('items')->find($invoice->po_id) : null;

        $rows = [];
        $allMatch = true;

        if ($po) {
            foreach ($po->items as $poItem) {
                $invLines = $invoice->items->where('po_item_id', $poItem->id);
                $invoiced = (float) $invLines->sum('quantity_invoiced');
                $invTotal = (float) $invLines->sum('line_total');
                $billed = $invLines->first() ? (float) $invLines->first()->unit_price : null;

                $ordered = (float) $poItem->quantity_ordered;
                $received = (float) $poItem->quantity_received;
                $agreed = (float) $poItem->unit_price;
                $poTotal = (float) $poItem->line_total;

                $qtyMatch = $invoiced <= $received + 0.01 && $invoiced > 0;
                $priceMatch = $billed === null || abs($billed - $agreed) < 0.01;
                $totalMatch = $invTotal <= $poTotal + 0.01;
                if ($invLines->isNotEmpty() && (! $qtyMatch || ! $priceMatch || ! $totalMatch)) {
                    $allMatch = false;
                }

                $rows[] = [
                    'description' => $poItem->description,
                    'ordered_qty' => round($ordered, 2),
                    'received_qty' => round($received, 2),
                    'invoiced_qty' => round($invoiced, 2),
                    'qty_status' => $qtyMatch ? 'Match' : 'Variance',
                    'agreed_price' => round($agreed, 2),
                    'billed_price' => $billed === null ? null : round($billed, 2),
                    'price_status' => $priceMatch ? 'Match' : 'Variance',
                    'po_total' => round($poTotal, 2),
                    'invoice_total' => round($invTotal, 2),
                    'total_status' => $totalMatch ? 'Match' : 'Variance',
                ];
            }
        } else {
            // No PO to match against — everything is a "no reference" variance.
            $allMatch = false;
            foreach ($invoice->items as $it) {
                $rows[] = [
                    'description' => $it->description,
                    'ordered_qty' => null,
                    'received_qty' => null,
                    'invoiced_qty' => round((float) $it->quantity_invoiced, 2),
                    'qty_status' => 'No PO',
                    'agreed_price' => null,
                    'billed_price' => round((float) $it->unit_price, 2),
                    'price_status' => 'No PO',
                    'po_total' => null,
                    'invoice_total' => round((float) $it->line_total, 2),
                    'total_status' => 'No PO',
                ];
            }
        }

        return ['rows' => $rows, 'matched' => $allMatch && ! empty($rows)];
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'supplier_invoice_no' => ['nullable', 'string', 'max:100'],
            'invoice_date' => ['required', 'date'],
            'po_id' => ['nullable', 'integer', 'exists:purchase_orders,id'],
            'grn_ids' => ['nullable', 'array'],
            'grn_ids.*' => ['integer'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'due_date' => ['nullable', 'date'],
            'currency' => ['nullable', 'string', 'max:10'],
            'attached_document' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.po_item_id' => ['nullable', 'integer'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity_invoiced' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);
    }

    private function syncItems(SupplierInvoice $invoice, array $items): void
    {
        foreach ($items as $row) {
            $qty = (float) ($row['quantity_invoiced'] ?? 0);
            $price = (float) ($row['unit_price'] ?? 0);
            $tax = (float) ($row['tax_pct'] ?? 0);
            $base = $qty * $price;
            $lineTotal = round($base + ($base * $tax / 100), 2);

            SupplierInvoiceItem::create([
                'invoice_id' => $invoice->id,
                'po_item_id' => $row['po_item_id'] ?? null,
                'description' => $row['description'],
                'quantity_invoiced' => $qty,
                'unit_price' => $price,
                'tax_pct' => $tax,
                'line_total' => $lineTotal,
            ]);
        }
    }

    /** Net terms → invoice_date + N days. Advance/COD → invoice_date. */
    private function deriveDueDate(string $invoiceDate, ?string $terms): ?string
    {
        if (! $terms) {
            return null;
        }
        if (preg_match('/net\s*(\d+)/i', $terms, $m)) {
            return date('Y-m-d', strtotime($invoiceDate . ' +' . (int) $m[1] . ' days'));
        }
        return $invoiceDate;
    }

    private function nextRefNo(): string
    {
        $year = date('Y');
        $prefix = "INV-{$year}-";
        $last = SupplierInvoice::where('internal_ref_no', 'like', $prefix . '%')
            ->orderByDesc('internal_ref_no')
            ->value('internal_ref_no');
        $seq = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }
}
