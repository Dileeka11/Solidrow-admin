<?php

namespace App\Http\Controllers;

use App\Models\BaddegamaRegistration;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin management of Baddegama registrations: list (with location + agent),
 * view, edit (result + call-centre tracking) and delete.
 */
class BaddegamaRegistrationController extends Controller
{
    /** List every registration joined with its location name + foreign agent. */
    public function index()
    {
        return BaddegamaRegistration::allWithLocation();
    }

    /** A single registration with the resolved province / country / location names. */
    public function show(BaddegamaRegistration $baddegamaRegistration)
    {
        $reg = $baddegamaRegistration;

        return response()->json([
            'registration' => $reg,
            'province_name' => DB::table('provinces')->where('id', $reg->province_id)->value('name'),
            'country_name' => DB::table('countries')->where('id', $reg->destination_country)->value('name'),
            'location_name' => DB::table('locations')->where('id', $reg->type)->value('name'),
            'agent_name' => DB::table('locations')->where('id', $reg->type)->value('agent'),
        ]);
    }

    /** Locations for the admin filter dropdown. */
    public function locations()
    {
        return DB::table('locations')
            ->select('id', 'name', 'agent', 'is_active_registration')
            ->orderBy('name')
            ->get();
    }

    /**
     * Update a registration. Editable fields cover the personal/job data plus the
     * admin-only result, marks and call-centre tracking. A result SMS is sent when
     * (and only when) a result is set on this save.
     */
    public function update(Request $request, BaddegamaRegistration $baddegamaRegistration)
    {
        $reg = $baddegamaRegistration;

        $reg->fill(array_filter([
            'full_name' => $request->input('full_name'),
            'nic' => $request->input('nic'),
            'passport_number' => $request->input('passport_number'),
            'gender' => $request->input('gender'),
            'marital_status' => $request->input('marital_status'),
            'birthday' => $request->input('birthday'),
            'age' => $request->input('age'),
            'mobile_number' => $request->input('mobile_number'),
            'whatsapp_number' => $request->input('whatsapp_number'),
            'province_id' => $request->input('province_id'),
            'current_job' => $request->input('current_job'),
            'experience' => $request->input('experience'),
            'job_abroad' => $request->input('job_abroad'),
            'destination_country' => $request->input('destination_country'),
            'type' => $request->input('type'),
        ], fn ($v) => $v !== null));

        // Admin-only fields: applied when present in the request.
        foreach (['call_status', 'employee_status', 'call_notes', 'result', 'marks'] as $field) {
            if ($request->has($field)) {
                $reg->{$field} = $request->input($field);
            }
        }
        if ($request->has('call_date_time')) {
            $reg->call_date_time = str_replace('T', ' ', (string) $request->input('call_date_time'));
        }

        $reg->save();

        $smsStatus = '';
        $result = trim((string) $request->input('result', ''));
        if ($result !== '') {
            $smsStatus = $this->sendResultSms($reg, $result);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Registration updated successfully.',
            'sms_status' => $smsStatus,
            'registration' => $reg,
        ]);
    }

    public function destroy(BaddegamaRegistration $baddegamaRegistration)
    {
        $baddegamaRegistration->delete();

        return response()->json(['status' => 'success', 'message' => 'Registration deleted successfully.']);
    }

    /** Send the exam-result SMS matching the chosen result. */
    private function sendResultSms(BaddegamaRegistration $reg, string $result): string
    {
        $title = $reg->gender === 'male' ? 'Mr.' : 'Ms.';
        $name = $reg->full_name;

        if (strcasecmp($result, 'Pass + Training') === 0) {
            $message = "Congratulations.\nYou have passed the test, but the training provided by our training institute "
                . 'is mandatory to appear for the final test. An officer from our training institute will contact you.';
        } elseif (strcasecmp($result, 'Pass') === 0) {
            $message = "Congratulations! {$title} {$name}, you have successfully passed your exam. The training provided "
                . 'by our training institute is mandatory to appear for the final test. An officer from our training '
                . 'institute will contact you.';
        } else {
            $message = "Dear {$title} {$name}, unfortunately, you did not pass the exam this time. The training provided "
                . 'by our training institute is mandatory to appear for the final test. An officer from our training '
                . 'institute will contact you.';
        }

        return SmsService::send($reg->mobile_number, $message)
            ? 'SMS sent successfully.'
            : 'SMS sending failed.';
    }
}
