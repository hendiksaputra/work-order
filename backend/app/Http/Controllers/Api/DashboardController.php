<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MechanicActivity;
use App\Models\PartsRequest;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $statusCounts = WorkOrder::select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $openMain = WorkOrder::where('type', 'main')
            ->whereNotIn('status', ['closed', 'rejected'])
            ->count();

        $pendingApprovals = WorkOrder::where('status', 'pending_supervisor')->count()
            + MechanicActivity::where('status', 'pending_approval')->count()
            + PartsRequest::where('status', 'pending_approval')->count();

        $productiveHours = MechanicActivity::where('status', 'approved')
            ->whereHas('activityType', fn ($q) => $q->where('category', 'productive'))
            ->whereMonth('activity_date', now()->month)
            ->sum('total_hours');

        $nonProductiveHours = MechanicActivity::where('status', 'approved')
            ->whereHas('activityType', fn ($q) => $q->where('category', 'non_productive'))
            ->whereMonth('activity_date', now()->month)
            ->sum('total_hours');

        $recentWorkOrders = WorkOrder::with(['creator', 'parent'])
            ->latest()
            ->limit(8)
            ->get();

        $workshopBreakdown = WorkOrder::where('type', 'sub')
            ->select('workshop', DB::raw('count(*) as total'))
            ->whereNotIn('status', ['closed', 'rejected'])
            ->groupBy('workshop')
            ->pluck('total', 'workshop');

        return response()->json([
            'status_counts' => $statusCounts,
            'open_main_wo' => $openMain,
            'pending_approvals' => $pendingApprovals,
            'productive_hours_month' => (float) $productiveHours,
            'non_productive_hours_month' => (float) $nonProductiveHours,
            'recent_work_orders' => $recentWorkOrders,
            'workshop_breakdown' => $workshopBreakdown,
        ]);
    }
}
