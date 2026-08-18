<?php

use App\Http\Controllers\AccountCategoryController;
use App\Http\Controllers\AccountController;
use App\Http\Controllers\AccountGroupController;
use App\Http\Controllers\AccountingStatsController;
use App\Http\Controllers\AgentController;
use App\Http\Controllers\AttendanceScanController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BankController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\GeneralLedgerController;
use App\Http\Controllers\GoodsReceivedNoteController;
use App\Http\Controllers\ItemCategoryController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseRequisitionController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\SupplierInvoiceController;
use App\Http\Controllers\JournalEntryController;
use App\Http\Controllers\TrialBalanceController;
use App\Http\Controllers\BaddegamaLocationController;
use App\Http\Controllers\BaddegamaPublicController;
use App\Http\Controllers\BaddegamaRegistrationController;
use App\Http\Controllers\CandidateController;
use App\Http\Controllers\CandidateDepartureDetailController;
use App\Http\Controllers\CandidateDocumentController;
use App\Http\Controllers\CandidateTrainingController;
use App\Http\Controllers\CandidateVisaDetailController;
use App\Http\Controllers\CandidateEmployeeDetailController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DemandController;
use App\Http\Controllers\JobCategoryController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SectionAssignmentController;
use App\Http\Controllers\StaffController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Public — candidate self-service progress lookup (passport / mobile / NIC)
Route::get('/progress', [CandidateController::class, 'publicProgress']);

// Public — Baddegama registration form (master data + OTP + sign-up)
Route::get('/baddegama/provinces', [BaddegamaPublicController::class, 'provinces']);
Route::get('/baddegama/countries', [BaddegamaPublicController::class, 'countries']);
Route::get('/baddegama/active-location', [BaddegamaPublicController::class, 'activeLocation']);
Route::get('/baddegama/location/{location}', [BaddegamaPublicController::class, 'location']);
Route::post('/baddegama/otp/send', [BaddegamaPublicController::class, 'sendOtp']);
Route::post('/baddegama/otp/verify', [BaddegamaPublicController::class, 'verifyOtp']);
Route::post('/baddegama/register', [BaddegamaPublicController::class, 'register']);

// Authenticated (Sanctum bearer token)
Route::middleware('auth:sanctum')->group(function () {
    // Mobile app — QR attendance scan (requires logged-in staff)
    Route::post('/attendance/scan', [AttendanceScanController::class, 'scan']);

    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/dashboard/registrations', [DashboardController::class, 'registrations']);
    Route::get('/dashboard/departures', [DashboardController::class, 'departures']);
    Route::get('/dashboard/demand-status', [DashboardController::class, 'demandStatus']);

    Route::get('/locations/provinces', [LocationController::class, 'provinces']);
    Route::get('/locations/districts', [LocationController::class, 'districts']);
    Route::get('/locations/ds-divisions', [LocationController::class, 'dsDivisions']);
    Route::get('/locations/gn-divisions', [LocationController::class, 'gnDivisions']);

    // Location master-data management (add DS / GN divisions per district)
    Route::post('/locations/ds-divisions', [LocationController::class, 'storeDsDivision']);
    Route::put('/locations/ds-divisions/{id}', [LocationController::class, 'updateDsDivision']);
    Route::delete('/locations/ds-divisions/{id}', [LocationController::class, 'destroyDsDivision']);
    Route::post('/locations/gn-divisions', [LocationController::class, 'storeGnDivision']);
    Route::put('/locations/gn-divisions/{id}', [LocationController::class, 'updateGnDivision']);
    Route::delete('/locations/gn-divisions/{id}', [LocationController::class, 'destroyGnDivision']);

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
    Route::post('/candidates/{candidate}/training/test-number', [CandidateTrainingController::class, 'generateTestNumber']);

    // Section 3 — Personal Details (Attachment)
    Route::get('/candidates/{candidate}/documents', [CandidateDocumentController::class, 'show']);
    Route::post('/candidates/{candidate}/documents', [CandidateDocumentController::class, 'save']);

    // Section 4 — Job & Visa Processing
    Route::get('/candidates/{candidate}/visa-details', [CandidateVisaDetailController::class, 'show']);
    Route::post('/candidates/{candidate}/visa-details', [CandidateVisaDetailController::class, 'save']);

    // Section 3 — Employee Details
    Route::get('/candidates/{candidate}/employee-details', [CandidateEmployeeDetailController::class, 'show']);
    Route::post('/candidates/{candidate}/employee-details', [CandidateEmployeeDetailController::class, 'save']);

    // Section 6 — Departure Details
    Route::get('/candidates/{candidate}/departure-details', [CandidateDepartureDetailController::class, 'show']);
    Route::post('/candidates/{candidate}/departure-details', [CandidateDepartureDetailController::class, 'save']);

    // Job categories (master data for Section 6)
    Route::get('/job-categories', [JobCategoryController::class, 'index']);
    Route::post('/job-categories', [JobCategoryController::class, 'store']);
    Route::put('/job-categories/{jobCategory}', [JobCategoryController::class, 'update']);
    Route::delete('/job-categories/{jobCategory}', [JobCategoryController::class, 'destroy']);

    // Demands (master data for Employee Details + dashboard chart)
    Route::get('/demands', [DemandController::class, 'index']);
    Route::post('/demands', [DemandController::class, 'store']);
    Route::put('/demands/{demand}', [DemandController::class, 'update']);
    Route::delete('/demands/{demand}', [DemandController::class, 'destroy']);

    // Agents (master data for the candidate Agent dropdown)
    Route::get('/agents', [AgentController::class, 'index']);
    Route::post('/agents', [AgentController::class, 'store']);
    Route::put('/agents/{agent}', [AgentController::class, 'update']);
    Route::delete('/agents/{agent}', [AgentController::class, 'destroy']);

    // Baddegama registration locations (branches) — admin management
    Route::get('/baddegama-locations', [BaddegamaLocationController::class, 'index']);
    Route::post('/baddegama-locations', [BaddegamaLocationController::class, 'store']);
    Route::put('/baddegama-locations/{location}', [BaddegamaLocationController::class, 'update']);
    Route::delete('/baddegama-locations/{location}', [BaddegamaLocationController::class, 'destroy']);
    Route::post('/baddegama-locations/{location}/set-active', [BaddegamaLocationController::class, 'setActive']);

    // Baddegama registrations — admin management
    Route::get('/baddegama-registrations', [BaddegamaRegistrationController::class, 'index']);
    Route::get('/baddegama-registrations/locations', [BaddegamaRegistrationController::class, 'locations']);
    Route::get('/baddegama-registrations/{baddegamaRegistration}', [BaddegamaRegistrationController::class, 'show']);
    Route::put('/baddegama-registrations/{baddegamaRegistration}', [BaddegamaRegistrationController::class, 'update']);
    Route::delete('/baddegama-registrations/{baddegamaRegistration}', [BaddegamaRegistrationController::class, 'destroy']);

    // ── Accounting — Chart of Accounts / General Ledger backbone ──────────
    Route::get('/accounting/stats', [AccountingStatsController::class, 'index']);

    // Chart nested (categories -> groups) for dropdowns, then category CRUD.
    Route::get('/accounting/chart', [AccountCategoryController::class, 'chart']);
    Route::get('/accounting/categories', [AccountCategoryController::class, 'index']);
    Route::post('/accounting/categories', [AccountCategoryController::class, 'store']);
    Route::put('/accounting/categories/{accountCategory}', [AccountCategoryController::class, 'update']);
    Route::delete('/accounting/categories/{accountCategory}', [AccountCategoryController::class, 'destroy']);

    Route::get('/accounting/groups', [AccountGroupController::class, 'index']);
    Route::post('/accounting/groups', [AccountGroupController::class, 'store']);
    Route::put('/accounting/groups/{accountGroup}', [AccountGroupController::class, 'update']);
    Route::delete('/accounting/groups/{accountGroup}', [AccountGroupController::class, 'destroy']);

    Route::get('/accounting/accounts', [AccountController::class, 'index']);
    Route::post('/accounting/accounts', [AccountController::class, 'store']);
    Route::put('/accounting/accounts/{account}', [AccountController::class, 'update']);
    Route::delete('/accounting/accounts/{account}', [AccountController::class, 'destroy']);

    Route::get('/accounting/journal-entries', [JournalEntryController::class, 'index']);
    Route::get('/accounting/journal-entries/{journalEntry}', [JournalEntryController::class, 'show']);
    Route::post('/accounting/journal-entries', [JournalEntryController::class, 'store']);

    Route::get('/accounting/general-ledger', [GeneralLedgerController::class, 'index']);
    Route::get('/accounting/trial-balance', [TrialBalanceController::class, 'index']);

    // ── Procurement master files (Stage 01) ──────────────────────────────
    Route::get('/accounting/departments', [DepartmentController::class, 'index']);
    Route::post('/accounting/departments', [DepartmentController::class, 'store']);
    Route::put('/accounting/departments/{department}', [DepartmentController::class, 'update']);
    Route::delete('/accounting/departments/{department}', [DepartmentController::class, 'destroy']);

    Route::get('/accounting/suppliers', [SupplierController::class, 'index']);
    Route::post('/accounting/suppliers', [SupplierController::class, 'store']);
    Route::put('/accounting/suppliers/{supplier}', [SupplierController::class, 'update']);
    Route::delete('/accounting/suppliers/{supplier}', [SupplierController::class, 'destroy']);

    Route::get('/accounting/item-categories', [ItemCategoryController::class, 'index']);
    Route::post('/accounting/item-categories', [ItemCategoryController::class, 'store']);
    Route::put('/accounting/item-categories/{itemCategory}', [ItemCategoryController::class, 'update']);
    Route::delete('/accounting/item-categories/{itemCategory}', [ItemCategoryController::class, 'destroy']);

    // Purchase Requisition (PR)
    Route::get('/accounting/purchase-requisitions', [PurchaseRequisitionController::class, 'index']);
    Route::get('/accounting/purchase-requisitions/{purchaseRequisition}', [PurchaseRequisitionController::class, 'show']);
    Route::post('/accounting/purchase-requisitions', [PurchaseRequisitionController::class, 'store']);
    Route::put('/accounting/purchase-requisitions/{purchaseRequisition}', [PurchaseRequisitionController::class, 'update']);
    Route::delete('/accounting/purchase-requisitions/{purchaseRequisition}', [PurchaseRequisitionController::class, 'destroy']);
    Route::post('/accounting/purchase-requisitions/{purchaseRequisition}/submit', [PurchaseRequisitionController::class, 'submit']);
    Route::post('/accounting/purchase-requisitions/{purchaseRequisition}/approve', [PurchaseRequisitionController::class, 'approve']);
    Route::post('/accounting/purchase-requisitions/{purchaseRequisition}/reject', [PurchaseRequisitionController::class, 'reject']);

    // Purchase Order (PO)
    Route::get('/accounting/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::get('/accounting/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show']);
    Route::post('/accounting/purchase-orders', [PurchaseOrderController::class, 'store']);
    Route::put('/accounting/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update']);
    Route::delete('/accounting/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'destroy']);
    Route::post('/accounting/purchase-orders/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit']);
    Route::post('/accounting/purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve']);
    Route::post('/accounting/purchase-orders/{purchaseOrder}/reject', [PurchaseOrderController::class, 'reject']);
    Route::post('/accounting/purchase-orders/{purchaseOrder}/send', [PurchaseOrderController::class, 'send']);
    Route::post('/accounting/purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel']);

    // Goods Received Note (GRN)
    Route::get('/accounting/grns', [GoodsReceivedNoteController::class, 'index']);
    Route::get('/accounting/grns/{goodsReceivedNote}', [GoodsReceivedNoteController::class, 'show']);
    Route::post('/accounting/grns', [GoodsReceivedNoteController::class, 'store']);
    Route::put('/accounting/grns/{goodsReceivedNote}', [GoodsReceivedNoteController::class, 'update']);
    Route::delete('/accounting/grns/{goodsReceivedNote}', [GoodsReceivedNoteController::class, 'destroy']);
    Route::post('/accounting/grns/{goodsReceivedNote}/confirm', [GoodsReceivedNoteController::class, 'confirm']);

    // Supplier Payment / Invoice (+ 3-way matching)
    Route::get('/accounting/supplier-invoices', [SupplierInvoiceController::class, 'index']);
    Route::get('/accounting/supplier-invoices/{supplierInvoice}', [SupplierInvoiceController::class, 'show']);
    Route::get('/accounting/supplier-invoices/{supplierInvoice}/matching', [SupplierInvoiceController::class, 'matching']);
    Route::post('/accounting/supplier-invoices', [SupplierInvoiceController::class, 'store']);
    Route::put('/accounting/supplier-invoices/{supplierInvoice}', [SupplierInvoiceController::class, 'update']);
    Route::delete('/accounting/supplier-invoices/{supplierInvoice}', [SupplierInvoiceController::class, 'destroy']);
    Route::post('/accounting/supplier-invoices/{supplierInvoice}/submit', [SupplierInvoiceController::class, 'submit']);
    Route::post('/accounting/supplier-invoices/{supplierInvoice}/match', [SupplierInvoiceController::class, 'runMatch']);
    Route::post('/accounting/supplier-invoices/{supplierInvoice}/approve', [SupplierInvoiceController::class, 'approve']);
    Route::post('/accounting/supplier-invoices/{supplierInvoice}/pay', [SupplierInvoiceController::class, 'pay']);
    Route::post('/accounting/supplier-invoices/{supplierInvoice}/dispute', [SupplierInvoiceController::class, 'dispute']);

    Route::get('/accounting/banks', [BankController::class, 'index']);
    Route::post('/accounting/banks', [BankController::class, 'store']);
    Route::put('/accounting/banks/{bank}', [BankController::class, 'update']);
    Route::delete('/accounting/banks/{bank}', [BankController::class, 'destroy']);
    Route::post('/accounting/banks/{bank}/branches', [BankController::class, 'storeBranch']);
    Route::put('/accounting/bank-branches/{bankBranch}', [BankController::class, 'updateBranch']);
    Route::delete('/accounting/bank-branches/{bankBranch}', [BankController::class, 'destroyBranch']);

    Route::get('/roles', [RoleController::class, 'index']);
    Route::post('/roles', [RoleController::class, 'store']);
    Route::put('/roles/{role}', [RoleController::class, 'update']);
    Route::delete('/roles/{role}', [RoleController::class, 'destroy']);

    Route::get('/permissions', [PermissionController::class, 'index']);
    Route::patch('/permissions/{permission}', [PermissionController::class, 'toggle']);
});
