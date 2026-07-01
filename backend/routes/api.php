<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\MechanicActivityController;
use App\Http\Controllers\Api\OvertimeRequestController;
use App\Http\Controllers\Api\OitmController;
use App\Http\Controllers\Api\PartsRequestController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\MechanicActivitySubmissionController;
use App\Http\Controllers\Api\WorkOrderController;
use App\Http\Controllers\Api\WorkshopSettingsController;
use App\Support\Permission;
use Illuminate\Support\Facades\Route;

/** @param list<string> $permissions */
function permissionAny(array $permissions): string
{
    return 'permission:'.implode('|', $permissions);
}

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::middleware('permission:'.Permission::DASHBOARD_VIEW)->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);
    });

    Route::middleware('permission:'.Permission::WORK_ORDERS_APPROVE)->group(function () {
        Route::get('/work-orders/pending-approval-count', [WorkOrderController::class, 'pendingApprovalCount']);
    });

    Route::middleware('permission:'.Permission::WORK_ORDERS_VIEW)->group(function () {
        Route::get('/work-orders/main-list', [WorkOrderController::class, 'mainList']);
        Route::get('/work-orders/sub-list', [WorkOrderController::class, 'subList']);
        Route::get('/work-orders', [WorkOrderController::class, 'index']);
        Route::get('/work-orders/{workOrder}', [WorkOrderController::class, 'show']);
    });

    Route::middleware(permissionAny([
        Permission::WORK_ORDERS_CREATE,
        Permission::WORK_ORDERS_SUB_CREATE,
    ]))->group(function () {
        Route::get('/work-orders/{workOrder}/preview-sub-wo-number', [WorkOrderController::class, 'previewSubWoNumber']);
        Route::post('/work-orders', [WorkOrderController::class, 'store']);
    });

    Route::middleware(permissionAny([
        Permission::WORK_ORDERS_UPDATE,
        Permission::WORK_ORDERS_EDIT_ANY_STATUS,
        Permission::WORK_ORDERS_SUB_EDIT,
    ]))->group(function () {
        Route::put('/work-orders/{workOrder}', [WorkOrderController::class, 'update']);
        Route::patch('/work-orders/{workOrder}', [WorkOrderController::class, 'update']);
    });

    Route::middleware(permissionAny([
        Permission::WORK_ORDERS_UPDATE,
        Permission::WORK_ORDERS_EDIT_ANY_STATUS,
        Permission::WORK_ORDERS_APPROVE,
    ]))->group(function () {
        Route::patch('/work-orders/{workOrder}/operational-fields', [WorkOrderController::class, 'updateOperationalFields']);
    });

    Route::middleware(permissionAny([
        Permission::WORK_ORDERS_UPDATE,
        Permission::WORK_ORDERS_DELETE_ANY_STATUS,
        Permission::WORK_ORDERS_SUB_DELETE,
    ]))->group(function () {
        Route::delete('/work-orders/{workOrder}', [WorkOrderController::class, 'destroy']);
    });

    Route::middleware('permission:'.Permission::WORK_ORDERS_SUBMIT)->group(function () {
        Route::post('/work-orders/{workOrder}/submit', [WorkOrderController::class, 'submit']);
    });

    Route::middleware('permission:'.Permission::WORK_ORDERS_APPROVE)->group(function () {
        Route::post('/work-orders/{workOrder}/approve', [WorkOrderController::class, 'approve']);
    });

    Route::middleware(permissionAny([
        Permission::ACTIVITY_TYPES_VIEW,
        Permission::MECHANIC_ACTIVITIES_VIEW_OWN,
        Permission::MECHANIC_ACTIVITIES_VIEW_ALL,
        Permission::MECHANIC_ACTIVITIES_APPROVE,
        Permission::MECHANIC_ACTIVITIES_UPDATE,
        Permission::MECHANIC_ACTIVITIES_EDIT_ANY_STATUS,
    ]))->group(function () {
        Route::get('/activity-types', [MechanicActivityController::class, 'activityTypes']);
    });

    Route::middleware(permissionAny([
        Permission::MECHANIC_ACTIVITIES_VIEW_OWN,
        Permission::MECHANIC_ACTIVITIES_VIEW_ALL,
        Permission::MECHANIC_ACTIVITIES_APPROVE,
    ]))->group(function () {
        Route::get('/mechanic-activities', [MechanicActivityController::class, 'index']);
    });

    Route::middleware(permissionAny([
        Permission::MECHANIC_ACTIVITIES_VIEW_OWN,
        Permission::MECHANIC_ACTIVITIES_VIEW_ALL,
        Permission::MECHANIC_ACTIVITIES_APPROVE,
    ]))->group(function () {
        Route::get('/mechanic-activity-submissions', [MechanicActivitySubmissionController::class, 'index']);
    });

    Route::middleware(permissionAny([
        Permission::MECHANIC_ACTIVITIES_VIEW_ALL,
        Permission::MECHANIC_ACTIVITIES_APPROVE,
    ]))->group(function () {
        Route::get('/mechanic-activities/filter-mechanics', [MechanicActivityController::class, 'filterMechanics']);
    });

    Route::middleware('permission:'.Permission::MECHANIC_ACTIVITIES_CREATE)->group(function () {
        Route::post('/mechanic-activities', [MechanicActivityController::class, 'store']);
    });

    Route::middleware('permission:'.Permission::MECHANIC_ACTIVITIES_SUBMIT)->group(function () {
        Route::get('/mechanic-activities/draft-count', [MechanicActivityController::class, 'draftCount']);
        Route::post('/mechanic-activities/bulk-submit', [MechanicActivityController::class, 'bulkSubmit']);
        Route::post('/mechanic-activities/{mechanicActivity}/submit', [MechanicActivityController::class, 'submit']);
        Route::post('/mechanic-activity-submissions/bulk-submit', [MechanicActivitySubmissionController::class, 'bulkSubmit']);
        Route::post('/mechanic-activity-submissions/{mechanicActivitySubmission}/submit', [MechanicActivitySubmissionController::class, 'submitOne']);
    });

    Route::middleware('permission:'.Permission::MECHANIC_ACTIVITIES_APPROVE)->group(function () {
        Route::get('/mechanic-activities/pending-approval-count', [MechanicActivityController::class, 'pendingApprovalCount']);
        Route::post('/mechanic-activities/bulk-approve', [MechanicActivityController::class, 'bulkApprove']);
        Route::post('/mechanic-activities/{mechanicActivity}/approve', [MechanicActivityController::class, 'approve']);
        Route::post('/mechanic-activity-submissions/bulk-approve', [MechanicActivitySubmissionController::class, 'bulkApprove']);
        Route::post('/mechanic-activity-submissions/{mechanicActivitySubmission}/approve', [MechanicActivitySubmissionController::class, 'approve']);
        Route::get('/overtime-requests/pending-approval-count', [OvertimeRequestController::class, 'pendingApprovalCount']);
        Route::get('/overtime-requests', [OvertimeRequestController::class, 'index']);
        Route::post('/overtime-requests/{overtimeRequest}/approve', [OvertimeRequestController::class, 'approve']);
    });

    Route::middleware(permissionAny([
        Permission::MECHANIC_ACTIVITIES_CREATE,
        Permission::MECHANIC_ACTIVITIES_VIEW_OWN,
    ]))->group(function () {
        Route::get('/overtime-requests/status', [OvertimeRequestController::class, 'status']);
    });

    Route::middleware('permission:'.Permission::MECHANIC_ACTIVITIES_CREATE)->group(function () {
        Route::post('/overtime-requests', [OvertimeRequestController::class, 'store']);
    });

    Route::middleware(permissionAny([
        Permission::MECHANIC_ACTIVITIES_UPDATE,
        Permission::MECHANIC_ACTIVITIES_EDIT_ANY_STATUS,
    ]))->group(function () {
        Route::put('/mechanic-activities/{mechanicActivity}', [MechanicActivityController::class, 'update']);
        Route::patch('/mechanic-activities/{mechanicActivity}', [MechanicActivityController::class, 'update']);
    });

    Route::middleware(permissionAny([
        Permission::MECHANIC_ACTIVITIES_DELETE,
        Permission::MECHANIC_ACTIVITIES_DELETE_ANY_STATUS,
    ]))->group(function () {
        Route::delete('/mechanic-activities/{mechanicActivity}', [MechanicActivityController::class, 'destroy']);
    });

    Route::middleware(permissionAny([
        Permission::PARTS_SUPERVISOR,
        Permission::PARTS_VIEW,
    ]))->group(function () {
        Route::get('/parts-requests/pending-approval-count', [PartsRequestController::class, 'pendingApprovalCount']);
    });

    Route::middleware('permission:'.Permission::PARTS_VIEW)->group(function () {
        Route::get('/parts-requests', [PartsRequestController::class, 'index']);
        Route::get('/parts-requests/{partsRequest}', [PartsRequestController::class, 'show']);
    });

    Route::middleware('permission:'.Permission::PARTS_CREATE)->group(function () {
        Route::post('/parts-requests', [PartsRequestController::class, 'store']);
    });

    Route::middleware('permission:'.Permission::PARTS_SUBMIT)->group(function () {
        Route::post('/parts-requests/{partsRequest}/submit', [PartsRequestController::class, 'submit']);
    });

    Route::middleware('permission:'.Permission::PARTS_SUPERVISOR)->group(function () {
        Route::post('/parts-requests/{partsRequest}/supervisor', [PartsRequestController::class, 'supervisorAction']);
    });

    Route::middleware('permission:'.Permission::PARTS_LOGISTIC)->group(function () {
        Route::post('/parts-requests/{partsRequest}/logistic', [PartsRequestController::class, 'logisticAction']);
    });

    Route::middleware(permissionAny([
        Permission::PARTS_UPDATE,
        Permission::PARTS_EDIT_ANY_STATUS,
    ]))->group(function () {
        Route::put('/parts-requests/{partsRequest}', [PartsRequestController::class, 'update']);
        Route::patch('/parts-requests/{partsRequest}', [PartsRequestController::class, 'update']);
    });

    Route::middleware(permissionAny([
        Permission::PARTS_DELETE,
        Permission::PARTS_DELETE_ANY_STATUS,
    ]))->group(function () {
        Route::delete('/parts-requests/{partsRequest}', [PartsRequestController::class, 'destroy']);
    });

    Route::middleware('permission:'.Permission::REPORTS_VIEW)->prefix('reports')->group(function () {
        Route::get('/productivity', [ReportController::class, 'productivity']);
        Route::get('/lead-time', [ReportController::class, 'leadTime']);
        Route::get('/mechanic-performance', [ReportController::class, 'mechanicPerformance']);
        Route::get('/spare-parts', [ReportController::class, 'sparePartConsumption']);
        Route::get('/cost', [ReportController::class, 'costReport']);
        Route::get('/work-order-history', [ReportController::class, 'workOrderHistory']);
        Route::get('/mechanic-activity-history', [ReportController::class, 'mechanicActivityHistory']);
        Route::get('/mechanic-activity-history/export/excel', [ReportController::class, 'exportMechanicActivityHistoryExcel']);
        Route::get('/mechanic-activity-history/export/pdf', [ReportController::class, 'exportMechanicActivityHistoryPdf']);
        Route::get('/unit-component-history', [ReportController::class, 'unitComponentHistory']);
        Route::get('/delay-analysis', [ReportController::class, 'delayAnalysis']);
        Route::get('/utilization', [ReportController::class, 'utilization']);
    });

    Route::middleware('permission:'.Permission::USERS_IMPORT)->prefix('users')->group(function () {
        Route::get('/import/template', [UserController::class, 'importTemplate']);
        Route::post('/import', [UserController::class, 'import']);
    });

    // Static paths must register before /{user} (lihat UserController::deletableCount, bulkDestroy)
    Route::middleware('permission:'.Permission::USERS_MANAGE)->prefix('users')->group(function () {
        Route::get('/deletable-count', [UserController::class, 'deletableCount']);
        Route::post('/bulk-destroy', [UserController::class, 'bulkDestroy']);
        Route::post('/', [UserController::class, 'store']);
        Route::put('/{user}', [UserController::class, 'update']);
        Route::patch('/{user}', [UserController::class, 'update']);
        Route::delete('/{user}', [UserController::class, 'destroy']);
    });

    Route::middleware('permission:'.Permission::USERS_VIEW)->prefix('users')->group(function () {
        Route::get('/export', [UserController::class, 'export']);
        Route::get('/', [UserController::class, 'index']);
        Route::get('/{user}', [UserController::class, 'show']);
    });

    Route::middleware('permission:'.Permission::ROLES_VIEW)->group(function () {
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/roles/permissions-catalog', [RoleController::class, 'permissionsCatalog']);
        Route::get('/roles/{role}', [RoleController::class, 'show']);
    });

    Route::middleware('permission:'.Permission::ROLES_MANAGE)->group(function () {
        Route::post('/roles', [RoleController::class, 'store']);
        Route::put('/roles/{role}', [RoleController::class, 'update']);
        Route::patch('/roles/{role}', [RoleController::class, 'update']);
        Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
    });

    // Lookup unit untuk form WO — boleh diakses pembuat/editor WO tanpa full akses halaman OITM
    Route::middleware(permissionAny([
        Permission::OITM_VIEW,
        Permission::WORK_ORDERS_CREATE,
        Permission::WORK_ORDERS_UPDATE,
    ]))->prefix('oitm')->group(function () {
        Route::get('/unit-numbers', [OitmController::class, 'unitNumbers']);
        Route::get('/lookup', [OitmController::class, 'lookup']);
    });

    Route::middleware('permission:'.Permission::OITM_VIEW)->prefix('oitm')->group(function () {
        Route::get('/', [OitmController::class, 'index']);
        Route::get('/export', [OitmController::class, 'export']);
        Route::get('/template', [OitmController::class, 'template']);
    });

    Route::middleware('permission:'.Permission::OITM_MANAGE)->prefix('oitm')->group(function () {
        Route::post('/import', [OitmController::class, 'import']);
        Route::post('/', [OitmController::class, 'store']);
        Route::put('/{oitm}', [OitmController::class, 'update']);
        Route::patch('/{oitm}', [OitmController::class, 'update']);
        Route::delete('/{oitm}', [OitmController::class, 'destroy']);
    });

    Route::middleware('permission:'.Permission::SETTINGS_MANAGE)->prefix('settings')->group(function () {
        Route::get('/workshop', [WorkshopSettingsController::class, 'show']);
        Route::put('/workshop/labor-rate', [WorkshopSettingsController::class, 'updateLaborRate']);
        Route::put('/workshop/standard-hours', [WorkshopSettingsController::class, 'updateStandardHours']);
    });
});
