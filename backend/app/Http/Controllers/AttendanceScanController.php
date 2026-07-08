<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateTraining;
use Illuminate\Http\Request;

class AttendanceScanController extends Controller
{
    /**
     * Called by the mobile app when a QR code is scanned.
     *
     * Requires a valid Sanctum token (staff must be logged in).
     * Payload: { candidate_reg_no: string, attended_date?: string (default = today) }
     *
     * Stores { date, time, source, staff_id, staff_name } records.
     * Rejects duplicate for the same date.
     */
    public function scan(Request $request)
    {
        $validated = $request->validate([
            'candidate_reg_no' => ['required', 'string'],
            'attended_date'    => ['nullable', 'date'],
        ]);

        $staff  = $request->user();
        $regNo  = trim($validated['candidate_reg_no']);
        $now    = now();
        $date   = $validated['attended_date'] ?? $now->toDateString();
        $time   = $now->format('H:i:s');
        $record = [
            'date'       => $date,
            'time'       => $time,
            'source'     => 'qr',
            'staff_id'   => $staff->id,
            'staff_name' => $staff->name,
        ];

        $candidate = Candidate::where('candidate_reg_no', $regNo)->first();
        if (! $candidate) {
            return response()->json([
                'success' => false,
                'message' => 'Candidate not found.',
            ], 404);
        }

        $training = CandidateTraining::firstOrCreate(
            ['candidate_id' => $candidate->id],
            ['pre_test_cycles' => [], 'final_test_attendance_records' => []]
        );

        $mode   = $training->training_mode;
        $cycles = $training->pre_test_cycles ?? [];

        // ── Determine active slot ──────────────────────────────────────────
        $slot     = null;
        $cycleIdx = null;

        if ($mode === 'final_test') {
            $slot = 'final_test';
        } elseif ($mode === 'pre_test' || $mode === 'both') {
            $activeIdx = null;
            foreach ($cycles as $i => $c) {
                if (($c['test_result'] ?? null) !== 'pass') {
                    $activeIdx = $i;
                    break;
                }
            }
            if ($activeIdx !== null) {
                $slot     = 'pre_test';
                $cycleIdx = $activeIdx;
            } else {
                $slot = 'final_test';
            }
        } else {
            // Mode not set yet — default to pre-test cycle 1
            $slot = 'pre_test';
            if (empty($cycles)) {
                $cycles[] = [
                    'cycle_no'           => 1,
                    'attendance_records' => [],
                    'test_date'          => null,
                    'test_result'        => null,
                ];
            }
            $cycleIdx = 0;
        }

        // ── Record ────────────────────────────────────────────────────────
        if ($slot === 'pre_test') {
            $existing = $cycles[$cycleIdx]['attendance_records'] ?? [];
            $alreadyMarked = collect($existing)->contains('date', $date);
            if ($alreadyMarked) {
                return response()->json([
                    'success'         => false,
                    'message'         => 'Attendance already marked for today.',
                    'candidate_name'  => $candidate->full_name,
                    'date'            => $date,
                    'cycle_no'        => $cycles[$cycleIdx]['cycle_no'],
                    'attendance_days' => count($existing),
                ], 409);
            }
            $cycles[$cycleIdx]['attendance_records'][] = $record;
            $training->update(['pre_test_cycles' => $cycles]);

            $cycleNo   = $cycles[$cycleIdx]['cycle_no'];
            $totalDays = count($cycles[$cycleIdx]['attendance_records']);

            return response()->json([
                'success'          => true,
                'message'          => "Attendance marked for Pre Test Cycle {$cycleNo}.",
                'candidate_name'   => $candidate->full_name,
                'candidate_reg_no' => $regNo,
                'date'             => $date,
                'time'             => $time,
                'slot'             => 'pre_test',
                'cycle_no'         => $cycleNo,
                'attendance_days'  => $totalDays,
                'days_remaining'   => max(0, 7 - $totalDays),
            ]);
        }

        // Final test
        $existing      = $training->final_test_attendance_records ?? [];
        $alreadyMarked = collect($existing)->contains('date', $date);
        if ($alreadyMarked) {
            return response()->json([
                'success'         => false,
                'message'         => 'Attendance already marked for today.',
                'candidate_name'  => $candidate->full_name,
                'date'            => $date,
                'slot'            => 'final_test',
                'attendance_days' => count($existing),
            ], 409);
        }
        $existing[] = $record;
        $training->update(['final_test_attendance_records' => $existing]);

        return response()->json([
            'success'          => true,
            'message'          => 'Attendance marked for Final Test.',
            'candidate_name'   => $candidate->full_name,
            'candidate_reg_no' => $regNo,
            'date'             => $date,
            'time'             => $time,
            'slot'             => 'final_test',
            'attendance_days'  => count($existing),
        ]);
    }
}
