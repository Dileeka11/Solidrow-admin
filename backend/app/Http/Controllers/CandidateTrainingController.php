<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateTraining;
use App\Models\JobCategory;
use App\Services\TestNumberService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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
            // Listed so validated() keeps them — otherwise absent marks and the
            // QR scan details are silently dropped on every save.
            'pre_test_cycles.*.attendance_records.*.status'     => ['nullable', 'in:present,absent'],
            'pre_test_cycles.*.attendance_records.*.source'     => ['nullable', 'string', 'max:20'],
            'pre_test_cycles.*.attendance_records.*.staff_id'   => ['nullable', 'integer'],
            'pre_test_cycles.*.attendance_records.*.staff_name' => ['nullable', 'string', 'max:191'],
            'pre_test_cycles.*.test_date'                     => ['nullable', 'date'],
            'pre_test_cycles.*.test_result'                   => ['nullable', 'in:pass,fail'],
            'pre_test_cycles.*.test_agent'                    => ['nullable', 'string', 'max:191'],
            'pre_test_cycles.*.test_number'                   => ['nullable', 'string', 'max:30'],
            'final_test_attendance_records'                   => ['nullable', 'array'],
            'final_test_attendance_records.*.date'            => ['nullable', 'date'],
            'final_test_attendance_records.*.time'            => ['nullable', 'string'],
            'final_test_attendance_records.*.status'          => ['nullable', 'in:present,absent'],
            'final_test_attendance_records.*.source'          => ['nullable', 'string', 'max:20'],
            'final_test_attendance_records.*.staff_id'        => ['nullable', 'integer'],
            'final_test_attendance_records.*.staff_name'      => ['nullable', 'string', 'max:191'],
            'final_test_date'                                 => ['nullable', 'date'],
            'final_test_result'                               => ['nullable', 'in:pass,fail'],
            'final_test_agent'                                => ['nullable', 'string', 'max:191'],
            'demand_id'                                       => ['nullable', 'integer', 'exists:demands,id'],
        ]);

        $data = [
            'training_mode'                 => $validated['training_mode'] ?? null,
            'pre_test_job_category_id'      => $validated['pre_test_job_category_id'] ?? null,
            'pre_test_cycles'               => $validated['pre_test_cycles'] ?? [],
            'final_test_attendance_records' => $validated['final_test_attendance_records'] ?? [],
            'final_test_date'               => $validated['final_test_date'] ?? null,
            'final_test_result'             => $validated['final_test_result'] ?? null,
            'final_test_agent'              => $validated['final_test_agent'] ?? null,
            'demand_id'                     => $validated['demand_id'] ?? null,
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
     * Upload (or replace) only the training bond file, immediately on pick, so the
     * admin can see it was stored without saving the whole training section.
     */
    public function uploadBond(Request $request, Candidate $candidate)
    {
        $request->validate([
            'training_bond' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:20480'],
        ]);

        $training = CandidateTraining::firstOrCreate(
            ['candidate_id' => $candidate->id],
            ['pre_test_cycles' => [], 'final_test_attendance_records' => []]
        );

        $old = $training->training_bond;
        $training->training_bond = $request->file('training_bond')->store('training-bonds', 'public');
        $training->save();

        if ($old && $old !== $training->training_bond) {
            Storage::disk('public')->delete($old);
        }

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
            'status'     => ['nullable', 'in:present,absent'],
        ]);

        $training = CandidateTraining::firstOrCreate(
            ['candidate_id' => $candidate->id],
            ['pre_test_cycles' => [], 'final_test_attendance_records' => []]
        );

        $status = $validated['status'] ?? 'present';
        $record = [
            'date'   => $validated['date'],
            'time'   => $validated['time'] ?? null,
            'source' => 'manual',
            'status' => $status,
        ];

        // Add the date, or — when it already exists — just update its present/absent
        // status (the date is added first, then marked attended or not separately).
        $upsert = function (array $records) use ($record, $status): array {
            $idx = collect($records)->search(fn ($r) => ($r['date'] ?? '') === $record['date']);
            if ($idx === false) {
                $records[] = $record;
            } else {
                $records[$idx]['status'] = $status;
            }
            return $records;
        };

        if ($validated['slot'] === 'final_test') {
            $records = $upsert($training->final_test_attendance_records ?? []);
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
                    'test_agent'         => null,
                    'test_number'        => null,
                ];
            } else {
                $cycles[$idx]['attendance_records'] = $upsert($cycles[$idx]['attendance_records'] ?? []);
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
     * Generate (or return the existing) test number for one test slot.
     * Slots: a specific pre-test cycle, or the final test. Format is
     * <trade code><zero-padded sequence>, e.g. TI001. A single running sequence
     * per trade code is shared across all pre-test cycles and final tests, and
     * every issued number is unique — a number is never reused, even after a
     * cycle or candidate is deleted (the counter only ever increments).
     */
    public function generateTestNumber(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            'pre_test_job_category_id' => ['required', 'exists:job_categories,id'],
            'slot'                     => ['required', 'in:pre_test,final_test'],
            'cycle_no'                 => ['nullable', 'integer', 'min:1'],
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

        // Always keep the trade linked to this candidate's pre-test.
        if ($training->pre_test_job_category_id !== $category->id) {
            $training->pre_test_job_category_id = $category->id;
            $training->save();
        }

        // Don't reissue if this slot already holds a number.
        if ($validated['slot'] === 'final_test') {
            if ($training->final_test_number) {
                return response()->json($this->normalize($training));
            }
        } else {
            $cycleNo = (int) ($validated['cycle_no'] ?? 1);
            $cycles  = $training->pre_test_cycles ?? [];
            $idx     = collect($cycles)->search(fn ($c) => (int) ($c['cycle_no'] ?? 0) === $cycleNo);
            if ($idx !== false && ! empty($cycles[$idx]['test_number'])) {
                return response()->json($this->normalize($training));
            }
        }

        try {
            $number = app(TestNumberService::class)->next($code);
        } catch (\Throwable $e) {
            // Staff PC offline: numbers are reserved on the live server.
            report($e);

            return response()->json([
                'message' => 'Could not reach the live server to reserve a test number. Check the internet connection and try again.',
            ], 503);
        }

        if ($validated['slot'] === 'final_test') {
            $training->update(['final_test_number' => $number]);
        } else {
            $cycleNo = (int) ($validated['cycle_no'] ?? 1);
            $cycles  = $training->pre_test_cycles ?? [];
            $idx     = collect($cycles)->search(fn ($c) => (int) ($c['cycle_no'] ?? 0) === $cycleNo);

            if ($idx === false) {
                $cycles[] = [
                    'cycle_no'           => $cycleNo,
                    'attendance_records' => [],
                    'test_date'          => null,
                    'test_result'        => null,
                    'test_agent'         => null,
                    'test_number'        => $number,
                ];
            } else {
                $cycles[$idx]['test_number'] = $number;
            }
            $training->update(['pre_test_cycles' => $cycles]);
        }

        return response()->json($this->normalize($training));
    }

    private function normalize(CandidateTraining $t): array
    {
        $cycles = array_map(fn ($c) => [
            'cycle_no'           => $c['cycle_no'] ?? 1,
            'attendance_records' => $c['attendance_records'] ?? [],
            'test_date'          => $c['test_date'] ?? null,
            'test_result'        => $c['test_result'] ?? null,
            'test_agent'         => $c['test_agent'] ?? null,
            'test_number'        => $c['test_number'] ?? null,
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
                'test_agent'         => null,
                'test_number'        => null,
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
            'final_test_number'             => $t->final_test_number,
            'final_test_agent'              => $t->final_test_agent,
            'demand_id'                     => $t->demand_id,
        ];
    }
}
