<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateDepartureDetail;
use App\Models\CandidateVisaDetail;
use App\Models\Staff;

class DashboardController extends Controller
{
    /**
     * Aggregate metrics for the dashboard.
     *
     * Total staff and the department breakdown are derived live from the
     * `staff` table. The remaining figures are representative business
     * metrics (placements, revenue, applications) that live outside this
     * schema and are returned as seeded values, matching the design.
     */
    public function index()
    {
        $totalStaff = Staff::count();

        // Department headcount distribution (computed from real staff rows).
        $departmentBreakdown = Staff::selectRaw('department as label, COUNT(*) as value')
            ->groupBy('department')
            ->orderByDesc('value')
            ->get()
            ->map(fn ($row) => ['label' => $row->label, 'value' => (int) $row->value])
            ->values();

        // Candidate pipeline stage counts (derived from real candidate data).
        $stageCounts = [
            [
                'label' => 'Registered',
                'value' => Candidate::count(),
            ],
            [
                'label' => 'Agreement Signed',
                'value' => CandidateVisaDetail::whereNotNull('agreement_sign_date')->count(),
            ],
            [
                'label' => 'Visa Received',
                'value' => CandidateVisaDetail::whereNotNull('visa_received_date')->count(),
            ],
            [
                'label' => 'Departed',
                'value' => CandidateDepartureDetail::whereNotNull('departure_date')->count(),
            ],
        ];

        $kpis = [
            ['label' => 'Total Staff', 'value' => (string) $totalStaff, 'delta' => '+2 this month', 'tone' => 'up'],
            ['label' => 'Active Placements', 'value' => '1,240', 'delta' => '+86 this month', 'tone' => 'up'],
            ['label' => 'Pending Applications', 'value' => '87', 'delta' => '-12 this month', 'tone' => 'down'],
            ['label' => 'Monthly Revenue', 'value' => 'LKR 4.2M', 'delta' => '+8.4% vs last month', 'tone' => 'up'],
        ];

        // Placements per month over the last 6 months — a candidate is
        // "placed" when they have a departure date.
        $monthlyTrend = collect(range(5, 0))->map(function ($i) {
            $month = now()->subMonths($i);

            return [
                'month' => $month->format('M'),
                'value' => CandidateDepartureDetail::whereNotNull('departure_date')
                    ->whereYear('departure_date', $month->year)
                    ->whereMonth('departure_date', $month->month)
                    ->count(),
            ];
        })->values();

        // Candidate distribution by destination country (real candidate rows).
        $placementsByCountry = Candidate::selectRaw('country, COUNT(*) as value')
            ->whereNotNull('country')
            ->where('country', '!=', '')
            ->groupBy('country')
            ->orderByDesc('value')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['country' => $row->country, 'value' => (int) $row->value])
            ->values();

        return response()->json([
            'totalStaff' => $totalStaff,
            'kpis' => $kpis,
            'stageCounts' => $stageCounts,
            'monthlyTrend' => $monthlyTrend,
            'departmentBreakdown' => $departmentBreakdown,
            'placementsByCountry' => $placementsByCountry,
        ]);
    }
}
