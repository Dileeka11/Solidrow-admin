<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Item;
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

        $stationery = ItemCategory::where('name', 'Stationery')->value('id');
        $it = ItemCategory::where('name', 'IT Equipment')->value('id');

        $items = [
            ['item_code' => 'STN-001', 'name' => 'A4 Photocopy Paper (80gsm)', 'category_id' => $stationery, 'uom' => 'Box', 'unit_price' => 2500],
            ['item_code' => 'STN-002', 'name' => 'Ballpoint Pen (Blue)', 'category_id' => $stationery, 'uom' => 'Pack', 'unit_price' => 350],
            ['item_code' => 'IT-001', 'name' => 'Wireless Mouse', 'category_id' => $it, 'uom' => 'Pcs', 'unit_price' => 1800],
            ['item_code' => 'IT-002', 'name' => 'USB Flash Drive 32GB', 'category_id' => $it, 'uom' => 'Pcs', 'unit_price' => 1500],
        ];

        foreach ($items as $item) {
            Item::firstOrCreate(['item_code' => $item['item_code']], $item);
        }
    }
}
