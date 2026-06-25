'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Package,
  ShieldCheck,
  BarChart3,
  LogOut,
  Users,
  Shield,
  Truck,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';
import { authApi } from '@/lib/api';
import { can, Permission } from '@/lib/permissions';
import type { PermissionName } from '@/lib/permissions';

const nav: { href: string; label: string; icon: typeof LayoutDashboard; permission: PermissionName }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: Permission.DASHBOARD_VIEW },
  { href: '/work-orders', label: 'Work Order', icon: ClipboardList, permission: Permission.WORK_ORDERS_VIEW },
  {
    href: '/activities',
    label: 'Mechanic Activity',
    icon: Wrench,
    permission: Permission.MECHANIC_ACTIVITIES_VIEW_OWN,
  },
  { href: '/parts', label: 'Parts & Consumable', icon: Package, permission: Permission.PARTS_VIEW },
  { href: '/inspection', label: 'Inspection', icon: ShieldCheck, permission: Permission.INSPECTION_ACCESS },
  { href: '/reports', label: 'History & Reports', icon: BarChart3, permission: Permission.REPORTS_VIEW },
  { href: '/units', label: 'Input Unit', icon: Truck, permission: Permission.OITM_VIEW },
  { href: '/settings/users', label: 'Pengguna', icon: Users, permission: Permission.USERS_VIEW },
  { href: '/settings/roles', label: 'Role & Permission', icon: Shield, permission: Permission.ROLES_VIEW },
  {
    href: '/settings/workshop',
    label: 'Pengaturan Workshop',
    icon: Settings,
    permission: Permission.SETTINGS_MANAGE,
  },
];

function getNavBadge(
  href: string,
  counts: { wo: number; parts: number; activitiesApproval: number; activitiesDraft: number }
): { count: number; title: string; ariaLabel: string } | null {
  if (href === '/work-orders' && counts.wo > 0) {
    return {
      count: counts.wo,
      title: `${counts.wo} Work Order belum disetujui`,
      ariaLabel: `${counts.wo} Work Order belum disetujui`,
    };
  }
  if (href === '/activities') {
    if (counts.activitiesApproval > 0) {
      return {
        count: counts.activitiesApproval,
        title: `${counts.activitiesApproval} aktivitas menunggu persetujuan supervisor`,
        ariaLabel: `${counts.activitiesApproval} aktivitas belum disetujui supervisor`,
      };
    }
    if (counts.activitiesDraft > 0) {
      return {
        count: counts.activitiesDraft,
        title: `${counts.activitiesDraft} aktivitas draft belum diajukan ke supervisor`,
        ariaLabel: `${counts.activitiesDraft} aktivitas draft belum diajukan`,
      };
    }
  }
  if (href === '/parts' && counts.parts > 0) {
    return {
      count: counts.parts,
      title: `${counts.parts} parts request menunggu persetujuan supervisor`,
      ariaLabel: `${counts.parts} parts request belum disetujui`,
    };
  }
  return null;
}

function canSeeNavItem(user: User, permission: PermissionName): boolean {
  if (permission === Permission.MECHANIC_ACTIVITIES_VIEW_OWN) {
    return (
      can(user, Permission.MECHANIC_ACTIVITIES_VIEW_OWN) ||
      can(user, Permission.MECHANIC_ACTIVITIES_VIEW_ALL)
    );
  }
  return can(user, permission);
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const visibleNav = nav.filter((item) => canSeeNavItem(user, item.permission));
  const canApproveWo = can(user, Permission.WORK_ORDERS_APPROVE);
  const canApproveParts = can(user, Permission.PARTS_SUPERVISOR);
  const canApproveActivities = can(user, Permission.MECHANIC_ACTIVITIES_APPROVE);
  const canSubmitActivities = can(user, Permission.MECHANIC_ACTIVITIES_SUBMIT);
  const [pendingWoCount, setPendingWoCount] = useState(0);
  const [pendingPartsCount, setPendingPartsCount] = useState(0);
  const [pendingActivitiesCount, setPendingActivitiesCount] = useState(0);
  const [draftActivitiesCount, setDraftActivitiesCount] = useState(0);

  const loadPendingWoCount = useCallback(() => {
    if (!canApproveWo) {
      setPendingWoCount(0);
      return;
    }
    api<{ count: number }>('/work-orders/pending-approval-count')
      .then((res) => setPendingWoCount(res.count))
      .catch(() => setPendingWoCount(0));
  }, [canApproveWo]);

  const loadPendingPartsCount = useCallback(() => {
    if (!canApproveParts) {
      setPendingPartsCount(0);
      return;
    }
    api<{ count: number }>('/parts-requests/pending-approval-count')
      .then((res) => setPendingPartsCount(res.count))
      .catch(() => setPendingPartsCount(0));
  }, [canApproveParts]);

  const loadPendingActivitiesCount = useCallback(() => {
    if (!canApproveActivities) {
      setPendingActivitiesCount(0);
      return;
    }
    api<{ count: number }>('/mechanic-activities/pending-approval-count')
      .then((res) => setPendingActivitiesCount(res.count))
      .catch(() => setPendingActivitiesCount(0));
  }, [canApproveActivities]);

  const loadDraftActivitiesCount = useCallback(() => {
    if (!canSubmitActivities) {
      setDraftActivitiesCount(0);
      return;
    }
    api<{ count: number }>('/mechanic-activities/draft-count')
      .then((res) => setDraftActivitiesCount(res.count))
      .catch(() => setDraftActivitiesCount(0));
  }, [canSubmitActivities]);

  useEffect(() => {
    loadPendingWoCount();
    loadPendingPartsCount();
    loadPendingActivitiesCount();
    loadDraftActivitiesCount();
    const interval = window.setInterval(() => {
      loadPendingWoCount();
      loadPendingPartsCount();
      loadPendingActivitiesCount();
      loadDraftActivitiesCount();
    }, 60_000);
    const onWoRefresh = () => loadPendingWoCount();
    const onPartsRefresh = () => loadPendingPartsCount();
    const onActivitiesRefresh = () => loadPendingActivitiesCount();
    const onDraftRefresh = () => loadDraftActivitiesCount();
    window.addEventListener('wo-pending-count-changed', onWoRefresh);
    window.addEventListener('parts-pending-count-changed', onPartsRefresh);
    window.addEventListener('activities-pending-count-changed', onActivitiesRefresh);
    window.addEventListener('activities-draft-count-changed', onDraftRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('wo-pending-count-changed', onWoRefresh);
      window.removeEventListener('parts-pending-count-changed', onPartsRefresh);
      window.removeEventListener('activities-pending-count-changed', onActivitiesRefresh);
      window.removeEventListener('activities-draft-count-changed', onDraftRefresh);
    };
  }, [
    loadPendingWoCount,
    loadPendingPartsCount,
    loadPendingActivitiesCount,
    loadDraftActivitiesCount,
    pathname,
  ]);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    localStorage.removeItem('wo_token');
    localStorage.removeItem('wo_user');
    window.location.href = '/login';
  };

  return (
    <aside className="flex w-64 flex-col bg-slate-900 text-white">
      <div className="border-b border-slate-700 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">Workshop APS</p>
        <h1 className="mt-1 text-lg font-bold">Work Order System</h1>
        <p className="mt-1 text-xs text-slate-400">Right Process, Right Quality</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          const navBadge = getNavBadge(item.href, {
            wo: pendingWoCount,
            parts: pendingPartsCount,
            activitiesApproval: pendingActivitiesCount,
            activitiesDraft: draftActivitiesCount,
          });

          return (
            <Link
              key={item.href}
              href={item.href}
              title={navBadge?.title}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                active ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {navBadge && (
                <span
                  className={cn(
                    'flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold',
                    active ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                  )}
                  aria-label={navBadge.ariaLabel}
                >
                  {navBadge.count > 99 ? '99+' : navBadge.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <UserFooter user={user} onLogout={logout} />
    </aside>
  );
}

function UserFooter({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <div className="border-t border-slate-700 p-4">
      <p className="truncate text-sm font-medium">{user.name}</p>
      <p className="truncate text-xs capitalize text-slate-400">{user.role}</p>
      <button
        onClick={onLogout}
        className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}
