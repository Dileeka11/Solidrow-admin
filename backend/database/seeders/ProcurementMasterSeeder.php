<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\ItemCategory;
use Illuminate\Database\Seeder;

/**
 * Stage-01 procurement master data: the departments the requisitions belong to,
 * and the item categories used on PR/PO lines. Idempotent (firstOrCreate).
 */
class ProcurementMasterSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Solidrow', 'RKB', 'Travel Tube'] as $name) {
            Department::firstOrCreate(['name' => $name], ['status' => 'Active']);
        }

        foreach (['Stationery', 'IT Equipment', 'Raw Material'] as $name) {
            ItemCategory::firstOrCreate(['name' => $name]);
        }
    }
}
