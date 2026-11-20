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
        // Candidate sync: a node (staff PC) pushes changes to the hub; the hub
        // (live) logs changes made on the live site so the PCs pull them.
        if (\App\Sync\Sync::isNode() || \App\Sync\Sync::isHub()) {
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
