<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Daily check: SMS candidates whose Police Report is 45 days from expiry.
Schedule::command('sms:police-report-reminders')->dailyAt('09:00');
