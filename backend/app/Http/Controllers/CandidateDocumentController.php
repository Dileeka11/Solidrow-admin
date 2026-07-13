<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CandidateDocumentController extends Controller
{
    /** Return the documents record (or a blank default) for a candidate. */
    public function show(Candidate $candidate)
    {
        $documents = CandidateDocument::firstOrNew(['candidate_id' => $candidate->id]);

        return response()->json($this->normalize($documents));
    }

    /** Create or update the attachment files and submission dates. */
    public function save(Request $request, Candidate $candidate)
    {
        $fileRules = ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:20480'];

        $validated = $request->validate([
            'passport_size_photo'      => ['nullable', 'file', 'mimes:jpg,jpeg,png', 'max:20480'],
            'nic_color_copy'           => $fileRules,
            'passport_color_copy'      => $fileRules,
            'professional_certificate' => $fileRules,
            'working_experience'       => $fileRules,
            'cv_copy'                  => $fileRules,
            'local_pcc'                => $fileRules,
            'second_pcc_color_copy'    => $fileRules,
            'local_pcc_attach_date'    => ['nullable', 'date'],
            'second_pcc_submit_date'   => ['nullable', 'date'],
            'document_submission_date' => ['nullable', 'date'],
        ]);

        $documents = CandidateDocument::firstOrNew(['candidate_id' => $candidate->id]);

        // Store any newly uploaded files, keeping existing ones untouched.
        foreach (CandidateDocument::FILE_FIELDS as $field) {
            if ($request->hasFile($field)) {
                if ($documents->{$field}) {
                    Storage::disk('public')->delete($documents->{$field});
                }
                $documents->{$field} = $request->file($field)->store('candidate-documents', 'public');
            }
        }

        $documents->fill([
            'local_pcc_attach_date'    => $validated['local_pcc_attach_date'] ?? null,
            'second_pcc_submit_date'   => $validated['second_pcc_submit_date'] ?? null,
            'document_submission_date' => $validated['document_submission_date'] ?? null,
        ]);

        $documents->candidate_id = $candidate->id;
        $documents->save();

        return response()->json($this->normalize($documents));
    }

    private function normalize(CandidateDocument $d): array
    {
        $urls = [];
        foreach (CandidateDocument::FILE_FIELDS as $field) {
            $urls[$field . '_url'] = $d->{$field} ? url('media/' . $d->{$field}) : null;
        }

        return array_merge([
            'id'                       => $d->id,
            'candidate_id'             => $d->candidate_id,
            'local_pcc_attach_date'    => $d->local_pcc_attach_date ? $d->local_pcc_attach_date->format('Y-m-d') : null,
            'second_pcc_submit_date'   => $d->second_pcc_submit_date ? $d->second_pcc_submit_date->format('Y-m-d') : null,
            'document_submission_date' => $d->document_submission_date ? $d->document_submission_date->format('Y-m-d') : null,
        ], $urls);
    }
}
