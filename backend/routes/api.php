<?php

use App\Http\Controllers\AttendanceScanController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CandidateController;
use App\Http\Controllers\CandidateDocumentController;
use App\Http\Controllers\CandidateTrainingController;
use App\Http\Controllers\CandidateVisaDetailController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SectionAssignmentController;
use App\Http\Controllers\StaffController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Authenticated (Sanctum bearer token)
Route::middleware('auth:sanctum')->group(function () {
    // Mobile app — QR attendance scan (requires logged-in staff)
    Route::post('/attendance/scan', [AttendanceScanController::class, 'scan']);

    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::get('/locations/provinces', [LocationController::class, 'provinces']);
    Route::get('/locations/districts', [LocationController::class, 'districts']);
    Route::get('/locations/ds-divisions', [LocationController::class, 'dsDivisions']);
    Route::get('/locations/gn-divisions', [LocationController::class, 'gnDivisions']);

    Route::apiResource('staff', StaffController::class);

    Route::get('/section-assignments', [SectionAssignmentController::class, 'index']);
    Route::put('/section-assignments', [SectionAssignmentController::class, 'update']);

    Route::get('/candidates/next-registration-no', [CandidateController::class, 'nextRegistrationNo']);
    Route::post('/candidates/{candidate}/submit-section', [CandidateController::class, 'submitSection']);
    Route::apiResource('candidates', CandidateController::class);

    // Section 2 — Training Details
    Route::get('/candidates/{candidate}/training', [CandidateTrainingController::class, 'show']);
    Route::post('/candidates/{candidate}/training', [CandidateTrainingController::class, 'save']);
    Route::post('/candidates/{candidate}/training/attendance/add', [CandidateTrainingController::class, 'addAttendance']);
    Route::post('/candidates/{candidate}/training/attendance/remove', [CandidateTrainingController::class, 'removeAttendance']);

    // Section 3 — Personal Details (Attachment)
    Route::get('/candidates/{candidate}/documents', [CandidateDocumentController::class, 'show']);
    Route::post('/candidates/{candidate}/documents', [CandidateDocumentController::class, 'save']);

    // Section 4 — Job & Visa Processing
    Route::get('/candidates/{candidate}/visa-details', [CandidateVisaDetailController::class, 'show']);
    Route::post('/candidates/{candidate}/visa-details', [CandidateVisaDetailController::class, 'save']);

    Route::get('/roles', [RoleController::class, 'index']);
    Route::post('/roles', [RoleController::class, 'store']);
    Route::put('/roles/{role}', [RoleController::class, 'update']);
    Route::delete('/roles/{role}', [RoleController::class, 'destroy']);

    Route::get('/permissions', [PermissionController::class, 'index']);
    Route::patch('/permissions/{permission}', [PermissionController::class, 'toggle']);
});
