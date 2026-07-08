<?php

namespace App\Http\Controllers;

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

        $kpis = [
            ['label' => 'Total Staff', 'value' => (string) $totalStaff, 'delta' => '+2 this month', 'tone' => 'up'],
            ['label' => 'Active Placements', 'value' => '1,240', 'delta' => '+86 this month', 'tone' => 'up'],
            ['label' => 'Pending Applications', 'value' => '87', 'delta' => '-12 this month', 'tone' => 'down'],
            ['label' => 'Monthly Revenue', 'value' => 'LKR 4.2M', 'delta' => '+8.4% vs last month', 'tone' => 'up'],
        ];

        $monthlyTrend = [
            ['month' => 'Jan', 'value' => 180],
            ['month' => 'Feb', 'value' => 205],
            ['month' => 'Mar', 'value' => 195],
            ['month' => 'Apr', 'value' => 240],
            ['month' => 'May', 'value' => 255],
            ['month' => 'Jun', 'value' => 290],
        ];

        $placementsByCountry = [
            ['country' => 'Saudi Arabia', 'value' => 420],
            ['country' => 'United Arab Emirates', 'value' => 310],
            ['country' => 'Qatar', 'value' => 265],
            ['country' => 'Kuwait', 'value' => 180],
            ['country' => 'Oman', 'value' => 95],
        ];

        return response()->json([
            'totalStaff' => $totalStaff,
            'kpis' => $kpis,
            'monthlyTrend' => $monthlyTrend,
            'departmentBreakdown' => $departmentBreakdown,
            'placementsByCountry' => $placementsByCountry,
        ]);
    }
}
