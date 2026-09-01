<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\FinancialYear;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalesInvoiceController extends Controller
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Generate next invoice number in format INV-YYYY-NNN. */
    private function nextInvoiceNumber(): string
    {
        $year = date('Y');
        $prefix = "INV-{$year}-";
        $last = SalesInvoice::where('invoice_number', 'like', "{$prefix}%")
            ->orderBy('invoice_number', 'desc')
            ->value('invoice_number');
        $seq = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($seq, 3, '0', STR_PAD_LEFT);
    }

    // ── Index ─────────────────────────────────────────────────────────────────

    /** GET /accounting/sales-invoices */
    public function index(Request $request)
    {
        $q = SalesInvoice::with('paymentAccount:id,name');

        if ($request->filled('financial_year_id')) {
            $q->where('financial_year_id', $request->financial_year_id);
        }
        if ($request->filled('status')) {
            $q->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($query) use ($s) {
                $query->where('invoice_number', 'like', "%{$s}%")
                      ->orWhere('customer_name', 'like', "%{$s}%");
            });
        }

        return $q->orderBy('invoice_date', 'desc')->get();
    }

    /** GET /accounting/sales-invoices/{id} */
    public function show(SalesInvoice $salesInvoice)
    {
        return $salesInvoice->load(['items', 'paymentAccount:id,name', 'financialYear:id,year_name']);
    }

    // ── Store ─────────────────────────────────────────────────────────────────

    /** POST /accounting/sales-invoices */
    public function store(Request $request)
    {
        $data = $this->validated($request);

        return DB::transaction(function () use ($data) {
            // 1. Create invoice.
            $invoice = SalesInvoice::create([
                'invoice_number'     => $this->nextInvoiceNumber(),
                'financial_year_id'  => $data['financial_year_id'] ?? null,
                'invoice_date'       => $data['invoice_date'],
                'due_date'           => $data['due_date'] ?? null,
                'customer_name'      => $data['customer_name'],
                'customer_phone'     => $data['customer_phone'] ?? null,
                'customer_address'   => $data['customer_address'] ?? null,
                'payment_method'     => $data['payment_method'],
                'payment_account_id' => $data['payment_account_id'] ?? null,
                'subtotal'           => $data['subtotal'],
                'tax_amount'         => $data['tax_amount'],
                'total'              => $data['total'],
                'currency'           => $data['currency'] ?? 'LKR',
                'notes'              => $data['notes'] ?? null,
                'status'             => 'Issued',
            ]);

            // 2. Save line items.
            foreach ($data['items'] as $row) {
                $invoice->items()->create($row);
            }

            // 3. Auto-generate Journal Entry (double-entry).
            $this->postJournal($invoice, $data);

            return response()->json($invoice->load('items'), 201);
        });
    }

    /** PUT /accounting/sales-invoices/{id} */
    public function update(Request $request, SalesInvoice $salesInvoice)
    {
        if ($salesInvoice->status === 'Paid') {
            return response()->json(['message' => 'Cannot edit a paid invoice.'], 422);
        }

        $data = $this->validated($request, $salesInvoice);

        return DB::transaction(function () use ($salesInvoice, $data) {
            $salesInvoice->update([
                'financial_year_id'  => $data['financial_year_id'] ?? $salesInvoice->financial_year_id,
                'invoice_date'       => $data['invoice_date'],
                'due_date'           => $data['due_date'] ?? null,
                'customer_name'      => $data['customer_name'],
                'customer_phone'     => $data['customer_phone'] ?? null,
                'customer_address'   => $data['customer_address'] ?? null,
                'payment_method'     => $data['payment_method'],
                'payment_account_id' => $data['payment_account_id'] ?? null,
                'subtotal'           => $data['subtotal'],
                'tax_amount'         => $data['tax_amount'],
                'total'              => $data['total'],
                'notes'              => $data['notes'] ?? null,
            ]);

            // Replace line items.
            $salesInvoice->items()->delete();
            foreach ($data['items'] as $row) {
                $salesInvoice->items()->create($row);
            }

            // Re-post journal.
            if ($salesInvoice->journal_entry_id) {
                JournalLine::where('entry_id', $salesInvoice->journal_entry_id)->delete();
                JournalEntry::find($salesInvoice->journal_entry_id)?->delete();
                $salesInvoice->update(['journal_entry_id' => null]);
            }
            $this->postJournal($salesInvoice->fresh(), $data);

            return response()->json($salesInvoice->fresh()->load('items'));
        });
    }

    /** DELETE /accounting/sales-invoices/{id} */
    public function destroy(SalesInvoice $salesInvoice)
    {
        if ($salesInvoice->status === 'Paid') {
            return response()->json(['message' => 'Cannot delete a paid invoice.'], 422);
        }

        DB::transaction(function () use ($salesInvoice) {
            if ($salesInvoice->journal_entry_id) {
                JournalLine::where('entry_id', $salesInvoice->journal_entry_id)->delete();
                JournalEntry::find($salesInvoice->journal_entry_id)?->delete();
            }
            $salesInvoice->items()->delete();
            $salesInvoice->delete();
        });

        return response()->json(['message' => 'Deleted.']);
    }

    /** POST /accounting/sales-invoices/{id}/mark-paid */
    public function markPaid(SalesInvoice $salesInvoice)
    {
        $salesInvoice->update(['status' => 'Paid']);
        return response()->json($salesInvoice);
    }

    // ── Private: Journal posting ──────────────────────────────────────────────

    /**
     * Auto-generate double-entry journal lines for a sales invoice.
     *
     * Payment via Cash in Hand:
     *   DR  Cash in Hand Account   (total)
     *   CR  Sales Revenue Account  (total)
     *
     * Payment via Bank:
     *   DR  Bank Account (HNB / selected)  (total)
     *   CR  Sales Revenue Account           (total)
     *
     * If no matching accounts are found (system not yet set up), skip silently.
     */
    private function postJournal(SalesInvoice $invoice, array $data): void
    {
        $paymentAccountId = $data['payment_account_id'] ?? null;

        // Try to find a default Sales Revenue account (first account with "revenue" or "income" in name).
        $revenueAccount = Account::where('is_active', true)
            ->where(function ($q) {
                $q->where('name', 'like', '%Revenue%')
                  ->orWhere('name', 'like', '%Income%')
                  ->orWhere('name', 'like', '%Sales%');
            })
            ->first();

        if (! $paymentAccountId || ! $revenueAccount) {
            return; // Skip if accounts aren't configured yet.
        }

        $je = JournalEntry::create([
            'financial_year_id'  => $invoice->financial_year_id,
            'entry_date'         => $invoice->invoice_date,
            'posting_date'       => $invoice->invoice_date,
            'reference'          => $invoice->invoice_number,
            'invoice_number'     => $invoice->invoice_number,
            'customer_name'      => $invoice->customer_name,
            'payment_method'     => $invoice->payment_method,
            'payment_account_id' => $paymentAccountId,
            'source_type'        => 'sales_invoice',
            'source_id'          => $invoice->id,
            'currency'           => $invoice->currency,
            'memo'               => "Sales Invoice {$invoice->invoice_number} — {$invoice->customer_name}",
        ]);

        // Debit: payment account (cash/bank)
        JournalLine::create([
            'entry_id'   => $je->id,
            'account_id' => $paymentAccountId,
            'debit'      => $invoice->total,
            'credit'     => 0,
            'memo'       => "Receipt: {$invoice->invoice_number}",
        ]);

        // Credit: revenue account
        JournalLine::create([
            'entry_id'   => $je->id,
            'account_id' => $revenueAccount->id,
            'debit'      => 0,
            'credit'     => $invoice->total,
            'memo'       => "Sales: {$invoice->invoice_number}",
        ]);

        $invoice->update(['journal_entry_id' => $je->id]);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private function validated(Request $request, ?SalesInvoice $existing = null): array
    {
        return $request->validate([
            'financial_year_id'      => ['nullable', 'integer', 'exists:financial_years,id'],
            'invoice_date'           => ['required', 'date'],
            'due_date'               => ['nullable', 'date', 'after_or_equal:invoice_date'],
            'customer_name'          => ['required', 'string', 'max:150'],
            'customer_phone'         => ['nullable', 'string', 'max:30'],
            'customer_address'       => ['nullable', 'string', 'max:500'],
            'payment_method'         => ['required', 'in:cash_in_hand,bank'],
            'payment_account_id'     => ['nullable', 'integer', 'exists:accounts,id'],
            'subtotal'               => ['required', 'numeric', 'min:0'],
            'tax_amount'             => ['required', 'numeric', 'min:0'],
            'total'                  => ['required', 'numeric', 'min:0'],
            'currency'               => ['nullable', 'string', 'max:10'],
            'notes'                  => ['nullable', 'string', 'max:500'],
            'items'                  => ['required', 'array', 'min:1'],
            'items.*.description'    => ['required', 'string', 'max:255'],
            'items.*.quantity'       => ['required', 'numeric', 'min:0.01'],
            'items.*.uom'            => ['nullable', 'string', 'max:20'],
            'items.*.unit_price'     => ['required', 'numeric', 'min:0'],
            'items.*.tax_pct'        => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.line_total'     => ['required', 'numeric', 'min:0'],
        ]);
    }
}
