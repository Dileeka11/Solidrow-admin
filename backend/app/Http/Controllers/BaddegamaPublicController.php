<?php

namespace App\Http\Controllers;

use App\Models\BaddegamaRegistration;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Public (unauthenticated) endpoints for the Baddegama registration form:
 * master dropdowns, the OTP phone-verification handshake, and the sign-up itself.
 *
 * OTP state is kept in the cache (keyed by mobile) instead of a PHP session so
 * the flow works with the token-based, stateless API.
 */
class BaddegamaPublicController extends Controller
{
    private const OTP_TTL = 300;        // 5 minutes
    private const VERIFIED_TTL = 1800;  // 30 minutes to complete the form after verifying

    private const MOBILE_REGEX = '/^07[01245678][0-9]{7}$/';

    // ── Master data ────────────────────────────────────────────────────────
    public function provinces()
    {
        return DB::table('provinces')->select('id', 'name')->orderBy('queue')->orderBy('name')->get();
    }

    public function countries()
    {
        return DB::table('countries')->select('id', 'name')->orderBy('name')->get();
    }

    /** The location id new public sign-ups are attached to. */
    public function activeLocation()
    {
        $id = DB::table('locations')->where('is_active_registration', 1)->value('id');

        return response()->json(['type' => $id ?: 2]);
    }

    /** Resolve a scanned location id to its name, so the form can show which branch it is. */
    public function location(int $location)
    {
        $row = DB::table('locations')->select('id', 'name')->where('id', $location)->first();

        if (! $row) {
            return response()->json(['message' => 'Location not found.'], 404);
        }

        return response()->json($row);
    }

    // ── OTP handshake ──────────────────────────────────────────────────────
    public function sendOtp(Request $request)
    {
        $mobile = trim((string) $request->input('mobile', ''));

        if ($mobile === '' || ! preg_match(self::MOBILE_REGEX, $mobile)) {
            return response()->json(['status' => 'error', 'message' => 'Please enter a valid mobile number (e.g. 0771234567).']);
        }

        $otp = random_int(100000, 999999);
        Cache::put($this->otpKey($mobile), $otp, self::OTP_TTL);

        $sent = SmsService::send($mobile, "Your Solidrow verification code is: {$otp}. Valid for 5 minutes.");

        if (! $sent) {
            return response()->json(['status' => 'error', 'message' => 'Failed to send SMS. Please try again later.']);
        }

        return response()->json(['status' => 'success', 'message' => 'OTP sent successfully.']);
    }

    public function verifyOtp(Request $request)
    {
        $mobile = trim((string) $request->input('mobile', ''));
        $code = trim((string) $request->input('otp', ''));

        $expected = Cache::get($this->otpKey($mobile));

        if ($expected === null) {
            return response()->json(['status' => 'error', 'message' => 'OTP expired or not sent.']);
        }

        if ((string) $expected !== $code) {
            return response()->json(['status' => 'error', 'message' => 'Invalid OTP code.']);
        }

        Cache::forget($this->otpKey($mobile));
        Cache::put($this->verifiedKey($mobile), true, self::VERIFIED_TTL);

        return response()->json(['status' => 'success', 'message' => 'Mobile number verified successfully.']);
    }

    // ── Sign-up ────────────────────────────────────────────────────────────
    public function register(Request $request)
    {
        $mobile = (string) $request->input('mobile_number', '');

        // Only a mobile that just passed OTP verification may register.
        if (! Cache::get($this->verifiedKey($mobile))) {
            return response()->json(['status' => 'error', 'message' => 'Mobile number verification failed. Please verify your number.']);
        }

        if ($error = $this->validatePayload($request)) {
            return response()->json(['status' => 'error', 'message' => $error]);
        }

        $reg = new BaddegamaRegistration();
        $reg->fill($this->mapFields($request));
        $reg->created_at = now()->format('Y-m-d H:i:s');
        $reg->type = $request->input('type') ?: (DB::table('locations')->where('is_active_registration', 1)->value('id') ?: 2);

        if ($dup = $reg->duplicateMessage()) {
            return response()->json(['status' => 'error', 'message' => $dup]);
        }

        $reg->registration_code = BaddegamaRegistration::generateRegistrationCode($reg->destination_country);
        $reg->save();

        // Clear the one-time verification so the number can't silently re-register.
        Cache::forget($this->verifiedKey($mobile));

        $title = $reg->gender === 'male' ? 'Mr.' : 'Ms.';
        $message = "Welcome!\n {$title} {$reg->full_name} You are now registered with Solidrow FESTI (Pvt) Ltd, "
            . "Foreign Employment Agency. Your Reg No: {$reg->registration_code}";
        $smsSent = SmsService::send($reg->mobile_number, $message);

        return response()->json([
            'status' => 'success',
            'id' => $reg->id,
            'registration_code' => $reg->registration_code,
            'sms_status' => $smsSent ? 'SMS sent successfully.' : 'SMS sending failed.',
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Map the incoming public fields onto the model's fillable set. */
    private function mapFields(Request $request): array
    {
        return [
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
            'experience' => $request->input('experience') ?: 0,
            'job_abroad' => $request->input('job_abroad'),
            'destination_country' => $request->input('destination_country') ?: 0,
        ];
    }

    /** Server-side mirror of the public form validation. Returns an error string or null. */
    private function validatePayload(Request $request): ?string
    {
        $required = [
            'full_name' => 'Full Name',
            'nic' => 'NIC',
            'birthday' => 'Birthday',
            'age' => 'Age',
            'gender' => 'Gender',
            'marital_status' => 'Marital Status',
            'mobile_number' => 'Mobile Number',
            'province_id' => 'Province',
            'current_job' => 'Current Job',
            'experience' => 'Experience',
            'destination_country' => 'Destination Country',
        ];
        foreach ($required as $field => $label) {
            if (trim((string) $request->input($field)) === '') {
                return "{$label} is required.";
            }
        }

        if (! preg_match(self::MOBILE_REGEX, (string) $request->input('mobile_number'))) {
            return 'Invalid mobile number format. Must be 10 digits starting with 07.';
        }

        $nic = (string) $request->input('nic');
        if (strlen($nic) === 10) {
            if (! preg_match('/^[0-9]{9}[vVxX]$/', $nic)) {
                return 'Invalid Old NIC format. (e.g., 123456789V)';
            }
        } elseif (strlen($nic) === 12) {
            if (! preg_match('/^[0-9]{12}$/', $nic)) {
                return 'Invalid New NIC format. (e.g., 123456789012)';
            }
        } else {
            return 'Invalid NIC number length. Must be 10 or 12 characters.';
        }

        $passport = (string) $request->input('passport_number');
        if ($passport !== '' && ! preg_match('/^[NP][0-9]+$/', $passport)) {
            return 'Invalid passport number. Starts with N or P followed by numbers.';
        }

        return null;
    }

    private function otpKey(string $mobile): string
    {
        return 'bdg_otp:' . $mobile;
    }

    private function verifiedKey(string $mobile): string
    {
        return 'bdg_verified:' . $mobile;
    }
}
