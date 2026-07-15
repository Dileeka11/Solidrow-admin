<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateTraining;
use App\Models\JobCategory;
use Illuminate\Http\Request;

class CandidateTrainingController extends Controller
{
    /** Return the training record (or a blank default) for a candidate. */
    public function show(Candidate $candidate)
    {
        $training = CandidateTraining::firstOrNew(['candidate_id' => $candidate->id]);

        return response()->json($this->normalize($training));
    }

    /** Create or update training mode, bond file, and test results. */
    public function save(Request $request, Candidate $candidate)
    {
        // FormData sends JSON arrays as strings — decode them before validation.
        foreach (['pre_test_cycles', 'final_test_attendance_records'] as $field) {
            $val = $request->input($field);
            if (is_string($val)) {
                $request->merge([$field => json_decode($val, true) ?? []]);
            }
        }

        $validated = $request->validate([
            'training_mode'    => ['nullable', 'in:pre_test,final_test,both'],
            'training_bond'    => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:20480'],
            'pre_test_job_category_id' => ['nullable', 'exists:job_categories,id'],
            'pre_test_cycles'  => ['nullable', 'array'],
            'pre_test_cycles.*.cycle_no'                      => ['required', 'integer', 'min:1'],
            'pre_test_cycles.*.attendance_records'            => ['nullable', 'array'],
            'pre_test_cycles.*.attendance_records.*.date'     => ['nullable', 'date'],
            'pre_test_cycles.*.attendance_records.*.time'     => ['nullable', 'string'],
            'pre_test_cycles.*.test_date'                     => ['nullable', 'date'],
            'pre_test_cycles.*.test_result'                   => ['nullable', 'in:pass,fail'],
            'final_test_attendance_records'                   => ['nullable', 'array'],
            'final_test_attendance_records.*.date'            => ['nullable', 'date'],
            'final_test_attendance_records.*.time'            => ['nullable', 'string'],
            'final_test_date'                                 => ['nullable', 'date'],
            'final_test_result'                               => ['nullable', 'in:pass,fail'],
        ]);

        $data = [
            'training_mode'                 => $validated['training_mode'] ?? null,
            'pre_test_job_category_id'      => $validated['pre_test_job_category_id'] ?? null,
            'pre_test_cycles'               => $validated['pre_test_cycles'] ?? [],
            'final_test_attendance_records' => $validated['final_test_attendance_records'] ?? [],
            'final_test_date'               => $validated['final_test_date'] ?? null,
            'final_test_result'             => $validated['final_test_result'] ?? null,
        ];

        if ($request->hasFile('training_bond')) {
            $data['training_bond'] = $request->file('training_bond')->store('training-bonds', 'public');
        }

        $training = CandidateTraining::updateOrCreate(
            ['candidate_id' => $candidate->id],
            $data
        );

        return response()->json($this->normalize($training));
    }

    /**
     * Auto-save a single attendance record from the admin UI.
     * Called immediately when the user clicks "+ Add Date" (no full-form save needed).
     */
    public function addAttendance(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            'slot'       => ['required', 'in:pre_test,final_test'],
            'cycle_no'   => ['nullable', 'integer', 'min:1'],
            'date'       => ['required', 'date'],
            'time'       => ['nullable', 'string', 'max:20'],
        ]);

        $training = CandidateTraining::firstOrCreate(
            ['candidate_id' => $candidate->id],
            ['pre_test_cycles' => [], 'final_test_attendance_records' => []]
        );

        $record = [
            'date'   => $validated['date'],
            'time'   => $validated['time'] ?? null,
            'source' => 'manual',
        ];

        if ($validated['slot'] === 'final_test') {
            $records = $training->final_test_attendance_records ?? [];
            if (! collect($records)->contains('date', $record['date'])) {
                $records[] = $record;
            }
            $training->update(['final_test_attendance_records' => $records]);
        } else {
            $cycleNo = (int) ($validated['cycle_no'] ?? 1);
            $cycles  = $training->pre_test_cycles ?? [];
            $idx     = collect($cycles)->search(fn ($c) => ($c['cycle_no'] ?? 0) === $cycleNo);

            if ($idx === false) {
                $cycles[] = [
                    'cycle_no'           => $cycleNo,
                    'attendance_records' => [$record],
                    'test_date'          => null,
                    'test_result'        => null,
                ];
            } else {
                $existing = $cycles[$idx]['attendance_records'] ?? [];
                if (! collect($existing)->contains('date', $record['date'])) {
                    $existing[] = $record;
                }
                $cycles[$idx]['attendance_records'] = $existing;
            }
            $training->update(['pre_test_cycles' => $cycles]);
        }

        return response()->json($this->normalize($training));
    }

    /** Remove a single attendance record. */
    public function removeAttendance(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            'slot'     => ['required', 'in:pre_test,final_test'],
            'cycle_no' => ['nullable', 'integer', 'min:1'],
            'date'     => ['required', 'date'],
        ]);

        $training = CandidateTraining::where('candidate_id', $candidate->id)->firstOrFail();

        if ($validated['slot'] === 'final_test') {
            $records = collect($training->final_test_attendance_records ?? [])
                ->reject(fn ($r) => ($r['date'] ?? '') === $validated['date'])
                ->values()->all();
            $training->update(['final_test_attendance_records' => $records]);
        } else {
            $cycleNo = (int) ($validated['cycle_no'] ?? 1);
            $cycles  = $training->pre_test_cycles ?? [];
            foreach ($cycles as &$c) {
                if (($c['cycle_no'] ?? 0) === $cycleNo) {
                    $c['attendance_records'] = collect($c['attendance_records'] ?? [])
                        ->reject(fn ($r) => ($r['date'] ?? '') === $validated['date'])
                        ->values()->all();
                    break;
                }
            }
            unset($c);
            $training->update(['pre_test_cycles' => $cycles]);
        }

        return response()->json($this->normalize($training));
    }

    /**
     * Generate (or return the existing) pre-test number for a candidate.
     * Format: <trade code><zero-padded sequence>, e.g. TI001. The sequence is
     * per trade code, taken from the highest existing number with that prefix.
     */
    public function generatePreTestNumber(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            'pre_test_job_category_id' => ['required', 'exists:job_categories,id'],
        ]);

        $category = JobCategory::findOrFail($validated['pre_test_job_category_id']);
        $code = strtoupper(trim($category->code ?? ''));
        if ($code === '') {
            return response()->json([
                'message' => 'The selected trade has no code. Add a code on the Job Categories page first.',
            ], 422);
        }

        $training = CandidateTraining::firstOrCreate(
            ['candidate_id' => $candidate->id],
            ['pre_test_cycles' => [], 'final_test_attendance_records' => []]
        );

        // Keep the existing number if this candidate already has one for the same trade.
        if ($training->pre_test_number && $training->pre_test_job_category_id === $category->id) {
            return response()->json($this->normalize($training));
        }

        // Next sequence for this trade code across all candidates.
        $maxSeq = CandidateTraining::where('pre_test_number', 'like', $code . '%')
            ->get()
            ->map(fn ($t) => (int) preg_replace('/\D/', '', substr((string) $t->pre_test_number, strlen($code))))
            ->max() ?? 0;

        $number = $code . str_pad((string) ($maxSeq + 1), 3, '0', STR_PAD_LEFT);

        $training->update([
            'pre_test_job_category_id' => $category->id,
            'pre_test_number'          => $number,
        ]);

        return response()->json($this->normalize($training));
    }

    private function normalize(CandidateTraining $t): array
    {
        $cycles = array_map(fn ($c) => [
            'cycle_no'           => $c['cycle_no'] ?? 1,
            'attendance_records' => $c['attendance_records'] ?? [],
            'test_date'          => $c['test_date'] ?? null,
            'test_result'        => $c['test_result'] ?? null,
        ], $t->pre_test_cycles ?? []);

        if (
            in_array($t->training_mode, ['pre_test', 'both'], true)
            && empty($cycles)
        ) {
            $cycles = [[
                'cycle_no'           => 1,
                'attendance_records' => [],
                'test_date'          => null,
                'test_result'        => null,
            ]];
        }

        return [
            'id'                            => $t->id,
            'candidate_id'                  => $t->candidate_id,
            'training_mode'                 => $t->training_mode,
            'training_bond_url'             => $t->training_bond_url,
            'pre_test_job_category_id'      => $t->pre_test_job_category_id,
            'pre_test_number'               => $t->pre_test_number,
            'pre_test_cycles'               => $cycles,
            'final_test_attendance_records' => $t->final_test_attendance_records ?? [],
            'final_test_date'               => $t->final_test_date ? $t->final_test_date->format('Y-m-d') : null,
            'final_test_result'             => $t->final_test_result,
        ];
    }
}
