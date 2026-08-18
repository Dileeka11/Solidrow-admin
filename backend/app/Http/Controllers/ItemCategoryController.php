<?php

namespace App\Http\Controllers;

use App\Models\ItemCategory;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ItemCategoryController extends Controller
{
    public function index()
    {
        return ItemCategory::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('item_categories', 'name')],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(ItemCategory::create($data), 201);
    }

    public function update(Request $request, ItemCategory $itemCategory)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('item_categories', 'name')->ignore($itemCategory->id)],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $itemCategory->update($data);

        return response()->json($itemCategory);
    }

    public function destroy(ItemCategory $itemCategory)
    {
        $itemCategory->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
