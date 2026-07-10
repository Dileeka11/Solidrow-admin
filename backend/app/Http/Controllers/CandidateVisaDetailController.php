<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateVisaDetail;
use App\Services\SmsService;
use Illuminate\Http\Request;

class CandidateVisaDetailController extends Controller
{
    /** Return the visa-details record (or a blank default) for a candidate. */
    public function show(Candidate $candidate)
    {
        $visa = CandidateVisaDetail::firstOrNew(['candidate_id' => $candidate->id]);

        return response()->json($this->normalize($visa));
    }

    /** Create or update the country-specific visa workflow dates and statuses. */
    public function save(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            // Romania
            'offer_letter_date'         => ['nullable', 'date'],
            'confirmation_letter_date'  => ['nullable', 'date'],
            'document_submission_date'  => ['nullable', 'date'],
            'work_permit_received_date' => ['nullable', 'date'],
            'embassy_submission_date'   => ['nullable', 'date'],
            'police_report_issued_date' => ['nullable', 'date'],
            'process_interview_date'    => ['nullable', 'date'],
            'visa_received_date'        => ['nullable', 'date'],
            // Israel
            'agreement_sign_date'       => ['nullable', 'date'],
            'police_report_date'        => ['nullable', 'date'],
            // Common
            'visa_status'               => ['nullable', 'in:visa_received,visa_cancel'],
            'visa_status_date'          => ['nullable', 'date'],
            'piba_submission_status'    => ['nullable', 'in:submitted,not_yet_submitted'],
        ]);

        $visa = CandidateVisaDetail::firstOrNew(['candidate_id' => $candidate->id]);

        // Remember the previous visa status so we only text on an actual change.
        $previousStatus = $visa->visa_status;

        $visa->candidate_id = $candidate->id;
        $visa->fill($validated);
        $visa->save();

        // Notify the candidate when the visa status is set or changes.
        if (! empty($visa->visa_status) && $visa->visa_status !== $previousStatus) {
            $this->notifyVisaStatus($candidate, $visa->visa_status);
        }

        return response()->json($this->normalize($visa));
    }

    /** Send the candidate an SMS about their new visa status (placeholder gateway). */
    private function notifyVisaStatus(Candidate $candidate, string $status): void
    {
        $name = $candidate->full_name ?: 'Candidate';
        $message = $status === 'visa_received'
            ? "Dear {$name}, good news! Your visa has been RECEIVED. Please contact Solidrow for the next steps."
            : "Dear {$name}, we regret to inform you that your visa has been CANCELLED. Please contact Solidrow for assistance.";

        SmsService::send($candidate->phone_number, $message);
    }

    private function normalize(CandidateVisaDetail $v): array
    {
        $fmt = fn ($field) => $v->{$field} ? $v->{$field}->format('Y-m-d') : null;

        $dates = [];
        foreach (array_merge(
            CandidateVisaDetail::ROMANIA_DATES,
            CandidateVisaDetail::ISRAEL_DATES,
            CandidateVisaDetail::COMMON_DATES,
        ) as $field) {
            $dates[$field] = $fmt($field);
        }

        return array_merge([
            'id'                     => $v->id,
            'candidate_id'           => $v->candidate_id,
            'visa_status'            => $v->visa_status,
            'piba_submission_status' => $v->piba_submission_status,
        ], $dates);
    }
}
