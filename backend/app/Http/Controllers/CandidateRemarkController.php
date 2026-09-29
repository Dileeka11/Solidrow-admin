<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateRemark;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CandidateRemarkController extends Controller
{
    /**
     * Progress statuses a remark can set. `resumed` marks a candidate who had
     * dropped/paused coming back into the pipeline.
     */
    private const STATUSES = ['on_hold', 'dropped', 'resumed'];

    /** Full remark history for a candidate, newest first. */
    public function index(Candidate $candidate)
    {
        return $candidate->remarks()->with('createdBy:id,name')->get();
    }

    /**
     * Record a new remark and update the candidate's cached progress_status.
     * The candidate row is never deleted — the reason and history are retained
     * so staff can see why someone stalled if they return later.
     */
    public function store(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            'section_no' => ['nullable', 'integer', 'min:1', 'max:7'],
            'status' => ['required', Rule::in(self::STATUSES)],
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        // A `resumed` remark puts the candidate back into the active pipeline;
        // otherwise the candidate takes on the remark's status.
        $newStatus = $validated['status'] === 'resumed' ? 'active' : $validated['status'];

        $remark = DB::transaction(function () use ($validated, $candidate, $newStatus, $request) {
            $remark = CandidateRemark::create([
                'candidate_id' => $candidate->id,
                'section_no' => $validated['section_no'] ?? $candidate->current_section,
                'status' => $validated['status'],
                'reason' => $validated['reason'],
                'created_by' => optional($request->user())->id,
            ]);

            $candidate->update([
                'progress_status' => $newStatus,
                'status_changed_at' => now(),
            ]);

            return $remark;
        });

        return response()->json($remark->load('createdBy:id,name'), 201);
    }
}
