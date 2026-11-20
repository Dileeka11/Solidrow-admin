<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Local install: push every candidate change to the live server.
        if (config('sync.push_enabled')) {
            foreach ([
                \App\Models\Candidate::class,
                \App\Models\CandidateSection::class,
                \App\Models\CandidateTraining::class,
                \App\Models\CandidateDocument::class,
                \App\Models\CandidateVisaDetail::class,
                \App\Models\CandidateEmployeeDetail::class,
                \App\Models\CandidateDepartureDetail::class,
                \App\Models\CandidateRemark::class,
            ] as $model) {
                $model::observe(\App\Sync\CandidateSyncObserver::class);
            }
        }
    }
}
