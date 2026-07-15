<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Service Letter attachment (stored in `working_experience`) can now hold
 * multiple files. Widen the column to text and convert existing single-path
 * values into a JSON array so both old and new records read the same way.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->text('working_experience')->nullable()->change();
        });

        DB::table('candidate_documents')
            ->whereNotNull('working_experience')
            ->where('working_experience', '<>', '')
            ->where('working_experience', 'not like', '[%')
            ->update(['working_experience' => DB::raw('JSON_ARRAY(working_experience)')]);
    }

    public function down(): void
    {
        // Collapse arrays back to the first path before narrowing the column.
        DB::table('candidate_documents')
            ->whereNotNull('working_experience')
            ->where('working_experience', 'like', '[%')
            ->update(['working_experience' => DB::raw("JSON_UNQUOTE(JSON_EXTRACT(working_experience, '$[0]'))")]);

        Schema::table('candidate_documents', function (Blueprint $table) {
            $table->string('working_experience')->nullable()->change();
        });
    }
};
