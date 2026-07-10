<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Placeholder SMS sender.
 *
 * No real gateway is wired up yet — every message is logged so the workflow
 * can be tested end-to-end. To go live, replace the body of send() with a real
 * gateway call (Text.lk / Notify.lk / Dialog / Twilio, etc.); the call sites
 * do not need to change.
 */
class SmsService
{
    /**
     * "Send" an SMS. Returns true when the message was accepted (always true
     * for the placeholder). A blank recipient is skipped.
     */
    public static function send(?string $to, string $message): bool
    {
        $to = trim((string) $to);
        if ($to === '') {
            Log::warning('SmsService: no recipient, message skipped', ['message' => $message]);
            return false;
        }

        // TODO: replace with a real SMS gateway request.
        Log::info('SmsService (placeholder) — SMS not actually sent', [
            'to'      => $to,
            'message' => $message,
        ]);

        return true;
    }
}
