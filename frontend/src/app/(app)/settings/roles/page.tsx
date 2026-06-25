'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { Permission, PERMISSION_GROUPS, PERMISSION_LABELS, type PermissionName } from '@/lib/permissions';
import type { PermissionCatalogGroup, RoleRecord } from '@/lib/types';

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  permissions: [] as string[],
};

function groupPermissions(names: string[]): [string, string[]][] {
  const groups: Record<string, string[]> = {};
  for (const name of names) {
    const g = catalogGroupForPermission(name);
    if (!groups[g]) groups[g] = [];
    groups[g].push(name);
  }
  return Object.entries(groups);
}

function catalogGroupForPermission(name: string): string {
  const map: Record<string, string> = {
    'dashboard.view': 'dashboard',
    'work_orders.view': 'work_orders',
    'work_orders.create': 'work_orders',
    'work_orders.update': 'work_orders',
    'work_orders.submit': 'work_orders',
    'work_orders.approve': 'work_orders',
    'work_orders.edit_any_status': 'work_orders',
    'work_orders.delete_any_status': 'work_orders',
    'work_orders.sub.create': 'work_orders',
    'work_orders.sub.edit': 'work_orders',
    'work_orders.sub.delete': 'work_orders',
    'mechanic_activities.view_all': 'activities',
    'mechanic_activities.view_own': 'activities',
    'mechanic_activities.create': 'activities',
    'mechanic_activities.submit': 'activities',
    'mechanic_activities.approve': 'activities',
    'mechanic_activities.update': 'activities',
    'mechanic_activities.delete': 'activities',
    'mechanic_activities.edit_any_status': 'activities',
    'mechanic_activities.delete_any_status': 'activities',
    'parts_requests.view': 'parts',
    'parts_requests.create': 'parts',
    'parts_requests.submit': 'parts',
    'parts_requests.supervisor': 'parts',
    'parts_requests.logistic': 'parts',
    'parts_requests.update': 'parts',
    'parts_requests.delete': 'parts',
    'parts_requests.edit_any_status': 'parts',
    'parts_requests.delete_any_status': 'parts',
    'inspection.access': 'inspection',
    'reports.view': 'reports',
    'activity_types.view': 'master',
    'users.view': 'administration',
    'users.manage': 'administration',
    'users.import': 'administration',
    'roles.view': 'administration',
    'roles.manage': 'administration',
  };
  return map[name] || 'general';
}

function PermissionList({ permissions }: { permissions: string[] }) {
  const grouped = groupPermissions(permissions);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {grouped.map(([group, items]) => (
        <div key={group}>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
            {PERMISSION_GROUPS[group] || group}
          </p>
          <ul className="space-y-1">
            {items.map((p) => (
              <li key={p} className="text-sm text-slate-700">
                {PERMISSION_LABELS[p as PermissionName] || p}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function RolesSettingsPage() {
  const { can } = useAuth();
  const canManage = can(Permission.ROLES_MANAGE);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<RoleRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api<RoleRecord[]>('/roles').then(setRoles).catch(console.error);
  };

  useEffect(() => {
    load();
    api<PermissionCatalogGroup[]>('/roles/permissions-catalog').then(setCatalog).catch(console.error);
  }, []);

  const togglePermission = (name: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(name)
        ? f.permissions.filter((p) => p !== name)
        : [...f.permissions, name],
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModal('create');
  };

  const openEdit = (role: RoleRecord) => {
    setEditing(role);
    setForm({
      name: role.name,
      slug: role.slug,
      description: role.description || '',
      permissions: [...role.permissions],
    });
    setError('');
    setModal('edit');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name,
        description: form.description,
        permissions: form.permissions,
        ...(modal === 'create' && form.slug ? { slug: form.slug } : {}),
      };

      if (modal === 'create') {
        await api('/roles', { method: 'POST', body: JSON.stringify(body) });
      } else if (editing) {
        await api(`/roles/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: RoleRecord) => {
    if (!confirm(`Hapus role ${role.name}?`)) return;
    try {
      await api(`/roles/${role.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Role & Permission"
        subtitle="Atur hak akses per role — perubahan berlaku setelah user login ulang"
        action={
          canManage ? (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              Tambah Role
            </button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {roles.length === 0 ? (
          <p className="py-12 text-center text-slate-400">Memuat role...</p>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex w-full items-center justify-between gap-2 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === role.id ? null : role.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{role.name}</p>
                    <p className="text-xs text-slate-500">
                      {role.slug} · {role.users_count} pengguna · {role.permissions.length} permission
                      {role.is_system ? ' · Role sistem' : ''}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(role)}
                        className="rounded p-2 text-slate-500 hover:bg-slate-100"
                        title="Edit role"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!role.is_system && (
                        <button
                          type="button"
                          onClick={() => remove(role)}
                          className="rounded p-2 text-red-500 hover:bg-red-50"
                          title="Hapus role"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === role.id ? null : role.id)}
                    className="rounded p-2 text-slate-400 hover:bg-slate-100"
                    aria-expanded={expanded === role.id}
                    aria-label={expanded === role.id ? 'Tutup detail permission' : 'Buka detail permission'}
                  >
                    {expanded === role.id ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {expanded === role.id && (
                <div className="border-t border-slate-100 px-5 py-4">
                  {role.description && (
                    <p className="mb-3 text-sm text-slate-600">{role.description}</p>
                  )}
                  {role.slug === 'admin' ? (
                    <p className="text-sm text-orange-700">
                      Administrator memiliki semua permission secara otomatis.
                    </p>
                  ) : (
                    <PermissionList permissions={role.permissions} />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {modal && (
        <RoleModal
          title={modal === 'create' ? 'Tambah Role' : `Edit Role: ${editing?.name}`}
          form={form}
          setForm={setForm}
          catalog={catalog}
          togglePermission={togglePermission}
          error={error}
          saving={saving}
          isEdit={modal === 'edit'}
          isAdmin={editing?.slug === 'admin'}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function RoleModal({
  title,
  form,
  setForm,
  catalog,
  togglePermission,
  error,
  saving,
  isEdit,
  isAdmin,
  onClose,
  onSave,
}: {
  title: string;
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  catalog: PermissionCatalogGroup[];
  togglePermission: (name: string) => void;
  error: string;
  saving: boolean;
  isEdit: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <label className="block text-sm font-medium text-slate-700">
            Nama Role
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          {!isEdit && (
            <label className="block text-sm font-medium text-slate-700">
              Slug (opsional)
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="otomatis dari nama"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Deskripsi
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          {isAdmin ? (
            <p className="text-sm text-orange-700">Permission admin tidak dapat diubah.</p>
          ) : (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-800">Permission</p>
              <div className="space-y-4">
                {catalog.map((group) => (
                  <div key={group.group} className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                      {group.group_label}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.permissions.map((p) => (
                        <label key={p.name} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(p.name)}
                            onChange={() => togglePermission(p.name)}
                            className="mt-0.5 rounded border-slate-300"
                          />
                          <span>
                            <span className="font-medium text-slate-800">{p.label}</span>
                            <span className="block text-xs text-slate-400">{p.name}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={saving || isAdmin}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
