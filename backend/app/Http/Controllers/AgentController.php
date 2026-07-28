<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AgentController extends Controller
{
    /** List all agents (alphabetical). */
    public function index()
    {
        return Agent::orderBy('name')->get();
    }

    /** Create a new agent. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('agents', 'name')],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $agent = Agent::create($data);

        return response()->json($agent, 201);
    }

    /** Update an agent. */
    public function update(Request $request, Agent $agent)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('agents', 'name')->ignore($agent->id)],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $agent->update($data);

        return response()->json($agent);
    }

    /** Delete an agent. */
    public function destroy(Agent $agent)
    {
        $agent->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
