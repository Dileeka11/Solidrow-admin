<?php

namespace App\Http\Controllers;

use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ItemController extends Controller
{
    public function index()
    {
        return Item::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Item::create($data), 201);
    }

    public function update(Request $request, Item $item)
    {
        $data = $this->validated($request, $item->id);

        $item->update($data);

        return response()->json($item);
    }

    public function destroy(Item $item)
    {
        $item->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'item_code' => ['nullable', 'string', 'max:50', Rule::unique('items', 'item_code')->ignore($ignoreId)],
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:item_categories,id'],
            'uom' => ['nullable', 'string', 'max:30'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);
    }
}
