<?php

namespace App\Http\Controllers;

use App\Models\JobCategory;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class JobCategoryController extends Controller
{
    /** List all job categories (alphabetical). */
    public function index()
    {
        return JobCategory::orderBy('name')->get();
    }

    /** Create a new job category. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('job_categories', 'name')],
        ]);

        $category = JobCategory::create($data);

        return response()->json($category, 201);
    }

    /** Update a job category. */
    public function update(Request $request, JobCategory $jobCategory)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('job_categories', 'name')->ignore($jobCategory->id)],
        ]);

        $jobCategory->update($data);

        return response()->json($jobCategory);
    }

    /** Delete a job category. */
    public function destroy(JobCategory $jobCategory)
    {
        $jobCategory->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
