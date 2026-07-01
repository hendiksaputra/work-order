import type { User, WorkOrder } from '@/lib/types';

/** Admin & planner melihat semua lokasi/workshop. */
export function canViewAllDepartments(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'planner';
}

function departmentMatchesWorkshop(
  userDepartment: string | undefined,
  workshop: string | undefined | null
): boolean {
  const dept = (userDepartment ?? '').trim();
  const ws = (workshop ?? '').trim();
  if (ws === '') {
    return dept === '';
  }
  return dept.toLowerCase() === ws.toLowerCase();
}

/** Cerminan backend WorkOrder::isVisibleTo — workshop user = department supervisor. */
export function isWorkOrderVisibleToUser(
  wo: WorkOrder | undefined | null,
  user: User | null | undefined
): boolean {
  if (!wo || !user) return false;
  if (canViewAllDepartments(user)) return true;

  if (departmentMatchesWorkshop(user.department, wo.workshop)) {
    return true;
  }

  if (wo.type !== 'main') {
    return false;
  }

  const subs = wo.sub_work_orders ?? [];
  return subs.some((sub) => departmentMatchesWorkshop(user.department, sub.workshop));
}
