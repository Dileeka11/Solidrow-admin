<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateDepartureDetail;
use Illuminate\Http\Request;

class CandidateDepartureDetailController extends Controller
{
    /** Return the departure-details record (or a blank default) for a candidate. */
    public function show(Candidate $candidate)
    {
        $details = CandidateDepartureDetail::firstOrNew(['candidate_id' => $candidate->id]);

        return response()->json($this->normalize($details));
    }

    /** Create or update the departure details (Section 6). */
    public function save(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            'final_approval_date' => ['nullable', 'date'],
            'receipt_number'      => ['nullable', 'string', 'max:255'],
            'flight_number'       => ['nullable', 'string', 'max:255'],
            'airticket_number'    => ['nullable', 'string', 'max:255'],
            'departure_date'      => ['nullable', 'date'],
        ]);

        $details = CandidateDepartureDetail::firstOrNew(['candidate_id' => $candidate->id]);
        $details->candidate_id = $candidate->id;
        $details->fill($validated);
        $details->save();

        return response()->json($this->normalize($details));
    }

    private function normalize(CandidateDepartureDetail $d): array
    {
        return [
            'id'                  => $d->id,
            'candidate_id'        => $d->candidate_id,
            'final_approval_date' => $d->final_approval_date ? $d->final_approval_date->format('Y-m-d') : null,
            'receipt_number'      => $d->receipt_number,
            'flight_number'       => $d->flight_number,
            'airticket_number'    => $d->airticket_number,
            'departure_date'      => $d->departure_date ? $d->departure_date->format('Y-m-d') : null,
        ];
    }
}
