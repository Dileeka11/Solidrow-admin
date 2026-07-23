<?php

namespace App\Console\Commands;

use App\Models\CandidateDocument;
use App\Services\SmsService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Notify candidates whose Police Report is about to expire.
 *
 * A single reminder SMS is sent once the expiry date is within
 * REMINDER_DAYS (45) days. The police_report_expiry_sms_sent_at marker
 * guarantees each candidate is only messaged once per expiry date, even if
 * the scheduler misses a day.
 */
class SendPoliceReportReminders extends Command
{
    protected $signature = 'sms:police-report-reminders';

    protected $description = 'Send a reminder SMS when a candidate\'s Police Report is 45 days from expiry';

    private const REMINDER_DAYS = 45;

    public function handle(): int
    {
        $today = Carbon::today();
        $windowEnd = $today->copy()->addDays(self::REMINDER_DAYS);

        $documents = CandidateDocument::with('candidate')
            ->whereNotNull('police_report_expire_date')
            ->whereNull('police_report_expiry_sms_sent_at')
            ->whereDate('police_report_expire_date', '>=', $today)
            ->whereDate('police_report_expire_date', '<=', $windowEnd)
            ->get();

        $sent = 0;

        foreach ($documents as $doc) {
            $candidate = $doc->candidate;
            if (! $candidate) {
                continue;
            }

            $daysLeft = $today->diffInDays(Carbon::parse($doc->police_report_expire_date), false);
            $name = $candidate->full_name ?: 'Candidate';
            $message = "ආයුබෝවන් {$name}, ඔයාගේ Police Report එක තව දවස් {$daysLeft}කින් Expire වෙනවා. කරුණාකර අලුත් කරගන්න. - Solidrow";

            if (SmsService::send($candidate->phone_number, $message)) {
                $doc->police_report_expiry_sms_sent_at = now();
                $doc->save();
                $sent++;
            }
        }

        $this->info("Police report reminders processed: {$documents->count()} candidate(s), {$sent} SMS sent.");

        return self::SUCCESS;
    }
}
