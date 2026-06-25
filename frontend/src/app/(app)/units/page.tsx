'use client';

import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { Plus, Pencil, Trash2, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { api, apiDownload, apiUploadFile } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import type { OitmRecord, Paginated } from '@/lib/types';

const emptyForm = {
  U_MIS_UnitNo: '',
  U_MIS_ModeNo: '',
};

export default function UnitsPage() {
  const { can } = useAuth();
  const canManage = can(Permission.OITM_MANAGE);
  const [data, setData] = useState<Paginated<OitmRecord> | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<OitmRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = (targetPage = page) => {
    const params = new URLSearchParams();
    params.set('page', String(targetPage));
    params.set('per_page', String(perPage));
    if (search) params.set('search', search);

    api<Paginated<OitmRecord>>(`/oitm?${params}`)
      .then((result) => {
        if (result.data.length === 0 && targetPage > 1) {
          setPage(targetPage - 1);
          return;
        }
        setData(result);
      })
      .catch(console.error);
  };

  useEffect(() => {
    load(page);
  }, [page, perPage]);

  const applyFilter = () => {
    setPage(1);
    if (page === 1) {
      load(1);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModal('create');
  };

  const openEdit = (row: OitmRecord) => {
    setEditing(row);
    setForm({
      U_MIS_UnitNo: row.U_MIS_UnitNo,
      U_MIS_ModeNo: row.U_MIS_ModeNo,
    });
    setError('');
    setModal('edit');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') {
        await api('/oitm', { method: 'POST', body: JSON.stringify(form) });
      } else if (editing) {
        await api(`/oitm/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    try {
      await apiDownload('/oitm/export', `oitm-unit-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export gagal');
    }
  };

  const downloadTemplate = async () => {
    try {
      await apiDownload('/oitm/template', 'template-oitm-unit.xlsx');
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
        errors: string[];
      }>('/oitm/import', file);
      load();
      const parts = [
        result.message,
        result.skipped_empty
          ? `\n• ${result.skipped_empty} baris kosong / kolom tidak lengkap (dilewati)`
          : '',
        result.skipped_duplicate
          ? `\n• ${result.skipped_duplicate} duplikat (dilewati)`
          : '',
      ];
      const detail =
        result.errors?.length > 0
          ? `\n\nError:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? '\n...' : ''}`
          : '';
      alert(`${parts.join('')}${detail}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import gagal');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const remove = async (row: OitmRecord) => {
    if (!confirm(`Hapus unit ${row.U_MIS_UnitNo} — ${row.U_MIS_ModeNo}?`)) return;
    try {
      await api(`/oitm/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  };

  const cellInput =
    'min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-0';

  return (
    <div className="p-8">
      <PageHeader
        title="Input Unit"
        subtitle="Master data unit — tabel OITM. Import: baris kosong atau kolom tidak lengkap otomatis dilewati."
        action={
          canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              Tambah Unit
            </button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          placeholder="Cari Unit No atau Model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        />
        <button
          type="button"
          onClick={applyFilter}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Template
          </button>
          {canManage && (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Unit No</th>
              <th className="px-4 py-3 font-semibold">Model (U_MIS_ModeNo)</th>
              {canManage && <th className="px-4 py-3 font-semibold">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {!data?.data.length ? (
              <tr>
                <td colSpan={canManage ? 3 : 2} className="px-4 py-12 text-center text-slate-400">
                  {data ? 'Tidak ada data' : 'Memuat...'}
                </td>
              </tr>
            ) : (
              data.data.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.U_MIS_UnitNo}</td>
                  <td className="px-4 py-3 text-slate-700">{row.U_MIS_ModeNo}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row)}
                          className="rounded p-1.5 text-red-500 hover:bg-red-50"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModal(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-bold text-slate-900">
              {modal === 'create' ? 'Tambah Unit' : 'Edit Unit'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">Data disimpan ke tabel OITM</p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <form onSubmit={save} className="mt-4">
              <p className="mb-2 text-sm font-bold text-slate-900">Unit</p>
              <table className="mb-4 w-full border-collapse border border-slate-900 text-sm">
                <tbody>
                  <tr>
                    <td className="w-[38%] border border-slate-900 px-3 py-1.5 font-medium">Unit</td>
                    <td className="border border-slate-900">
                      <div className="flex items-center">
                        <span className="shrink-0 pl-2 font-medium">:</span>
                        <input
                          className={cellInput}
                          value={form.U_MIS_UnitNo}
                          onChange={(e) => setForm({ ...form, U_MIS_UnitNo: e.target.value })}
                          required
                          placeholder="V 039"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-3 py-1.5 font-medium">Unit Model</td>
                    <td className="border border-slate-900">
                      <div className="flex items-center">
                        <span className="shrink-0 pl-2 font-medium">:</span>
                        <input
                          className={cellInput}
                          value={form.U_MIS_ModeNo}
                          onChange={(e) => setForm({ ...form, U_MIS_ModeNo: e.target.value })}
                          required
                          placeholder="Komatsu HD785"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
