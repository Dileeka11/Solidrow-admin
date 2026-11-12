<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Indexes for the columns the app filters / sorts / counts on, so list
     * pages and the dashboard stay fast as the data grows.
     *
     * @var array<string, array<int, string>>
     */
    private array $indexes = [
        'candidates' => [
            'full_name', 'registration_date', 'candidate_reg_no', 'country',
            'candidate_skill', 'passport_number', 'phone_number', 'whatsapp_number',
            'created_at',
        ],
        'candidate_sections' => ['status'],
        'candidate_departure_details' => ['departure_date'],
        'candidate_visa_details' => ['agreement_sign_date', 'visa_received_date', 'visa_status'],
        'candidate_training' => ['demand_id'],
        'baddegama_registration' => ['created_at', 'type'],
    ];

    public function up(): void
    {
        foreach ($this->indexes as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach ($columns as $column) {
                if (! Schema::hasColumn($table, $column) || Schema::hasIndex($table, [$column])) {
                    continue;
                }
                Schema::table($table, fn (Blueprint $t) => $t->index($column, "perf_{$table}_{$column}"));
            }
        }
    }

    public function down(): void
    {
        foreach ($this->indexes as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach ($columns as $column) {
                $name = "perf_{$table}_{$column}";
                if (Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
                }
            }
        }
    }
};
