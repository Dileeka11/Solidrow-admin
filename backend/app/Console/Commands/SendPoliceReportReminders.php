<?php

namespace App\Console\Commands;

use App\Models\CandidateDocument;
use App\Services\SmsService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Notify candidates whose Police Report is about to expire.
 *
 * Reminders are sent in three stages — 45, 30 and 14 days before the expiry
 * date. Each candidate receives at most one SMS per stage: the
 * police_report_reminder_stage marker stores the last-sent stage (in days
 * before expiry), so the scheduler can miss a day without sending duplicates
 * and a candidate added late still gets the most-urgent stage they've reached.
 * The marker is reset whenever the expiry date changes (see
 * CandidateDocumentController), starting a fresh reminder cycle.
 */
class SendPoliceReportReminders extends Command
{
    protected $signature = 'sms:police-report-reminders';

    protected $description = 'Send staged reminder SMS (45/30/14 days) before a candidate\'s Police Report expires';

    /** Reminder stages in "days before expiry", most-distant first. */
    private const STAGES = [45, 30, 14];

    public function handle(): int
    {
        $today = Carbon::today();
        $windowEnd = $today->copy()->addDays(self::STAGES[0]);

        $documents = CandidateDocument::with('candidate')
            ->whereNotNull('police_report_expire_date')
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

            // The most-urgent stage reached = the smallest stage threshold that
            // the remaining days still falls within (e.g. 25 days left → 30).
            $currentStage = null;
            foreach (self::STAGES as $stage) {
                if ($daysLeft <= $stage) {
                    $currentStage = $stage;
                }
            }
            if ($currentStage === null) {
                continue; // outside every window
            }

            // Skip if this (or a later, more-urgent) stage was already sent.
            // Stages decrease as urgency rises, so an already-sent stage <= the
            // current one means nothing new to send.
            $lastStage = $doc->police_report_reminder_stage;
            if ($lastStage !== null && $lastStage <= $currentStage) {
                continue;
            }

            $name = $candidate->full_name ?: 'Candidate';
            $expireOn = Carbon::parse($doc->police_report_expire_date)->format('d M Y');
            $message = "Dear {$name}, your Police Report will expire on {$expireOn} ({$daysLeft} days remaining). "
                . "Please renew it before the expiry date to avoid any delays in your process. - Solidrow";

            if (SmsService::send($candidate->phone_number, $message)) {
                $doc->police_report_reminder_stage = $currentStage;
                $doc->police_report_expiry_sms_sent_at = now();
                $doc->save();
                $sent++;
            }
        }

        $this->info("Police report reminders processed: {$documents->count()} candidate(s), {$sent} SMS sent.");

        return self::SUCCESS;
    }
}
