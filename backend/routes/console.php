<?php

use App\Sync\Sync;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

if (Sync::isNode()) {
    // Staff PC: pull other PCs' / live-site changes every minute.
    Schedule::command('sync:pull')->everyMinute()->withoutOverlapping(10);
} else {
    // Daily check: staged reminder SMS (45/30/14 days) before Police Report expiry.
    // Never on a staff PC, or every PC would send the same SMS.
    Schedule::command('sms:police-report-reminders')->dailyAt('09:00');
}
