'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Upload, FileSpreadsheet, UserCheck, UserX, Download } from 'lucide-react';
import { api, apiDownload, apiUploadFile } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { FlashMessage } from '@/components/ui/FlashMessage';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import type { Paginated, RoleRecord, User, UserRole } from '@/lib/types';

type UserRow = User & { is_active?: boolean; role_label?: string };

const emptyForm = {
  name: '',
  username: '',
  email: '',
  password: '',
  employee_id: '',
  role: 'mechanic' as UserRole,
  department: 'Workshop',
  is_active: true,
};

export default function UsersSettingsPage() {
  const { user: currentUser, can } = useAuth();
  const canManage = can(Permission.USERS_MANAGE) || currentUser.role === 'admin';
  const canImport = can(Permission.USERS_IMPORT);
  const seesAllDepartments =
    currentUser.role === 'admin' || currentUser.role === 'planner';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<Paginated<UserRow> | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [flash, setFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [checkAllNonAdmin, setCheckAllNonAdmin] = useState(false);
  const [deletableTotal, setDeletableTotal] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const isDeletable = useCallback(
    (user: UserRow) => user.role !== 'admin' && user.id !== currentUser.id,
    [currentUser.id]
  );

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    return params;
  }, [search, roleFilter]);

  const loadDeletableCount = useCallback(() => {
    if (!canManage) return;
    const qs = filterParams.toString();
    api<{ count: number }>(`/users/deletable-count${qs ? `?${qs}` : ''}`)
      .then((res) => setDeletableTotal(res.count))
      .catch(() => setDeletableTotal(null));
  }, [canManage, filterParams]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setCheckAllNonAdmin(false);
  };

  const searchRef = useRef(search);
  const roleFilterRef = useRef(roleFilter);
  const pageRef = useRef(page);
  const loadSeqRef = useRef(0);
  searchRef.current = search;
  roleFilterRef.current = roleFilter;
  pageRef.current = page;

  const load = useCallback(
    (targetPage: number): Promise<void> => {
      const seq = ++loadSeqRef.current;
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('per_page', String(perPage));
      const q = searchRef.current.trim();
      const role = roleFilterRef.current;
      if (q) params.set('search', q);
      if (role) params.set('role', role);

      return api<Paginated<UserRow>>(`/users?${params}`)
        .then((result) => {
          if (seq !== loadSeqRef.current) return;
          if (result.data.length === 0 && targetPage > 1) {
            setPage(targetPage - 1);
            return;
          }
          setData(result);
        })
        .catch(console.error);
    },
    [perPage]
  );

  const reloadCurrentPage = useCallback(() => {
    return load(pageRef.current).then(() => {
      loadDeletableCount();
    });
  }, [load, loadDeletableCount]);

  const mergeUserInList = useCallback((updated: UserRow) => {
    setData((prev) => {
      if (!prev) return prev;

      const role = roleFilterRef.current;
      if (role && updated.role !== role) {
        const nextData = prev.data.filter((u) => u.id !== updated.id);
        if (nextData.length === prev.data.length) return prev;
        return {
          ...prev,
          data: nextData,
          total: Math.max(0, prev.total - 1),
        };
      }

      const idx = prev.data.findIndex((u) => u.id === updated.id);
      if (idx < 0) return prev;
      const nextData = [...prev.data];
      nextData[idx] = { ...nextData[idx], ...updated };
      return { ...prev, data: nextData };
    });
  }, []);

  const applyFiltersNow = useCallback(
    (targetPage = 1) => {
      clearSelection();
      setPage(targetPage);
      return load(targetPage).then(() => {
        loadDeletableCount();
      });
    },
    [load, loadDeletableCount]
  );

  const applyFiltersNowRef = useRef(applyFiltersNow);
  applyFiltersNowRef.current = applyFiltersNow;

  useEffect(() => {
    api<RoleRecord[]>('/roles').then(setRoles).catch(console.error);
  }, []);

  useEffect(() => {
    load(page);
    clearSelection();
  }, [page, perPage, load]);

  useEffect(() => {
    loadDeletableCount();
  }, [loadDeletableCount]);

  const searchFilterMounted = useRef(false);
  useEffect(() => {
    if (!searchFilterMounted.current) {
      searchFilterMounted.current = true;
      return;
    }

    const timer = setTimeout(() => {
      applyFiltersNowRef.current(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [search, roleFilter]);

  const pageDeletableIds = useMemo(() => {
    if (!data?.data.length) return [];
    return data.data.filter(isDeletable).map((u) => u.id);
  }, [data?.data, isDeletable]);

  const toggleRow = (user: UserRow) => {
    if (!isDeletable(user)) return;
    setCheckAllNonAdmin(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(user.id)) next.delete(user.id);
      else next.add(user.id);
      return next;
    });
  };

  const toggleCheckAllNonAdmin = () => {
    if (checkAllNonAdmin) {
      clearSelection();
      return;
    }
    setCheckAllNonAdmin(true);
    setSelectedIds(new Set(pageDeletableIds));
  };

  const isRowChecked = (user: UserRow) =>
    checkAllNonAdmin ? isDeletable(user) : selectedIds.has(user.id);

  const bulkDelete = async () => {
    if (!checkAllNonAdmin && selectedIds.size === 0) {
      setFlash({
        variant: 'error',
        message: 'Centang pengguna yang akan dihapus, atau centang hapus semua (kecuali administrator).',
      });
      return;
    }

    const count = checkAllNonAdmin
      ? (deletableTotal ?? Math.max(0, (data?.total ?? 0) - 1))
      : selectedIds.size;

    const scope = checkAllNonAdmin
      ? `semua pengguna non-administrator yang cocok filter${count > 0 ? ` (perkiraan ${count} akun)` : ''}`
      : `${count} pengguna terpilih`;

    if (
      !confirm(
        `Hapus ${scope}?\n\nAkun administrator tidak akan dihapus. Akun Anda sendiri juga dilindungi.\nPengguna yang masih punya WO/Parts akan dilewati.\n\nTindakan ini permanen.`
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    try {
      const body: Record<string, unknown> = checkAllNonAdmin
        ? {
            all_non_admin: true,
            ...(search ? { search } : {}),
            ...(roleFilter ? { role: roleFilter } : {}),
          }
        : { ids: Array.from(selectedIds) };

      const res = await api<{
        message: string;
        deleted: number;
        skipped: number;
        skipped_details?: string[];
      }>('/users/bulk-destroy', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      clearSelection();
      await reloadCurrentPage();

      const detail =
        res.skipped_details?.length
          ? `\n\nDilewati:\n${res.skipped_details.join('\n')}`
          : '';
      setFlash({
        variant: res.deleted > 0 ? 'success' : 'error',
        message: `${res.message}${detail}`,
      });
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Gagal menghapus pengguna',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModal('create');
  };

  const openEdit = (user: UserRow) => {
    setEditing(user);
    setForm({
      name: user.name,
      username: user.username || '',
      email: user.email,
      password: '',
      employee_id: user.employee_id || '',
      role: user.role,
      department: user.department || 'Workshop',
      is_active: user.is_active !== false,
    });
    setError('');
    setModal('edit');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        username: form.username.trim() || null,
        email: form.email,
        employee_id: form.employee_id || null,
        role: form.role,
        department: form.department,
        is_active: form.is_active,
      };
      if (form.password) body.password = form.password;

      if (modal === 'create') {
        if (!form.password) {
          setError('Password wajib diisi untuk user baru.');
          setSaving(false);
          return;
        }
        await api('/users', { method: 'POST', body: JSON.stringify(body) });
        setModal(null);
        await applyFiltersNow(1);
        setFlash({
          variant: 'success',
          message: 'Pengguna baru berhasil ditambahkan.',
        });
      } else if (editing) {
        const updated = await api<UserRow>(`/users/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        setModal(null);
        mergeUserInList(updated);
        await reloadCurrentPage();
        setFlash({
          variant: 'success',
          message: `Pengguna ${updated.name} berhasil diperbarui.`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan';
      if (modal === 'edit') {
        setModal(null);
        setFlash({ variant: 'error', message });
        await reloadCurrentPage();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      const qs = params.toString();
      await apiDownload(
        `/users/export${qs ? `?${qs}` : ''}`,
        `users-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export gagal');
    }
  };

  const downloadTemplate = async () => {
    try {
      await apiDownload('/users/import/template', 'template-import-users.xlsx');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download template gagal');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await apiUploadFile<{
        message: string;
        imported: number;
        skipped: number;
        skipped_empty?: number;
        skipped_duplicate?: number;
        skipped_invalid?: number;
        auto_email?: number;
        auto_username?: number;
        errors: string[];
      }>('/users/import', file);
      await reloadCurrentPage();
      const parts = [
        result.message,
        result.skipped_empty
          ? `\n• ${result.skipped_empty} baris kosong / tidak lengkap (dilewati)`
          : '',
        result.skipped_duplicate
          ? `\n• ${result.skipped_duplicate} email/NIK duplikat (dilewati)`
          : '',
        result.skipped_invalid
          ? `\n• ${result.skipped_invalid} baris tidak valid`
          : '',
        result.auto_email
          ? `\n• ${result.auto_email} email dibuat otomatis (kolom email kosong)`
          : '',
        result.auto_username
          ? `\n• ${result.auto_username} username dibuat otomatis (kolom username kosong)`
          : '',
      ];
      const detail =
        result.errors?.length > 0
          ? `\n\nDetail:\n${result.errors.slice(0, 8).join('\n')}${result.errors.length > 8 ? '\n...' : ''}`
          : '';
      alert(`${parts.join('')}${detail}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import gagal');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const remove = async (target: UserRow) => {
    if (target.id === currentUser.id) {
      setFlash({
        variant: 'error',
        message: 'Tidak dapat menghapus akun yang sedang Anda gunakan untuk login.',
      });
      return;
    }
    if (
      !confirm(
        `Hapus pengguna "${target.name}" (${target.username || target.email})?\n\nTindakan ini permanen dan tidak dapat dibatalkan.`
      )
    ) {
      return;
    }
    try {
      const res = await api<{ message?: string }>(`/users/${target.id}`, { method: 'DELETE' });
      setData((prev) => {
        if (!prev) return prev;
        const nextData = prev.data.filter((u) => u.id !== target.id);
        if (nextData.length === prev.data.length) return prev;
        return {
          ...prev,
          data: nextData,
          total: Math.max(0, prev.total - 1),
        };
      });
      await reloadCurrentPage();
      setFlash({
        variant: 'success',
        message: res.message || `Pengguna ${target.name} berhasil dihapus.`,
      });
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Gagal menghapus pengguna',
      });
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Manajemen Pengguna"
        subtitle="Kelola akun admin, planner, supervisor, mekanik, dan logistic. Import Excel: unduh template, isi data, lalu upload."
        action={
          canManage ? (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              Tambah User
            </button>
          ) : undefined
        }
      />

      {flash && (
        <FlashMessage
          variant={flash.variant}
          message={flash.message}
          onDismiss={() => setFlash(null)}
        />
      )}

      {!seesAllDepartments && (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Menampilkan pengguna pada departemen/lokasi:{' '}
          <strong>{currentUser.department?.trim() || 'belum diatur'}</strong>. Role Admin dan
          Planner dapat melihat seluruh departemen.
        </p>
      )}

      {canImport && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Import massal:</span>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Unduh Template Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Mengimpor...' : 'Import Excel'}
          </button>
          <span className="text-xs text-slate-500">
            Wajib: Nama + Role. Username, Email & NIK boleh kosong (otomatis). Password kosong = default password.
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Cari nama, username, email, NIK..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyFiltersNow(1);
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          <option value="">Semua Role</option>
          {roles.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => applyFiltersNow(1)}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
        <button
          type="button"
          onClick={exportExcel}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Export Excel
        </button>
        {canManage && (checkAllNonAdmin || selectedIds.size > 0) && (
          <button
            type="button"
            disabled={bulkDeleting}
            onClick={bulkDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {bulkDeleting
              ? 'Menghapus...'
              : checkAllNonAdmin
                ? `Hapus Semua (Kecuali Administrator)${deletableTotal != null ? ` · ${deletableTotal}` : ''}`
                : `Hapus Terpilih (${selectedIds.size})`}
          </button>
        )}
      </div>

      {canManage && checkAllNonAdmin && (
        <p className="mb-3 text-sm text-amber-800">
          Mode hapus massal aktif: semua pengguna non-administrator
          {search || roleFilter ? ' sesuai filter' : ''} akan dihapus (kecuali administrator dan akun Anda).
          {deletableTotal != null && ` Perkiraan: ${deletableTotal} akun.`}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="w-14 px-4 py-3 text-center font-semibold">No</th>
              {canManage && (
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={checkAllNonAdmin}
                    onChange={toggleCheckAllNonAdmin}
                    title="Pilih semua untuk hapus massal (kecuali administrator)"
                    className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    aria-label="Pilih semua kecuali administrator"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Username</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">NIK</th>
              <th className="px-4 py-3 font-semibold">Departemen / Lokasi</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              {canManage && <th className="px-4 py-3 font-semibold text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {!data?.data.length ? (
              <tr>
                <td colSpan={canManage ? 10 : 8} className="px-4 py-12 text-center text-slate-400">
                  {data ? 'Tidak ada data' : 'Memuat...'}
                </td>
              </tr>
            ) : (
              data.data.map((user, index) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-center text-slate-500">
                    {(data.current_page - 1) * perPage + index + 1}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isRowChecked(user)}
                        disabled={!isDeletable(user)}
                        onChange={() => toggleRow(user)}
                        title={
                          user.role === 'admin'
                            ? 'Administrator tidak dapat dihapus'
                            : user.id === currentUser.id
                              ? 'Akun login Anda tidak dapat dihapus'
                              : 'Pilih untuk hapus massal'
                        }
                        className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Pilih ${user.name}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-600">{user.username || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{user.employee_id || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{user.department || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {user.role_label || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.is_active !== false ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <UserCheck className="h-4 w-4" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <UserX className="h-4 w-4" /> Nonaktif
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-slate-600 hover:bg-slate-100"
                          title="Edit pengguna"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="text-xs font-medium">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(user)}
                          disabled={user.id === currentUser.id}
                          className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            user.id === currentUser.id
                              ? 'Tidak dapat menghapus akun sendiri'
                              : 'Hapus pengguna'
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="text-xs font-medium">Hapus</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.total > 0 && (
          <Pagination
            page={data.current_page}
            lastPage={data.last_page}
            total={data.total}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
          />
        )}
      </div>

      {modal && (
        <UserModal
          title={modal === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna'}
          form={form}
          setForm={setForm}
          roles={roles}
          error={error}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={save}
          isEdit={modal === 'edit'}
        />
      )}
    </div>
  );
}

function UserModal({
  title,
  form,
  setForm,
  roles,
  error,
  saving,
  onClose,
  onSave,
  isEdit,
}: {
  title: string;
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  roles: RoleRecord[];
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-auto w-full max-h-[90vh] max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 space-y-3">
          <Field label="Nama" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field
            label="Username (kosongkan = otomatis)"
            value={form.username}
            onChange={(v) => setForm({ ...form, username: v })}
          />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field
            label={isEdit ? 'Password baru (kosongkan jika tidak diubah)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
          />
          <Field label="NIK / Employee ID" value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} />
          <label className="block text-sm font-medium text-slate-700">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {roles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Departemen" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-slate-300"
            />
            Akun aktif
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
