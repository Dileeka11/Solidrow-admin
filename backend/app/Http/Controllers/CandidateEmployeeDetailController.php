<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateEmployeeDetail;
use Illuminate\Http\Request;

class CandidateEmployeeDetailController extends Controller
{
    /** Return the employee-details record (or a blank default) for a candidate. */
    public function show(Candidate $candidate)
    {
        $details = CandidateEmployeeDetail::firstOrNew(['candidate_id' => $candidate->id]);

        return response()->json($this->normalize($details));
    }

    /** Create or update the employee details (Section 5). */
    public function save(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            'registration_number' => ['nullable', 'string', 'max:255'],
            'job_category_id'     => ['nullable', 'integer', 'exists:job_categories,id'],
        ]);

        $details = CandidateEmployeeDetail::firstOrNew(['candidate_id' => $candidate->id]);
        $details->candidate_id = $candidate->id;
        $details->fill($validated);
        $details->save();

        return response()->json($this->normalize($details));
    }

    private function normalize(CandidateEmployeeDetail $d): array
    {
        return [
            'id'                  => $d->id,
            'candidate_id'        => $d->candidate_id,
            // Entered manually — no auto-fill from the candidate's registration number.
            'registration_number' => $d->registration_number,
            'job_category_id'     => $d->job_category_id,
        ];
    }
}
