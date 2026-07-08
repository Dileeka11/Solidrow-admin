<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Global (candidate-independent) default staff for each section 1..8.
     * A new candidate's section rows are seeded from this mapping.
     */
    public function up(): void
    {
        Schema::create('section_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('section_no')->unique(); // 1..8
            $table->foreignId('staff_id')->nullable();           // staff.id
            $table->timestamps();
        });

        DB::table('permissions')->insert([
            ['module' => 'Sections', 'action' => 'view', 'label' => 'Section Assignment · View', 'sort_order' => 17, 'created_at' => now(), 'updated_at' => now()],
            ['module' => 'Sections', 'action' => 'edit', 'label' => 'Section Assignment · Edit', 'sort_order' => 18, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        DB::table('permissions')->where('module', 'Sections')->delete();
        Schema::dropIfExists('section_assignments');
    }
};
