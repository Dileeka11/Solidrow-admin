<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateEmployeeDetail;
use App\Models\CandidateSection;
use App\Models\SectionAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CandidateController extends Controller
{
    private const TOTAL_SECTIONS = 6;

    private const SECTION_TITLES = [
        'Personal Details',
        'Training Details',
        'Document Attachment',
        'Job & Visa Processing',
        'Departure Details',
        'Employee Details',
    ];

    /**
     * List candidates with their section assignments.
     */
    public function index()
    {
        return Candidate::with('sections')->orderByDesc('id')->get();
    }

    /**
     * Public progress lookup — match a candidate by passport / mobile / NIC
     * and return only their per-section completion state (no other personal data).
     */
    public function publicProgress(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '') {
            return response()->json(['message' => 'Enter your passport, mobile or NIC number.'], 422);
        }

        $candidate = Candidate::with('sections')
            ->where(function ($query) use ($q) {
                $query->where('passport_number', $q)
                    ->orWhere('nic', $q)
                    ->orWhere('phone_number', $q)
                    ->orWhere('whatsapp_number', $q);
            })
            ->first();

        if (! $candidate) {
            return response()->json(['message' => 'No registration found for that number.'], 404);
        }

        $submitted = $candidate->sections
            ->where('status', 'submitted')
            ->pluck('section_no')
            ->all();

        // Prefer the manually-entered Employee Details (Section 6) registration number;
        // fall back to the auto-generated registration number when not yet entered.
        $employeeRegNo = CandidateEmployeeDetail::where('candidate_id', $candidate->id)
            ->value('registration_number');

        return response()->json([
            'full_name' => $candidate->full_name,
            'registration_no' => $employeeRegNo ?: $candidate->registration_no,
            'total_sections' => self::TOTAL_SECTIONS,
            'is_completed' => (bool) $candidate->is_completed,
            'sections' => array_map(fn ($n) => [
                'section_no' => $n,
                'title' => self::SECTION_TITLES[$n - 1],
                'submitted' => in_array($n, $submitted, true),
            ], range(1, self::TOTAL_SECTIONS)),
        ]);
    }

    /**
     * Show a single candidate with sections.
     */
    public function show(Candidate $candidate)
    {
        return $candidate->load('sections');
    }

    /**
     * Preview the next auto Registration No (so the form can show it).
     */
    public function nextRegistrationNo(Request $request)
    {
        return response()->json([
            'registration_no' => $this->buildRegistrationNo($request),
        ]);
    }

    /**
     * Create a candidate (Section 1) + seed the section assignments.
     */
    public function store(Request $request)
    {
        $data = $this->validatePersonal($request);

        $data['registration_no'] = $this->buildRegistrationNo($request);
        $data['created_by'] = optional($request->user())->id;
        $data['current_section'] = 1;

        if ($request->hasFile('passport_image')) {
            $data['passport_image'] = $request->file('passport_image')
                ->store('candidates', 'public');
        }

        // Sections are staffed globally (section-wise), not per candidate.
        $defaults = SectionAssignment::get()
            ->mapWithKeys(fn ($a) => [$a->section_no => array_values(array_map('intval', (array) $a->staff_ids))])
            ->all();

        $candidate = DB::transaction(function () use ($data, $defaults) {
            $candidate = Candidate::create($data);

            for ($n = 1; $n <= self::TOTAL_SECTIONS; $n++) {
                $ids = $defaults[$n] ?? [];
                CandidateSection::create([
                    'candidate_id' => $candidate->id,
                    'section_no' => $n,
                    'assigned_staff_ids' => $ids,
                    'assigned_staff_id' => $ids[0] ?? null,
                    // Section 1 is submitted on create; the rest wait their turn.
                    'status' => $n === 1 ? 'submitted' : 'pending',
                    'submitted_at' => $n === 1 ? now() : null,
                ]);
            }

            $candidate->update(['current_section' => 2]);

            return $candidate;
        });

        return response()->json($candidate->load('sections'), 201);
    }

    /**
     * Update Section 1 details and/or the section staff assignments.
     */
    public function update(Request $request, Candidate $candidate)
    {
        $data = $this->validatePersonal($request, $candidate);

        if ($request->hasFile('passport_image')) {
            $data['passport_image'] = $request->file('passport_image')
                ->store('candidates', 'public');
        }

        $candidate->update($data);

        // Re-apply section assignments if provided.
        $assignments = $this->parseAssignments($request);
        if ($assignments) {
            foreach ($assignments as $sectionNo => $staffIds) {
                CandidateSection::where('candidate_id', $candidate->id)
                    ->where('section_no', $sectionNo)
                    ->update([
                        'assigned_staff_ids' => json_encode($staffIds),
                        'assigned_staff_id' => $staffIds[0] ?? null,
                    ]);
            }
        }

        return response()->json($candidate->load('sections'));
    }

    /**
     * Mark a section submitted and unlock the next one.
     */
    public function submitSection(Request $request, Candidate $candidate)
    {
        $validated = $request->validate([
            'section_no' => ['required', 'integer', 'min:1', 'max:' . self::TOTAL_SECTIONS],
        ]);
        $n = (int) $validated['section_no'];

        // updateOrCreate so legacy candidates without a seeded section row still submit.
        CandidateSection::updateOrCreate(
            ['candidate_id' => $candidate->id, 'section_no' => $n],
            ['status' => 'submitted', 'submitted_at' => now()]
        );

        $next = min($n + 1, self::TOTAL_SECTIONS);
        $candidate->update([
            'current_section' => $next,
            'is_completed' => $n >= self::TOTAL_SECTIONS,
        ]);

        return response()->json($candidate->load('sections'));
    }

    public function destroy(Candidate $candidate)
    {
        $candidate->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * Build the auto Registration No: SDW/YYYY/MM/DD/{userId}/{seq}.
     */
    private function buildRegistrationNo(Request $request): string
    {
        $seq = (int) (Candidate::max('id') ?? 0) + 1;
        $userId = optional($request->user())->id ?? 1;

        return sprintf('SDW/%s/%s/%s/%d/%d', date('Y'), date('m'), date('d'), $userId, $seq);
    }

    /**
     * Read section->staff assignments from the request
     * (assignments[1]=[id,id] ...).
     *
     * @return array<int,array<int,int>>
     */
    private function parseAssignments(Request $request): array
    {
        $raw = $request->input('assignments', []);
        if (is_string($raw)) {
            $raw = json_decode($raw, true) ?: [];
        }

        $out = [];
        foreach ((array) $raw as $sectionNo => $staffIds) {
            $ids = [];
            foreach ((array) $staffIds as $id) {
                $id = (int) $id;
                if ($id > 0 && ! in_array($id, $ids, true)) {
                    $ids[] = $id;
                }
            }
            $out[(int) $sectionNo] = $ids;
        }

        return $out;
    }

    private function validatePersonal(Request $request, ?Candidate $candidate = null): array
    {
        return $request->validate([
            'candidate_reg_no' => ['nullable', 'string', 'max:255'],
            'full_name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'nic' => ['nullable', 'string', 'max:20'],
            'birth_date' => ['nullable', 'string', 'max:20'],
            'gender' => ['nullable', 'string', 'max:20'],
            'passport_retention' => ['nullable', Rule::in(['yes', 'no'])],
            'passport_collected_date' => ['nullable', 'date'],
            'passport_number' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:15'],
            'whatsapp_number' => ['nullable', 'string', 'max:15'],
            'province' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'ds_division' => ['nullable', 'string', 'max:100'],
            'gn_division' => ['nullable', 'string', 'max:100'],
            'staff_coordinator' => ['nullable', 'string', 'max:255'],
            'agent' => ['nullable', 'string', 'max:255'],
            'other_coordinator' => ['nullable', 'boolean'],
            'other_coordinator_name' => ['nullable', 'string', 'max:255'],
            'other_coordinator_mobile' => ['nullable', 'string', 'max:15'],
            'country' => ['nullable', Rule::in(['Romania', 'Israel'])],
            'candidate_skill' => ['nullable', Rule::in(['skill', 'unskill', 'training'])],
            'registration_date' => ['nullable', 'date'],
            'passport_image' => ['nullable', 'image', 'max:20480'], // up to 20MB
        ]);
    }
}
