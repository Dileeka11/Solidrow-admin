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
            'passport_size_photo'          => ['nullable', 'file', 'mimes:jpg,jpeg,png', 'max:20480'],
            'nic_color_copy'               => $fileRules,
            'passport_color_copy'          => $fileRules,
            'professional_certificate'     => $fileRules,
            'working_experience'           => ['nullable', 'array'],
            'working_experience.*'         => $fileRules,
            'working_experience_keep'      => ['nullable', 'array'],
            'working_experience_keep.*'    => ['string'],
            'cv_copy'                      => $fileRules,
            'police_certificate'           => ['nullable', 'array'],
            'police_certificate.*'         => $fileRules,
            'police_certificate_keep'      => ['nullable', 'array'],
            'police_certificate_keep.*'    => ['string'],
            'certified_police_report'      => ['nullable', 'array'],
            'certified_police_report.*'    => $fileRules,
            'certified_police_report_keep'   => ['nullable', 'array'],
            'certified_police_report_keep.*' => ['string'],
            'police_report_expire_date'    => ['nullable', 'date'],
            'document_submission_date'     => ['nullable', 'date'],
            'document_resubmission_date'   => ['nullable', 'date'],
        ]);

        $documents = CandidateDocument::firstOrNew(['candidate_id' => $candidate->id]);

        // Store any newly uploaded single-file attachments, keeping existing ones untouched.
        foreach (CandidateDocument::FILE_FIELDS as $field) {
            if ($request->hasFile($field)) {
                if ($documents->{$field}) {
                    Storage::disk('public')->delete($documents->{$field});
                }
                $documents->{$field} = $request->file($field)->store('candidate-documents', 'public');
            }
        }

        // Multi-file attachments: retain the paths the client kept, delete the
        // rest, then append any newly uploaded files.
        foreach (CandidateDocument::MULTI_FILE_FIELDS as $field) {
            $existing = (array) ($documents->{$field} ?? []);
            $keep = (array) $request->input($field . '_keep', $existing);

            foreach ($existing as $path) {
                if (! in_array($path, $keep, true)) {
                    Storage::disk('public')->delete($path);
                }
            }

            $paths = array_values(array_intersect($existing, $keep));

            foreach ((array) $request->file($field, []) as $file) {
                $paths[] = $file->store('candidate-documents', 'public');
            }

            $documents->{$field} = $paths;
        }

        // Dated multi-file attachments (police reports): keep the paths the
        // client kept, delete the rest, then append newly uploaded files stamped
        // with today's date so the upload history is preserved.
        foreach (CandidateDocument::DATED_MULTI_FILE_FIELDS as $field) {
            $existing = (array) ($documents->{$field} ?? []);
            $keep = (array) $request->input($field . '_keep', array_column($existing, 'path'));

            $entries = [];
            foreach ($existing as $entry) {
                if (in_array($entry['path'] ?? null, $keep, true)) {
                    $entries[] = $entry;
                } elseif (! empty($entry['path'])) {
                    Storage::disk('public')->delete($entry['path']);
                }
            }

            foreach ((array) $request->file($field, []) as $file) {
                $entries[] = [
                    'path'        => $file->store('candidate-documents', 'public'),
                    'uploaded_at' => now()->toDateString(),
                ];
            }

            $documents->{$field} = $entries;
        }

        // Reset the reminder marker when the expiry date changes so a fresh
        // 45-days-before SMS can go out for the new date.
        $newExpiry = $validated['police_report_expire_date'] ?? null;
        if ((string) $documents->police_report_expire_date?->format('Y-m-d') !== (string) $newExpiry) {
            $documents->police_report_expiry_sms_sent_at = null;
        }

        $documents->fill([
            'police_report_expire_date'  => $newExpiry,
            'document_submission_date'   => $validated['document_submission_date'] ?? null,
            'document_resubmission_date' => $validated['document_resubmission_date'] ?? null,
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

        // Multi-file fields expose a list of { path, url } entries.
        foreach (CandidateDocument::MULTI_FILE_FIELDS as $field) {
            $urls[$field . '_files'] = array_map(
                fn ($path) => ['path' => $path, 'url' => url('media/' . $path)],
                (array) ($d->{$field} ?? [])
            );
        }

        // Dated multi-file fields expose { path, url, uploaded_at }, newest first.
        foreach (CandidateDocument::DATED_MULTI_FILE_FIELDS as $field) {
            $entries = array_map(
                fn ($entry) => [
                    'path'        => $entry['path'] ?? null,
                    'url'         => isset($entry['path']) ? url('media/' . $entry['path']) : null,
                    'uploaded_at' => $entry['uploaded_at'] ?? null,
                ],
                (array) ($d->{$field} ?? [])
            );
            $urls[$field . '_files'] = array_reverse($entries);
        }

        return array_merge([
            'id'                         => $d->id,
            'candidate_id'               => $d->candidate_id,
            'police_report_expire_date'  => $d->police_report_expire_date ? $d->police_report_expire_date->format('Y-m-d') : null,
            'document_submission_date'   => $d->document_submission_date ? $d->document_submission_date->format('Y-m-d') : null,
            'document_resubmission_date' => $d->document_resubmission_date ? $d->document_resubmission_date->format('Y-m-d') : null,
        ], $urls);
    }
}
