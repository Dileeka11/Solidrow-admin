<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Public "Baddegama" registration + admin call tracking.
 *
 * `created_at` is managed by hand (as in the legacy system) so Eloquent
 * timestamps are disabled.
 */
class BaddegamaRegistration extends Model
{
    protected $table = 'baddegama_registration';

    public $timestamps = false;

    protected $fillable = [
        'registration_code',
        'full_name',
        'nic',
        'passport_number',
        'gender',
        'marital_status',
        'birthday',
        'age',
        'mobile_number',
        'whatsapp_number',
        'province_id',
        'current_job',
        'experience',
        'job_abroad',
        'destination_country',
        'type',
        'result',
        'marks',
        'call_status',
        'employee_status',
        'call_notes',
        'call_date_time',
        'created_at',
    ];

    /**
     * Generate the next registration code for this row's destination country.
     * Format: SDW{countryChar}{yy}B{seq3}  e.g. SDWO26B001, SDWR26B002.
     *   destination_country 3 => R (Romania), 4 => I (Israel), else O.
     */
    public static function generateRegistrationCode($destinationCountry): string
    {
        $countryChar = match ((int) $destinationCountry) {
            3 => 'R',
            4 => 'I',
            default => 'O',
        };

        $prefix = 'SDW' . $countryChar . date('y') . 'B';

        // Highest existing code for this prefix. We order by the *numeric* suffix
        // (not the raw string) so mixed-width legacy codes like SDWI26B999 and
        // SDWI26B01279 still yield the true maximum — always incrementing.
        $suffixStart = strlen($prefix) + 1;
        $last = static::where('registration_code', 'like', $prefix . '%')
            ->orderByRaw('CAST(SUBSTRING(registration_code, ?) AS UNSIGNED) DESC', [$suffixStart])
            ->value('registration_code');

        $lastNumber = $last ? (int) substr($last, strlen($prefix)) : 0;

        return $prefix . str_pad((string) ($lastNumber + 1), 3, '0', STR_PAD_LEFT);
    }

    /**
     * Return a duplicate message if this NIC or mobile already exists, else null.
     */
    public function duplicateMessage(): ?string
    {
        if ($this->nic && static::where('nic', $this->nic)->exists()) {
            return 'NIC already exists in our system.';
        }

        if ($this->mobile_number && static::where('mobile_number', $this->mobile_number)->exists()) {
            return 'Mobile number already exists in our system.';
        }

        return null;
    }

    /**
     * All registrations joined with their location (name + agent) for the admin list.
     */
    public static function allWithLocation()
    {
        return DB::table('baddegama_registration as br')
            ->leftJoin('locations as l', 'br.type', '=', 'l.id')
            ->select('br.*', 'l.name as location_name', 'l.agent as agent_name')
            ->orderByDesc('br.created_at')
            ->orderByDesc('br.id')
            ->get();
    }
}
