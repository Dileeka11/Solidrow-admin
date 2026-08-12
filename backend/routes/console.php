<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Daily check: staged reminder SMS (45/30/14 days) before Police Report expiry.
Schedule::command('sms:police-report-reminders')->dailyAt('09:00');
