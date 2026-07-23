<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SMS sender backed by the Ozone Sender gateway.
 *
 * Behaviour is driven by config('services.ozone'):
 *   - driver "log"   → messages are only written to the log (safe for testing)
 *   - driver "ozone" → a real request is sent to the Ozone endpoint
 *
 * Call sites stay unchanged: SmsService::send($phone, $message).
 */
class SmsService
{
    /**
     * "Send" an SMS. Returns true when the message was accepted by the gateway
     * (or logged in log mode). A blank recipient is skipped.
     */
    public static function send(?string $to, string $message): bool
    {
        $to = self::normalizeNumber($to);
        if ($to === '') {
            Log::warning('SmsService: no recipient, message skipped', ['message' => $message]);
            return false;
        }

        $config = config('services.ozone');

        if (($config['driver'] ?? 'log') !== 'ozone') {
            Log::info('SmsService (log driver) — SMS not actually sent', [
                'to'      => $to,
                'message' => $message,
            ]);
            return true;
        }

        try {
            $response = Http::asForm()
                ->timeout(20)
                ->post($config['endpoint'], [
                    'user_id'              => $config['user_id'],
                    'api_key'              => $config['api_key'],
                    'sender_id'            => $config['sender_id'],
                    'recipient_contact_no' => $to,
                    'message'              => $message,
                ]);

            // Ozone returns HTTP 200 even on failure; the real result is in the
            // JSON status_code (204 = accepted/queued).
            $body = $response->json();
            $statusCode = isset($body['status_code']) ? (int) $body['status_code'] : null;

            if ($response->successful() && $statusCode === 204) {
                Log::info('SmsService: SMS sent via Ozone', ['to' => $to, 'msg_id' => $body['msg_id'] ?? null]);
                return true;
            }

            Log::error('SmsService: Ozone gateway rejected the message', [
                'to'          => $to,
                'http'        => $response->status(),
                'status_code' => $statusCode,
                'body'        => $response->body(),
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::error('SmsService: Ozone request failed', ['to' => $to, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Normalise a Sri Lankan mobile number to the 94XXXXXXXXX international
     * form the gateway expects. Leaves already-international numbers alone.
     */
    private static function normalizeNumber(?string $to): string
    {
        $to = preg_replace('/[^0-9]/', '', (string) $to);
        if ($to === '' || $to === null) {
            return '';
        }

        if (str_starts_with($to, '0')) {
            return '94' . substr($to, 1);
        }
        if (str_starts_with($to, '94')) {
            return $to;
        }
        if (strlen($to) === 9) { // e.g. 7XXXXXXXX without leading 0
            return '94' . $to;
        }

        return $to;
    }
}
