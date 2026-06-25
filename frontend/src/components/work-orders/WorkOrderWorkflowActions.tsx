'use client';

import type { WorkOrder } from '@/lib/types';
import { canCompleteWorkOrderExecution } from '@/lib/work-order-body-utils';
import {
  canAdvanceWorkOrder,
  canRejectWorkOrder,
  getWorkOrderAdvanceAction,
  workOrderWorkflowHint,
} from '@/lib/work-order-status-flow';
import { workOrderStatusLabel } from '@/lib/work-order-messages';

type ApproveHandler = (action: 'approve' | 'reject') => void;

export function WorkOrderWorkflowBanner({ wo }: { wo: WorkOrder }) {
  const hint = workOrderWorkflowHint(wo);
  if (!hint) return null;

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p>
        <span className="font-medium text-slate-900">Status saat ini:</span>{' '}
        {workOrderStatusLabel(wo.status)}
      </p>
      <p className="mt-1 text-slate-600">{hint}</p>
    </div>
  );
}

export function WorkOrderWorkflowActions({
  wo,
  canApprovePerm,
  onApprove,
  className = '',
}: {
  wo: WorkOrder;
  canApprovePerm: boolean;
  onApprove: ApproveHandler;
  className?: string;
}) {
  const canAdvance = canAdvanceWorkOrder(wo, canApprovePerm);
  const canReject = canRejectWorkOrder(wo, canApprovePerm);
  const advance = getWorkOrderAdvanceAction(wo);
  const finishCheck = wo.status === 'approved' ? canCompleteWorkOrderExecution(wo) : { allowed: true };
  const advanceDisabled = Boolean(
    canAdvance && advance && wo.status === 'approved' && !finishCheck.allowed
  );

  if (!canAdvance && !canReject) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap gap-3">
        {canAdvance && advance && (
          <button
            type="button"
            onClick={() => onApprove('approve')}
            disabled={advanceDisabled}
            title={advanceDisabled ? finishCheck.reason : undefined}
            className={
              advance.isClose
                ? 'rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
                : 'rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            {advance.buttonLabel}
          </button>
        )}
        {canReject && (
          <button
            type="button"
            onClick={() => onApprove('reject')}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Tolak WO
          </button>
        )}
      </div>
      {advanceDisabled && finishCheck.reason && (
        <p className="text-sm text-amber-800">{finishCheck.reason}</p>
      )}
    </div>
  );
}

export function confirmWorkOrderApprove(wo: WorkOrder): boolean {
  const advance = getWorkOrderAdvanceAction(wo);
  if (!advance) return false;
  if (wo.status === 'approved' && !canCompleteWorkOrderExecution(wo).allowed) {
    return false;
  }
  return confirm(`${advance.confirmTitle}\n\n${advance.confirmMessage}`);
}

export function confirmWorkOrderReject(wo: WorkOrder): boolean {
  return confirm(
    `Tolak Work Order\n\n${wo.wo_number} akan ditolak supervisor dan kembali ke status Ditolak.`
  );
}
