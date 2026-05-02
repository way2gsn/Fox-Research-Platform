'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Trash2, Clock, CheckCircle2, Download } from 'lucide-react';
import { api, QuerySpec } from '@/lib/api';
import { Button, Modal, Toast, EmptyState, Badge } from '@/components/ui';
import clsx from 'clsx';

export function QuerySpecPanel({ projectId }: { projectId: number }) {
  const [specs, setSpecs] = useState<QuerySpec[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuerySpec | null>(null);

  // Column mapping state (for manual upload)
  const [uploadModal, setUploadModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [headerCol, setHeaderCol] = useState('');
  const [conceptCol, setConceptCol] = useState('');
  const [subheaderCol, setSubheaderCol] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    try {
      const [specsRes, latestRes] = await Promise.all([
        api.agent.querySpec.list(projectId),
        api.agent.querySpec.latest(projectId),
      ]);
      setSpecs(specsRes.specs);
      setLatest(latestRes.spec);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  // Parse CSV/TSV file client-side for column preview
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      if (lines.length < 2) return;
      const sep = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
      setColumns(headers);
      const rows = lines.slice(1, 51).map(l => {
        const cells = l.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
        return obj;
      });
      setParsedRows(rows);
      // Auto-detect common column names
      setHeaderCol(headers.find(h => /header|question|query/i.test(h)) || headers[0]);
      setConceptCol(headers.find(h => /concept|theme|category/i.test(h)) || '');
      setSubheaderCol(headers.find(h => /sub.?header|sub.?question/i.test(h)) || '');
      setUploadModal(true);
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!headerCol) { showToast('Header column is required', 'error'); return; }
    setUploading(true);
    try {
      await api.agent.querySpec.upload(projectId, {
        source_file_name: sourceFileName,
        column_mapping: {
          header: headerCol,
          concept: conceptCol || null,
          subheader: subheaderCol || null,
        },
        rows: parsedRows,
      });
      showToast('Query spec uploaded');
      setUploadModal(false);
      setParsedRows([]);
      setColumns([]);
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setUploading(false); }
  }

  async function handleDelete(spec: QuerySpec) {
    try {
      await api.agent.querySpec.delete(projectId, spec.id);
      showToast('Spec deleted');
      setConfirmDelete(null);
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function handleDownloadReport(spec: QuerySpec) {
    try {
      const res = await api.agent.querySpec.downloadReport(projectId, spec.id);
      if (!res.ok) throw new Error('Failed to download report');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('content-disposition');
      let filename = `validation_report_${spec.id}.xlsx`;
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-[var(--text-dim)]">
            Query specs define the rows (sub-questions) used by agent runs.
          </p>
          {latest && (
            <p className="text-xs text-amber-400 mt-0.5">
              Active: <span className="font-medium">{latest.source_file_name}</span>
              {' '}— {latest.rows_count} rows
              {latest.has_concept && ' · has concept'}
              {latest.has_subheader && ' · has subheader'}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <Upload size={13} /> Upload CSV Spec
        </Button>
      </div>

      {/* Specs list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 skeleton rounded-lg" />)}
        </div>
      ) : specs.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet size={32} />}
          title="No query specs yet"
          description="Upload a CSV file with headers and sub-questions to define what the agent should analyze."
          action={
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload size={13} /> Upload CSV Spec
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {specs.map((spec) => (
            <div
              key={spec.id}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all',
                latest?.id === spec.id
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--border-bright)]'
              )}
            >
              <FileSpreadsheet
                size={16}
                className={latest?.id === spec.id ? 'text-amber-400' : 'text-[var(--text-faint)]'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text)] truncate">{spec.source_file_name}</span>
                  {latest?.id === spec.id && (
                    <Badge className="bg-amber-500/15 text-amber-400">latest</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--text-faint)] font-mono">
                  <Clock size={9} />
                  <span>{fmtDate(spec.created_at)}</span>
                  <span className="ml-2">· id #{spec.id}</span>
                </div>
              </div>
              <div className="flex gap-1">
                {spec.validation_report_path && (
                  <button
                    onClick={() => handleDownloadReport(spec)}
                    title="Download Validation Report"
                    className="p-1.5 rounded hover:bg-[var(--surface-3)] text-[var(--text-faint)] hover:text-amber-400 transition-all"
                  >
                    <Download size={13} />
                  </button>
                )}
                <button
                  onClick={() => setConfirmDelete(spec)}
                  title="Delete Spec"
                  className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-faint)] hover:text-red-400 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Column mapping modal */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Map Columns" wide>
        <div className="flex flex-col gap-5">
          <p className="text-xs text-[var(--text-dim)]">
            File: <span className="text-amber-400 font-medium">{sourceFileName}</span>
            {' '}· {parsedRows.length} rows detected · {columns.length} columns
          </p>

          {/* Column mapping selects */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Header Column *', value: headerCol, setter: setHeaderCol, required: true },
              { label: 'Concept Column', value: conceptCol, setter: setConceptCol, required: false },
              { label: 'Subheader Column', value: subheaderCol, setter: setSubheaderCol, required: false },
            ].map(({ label, value, setter, required }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-medium">
                  {label}
                </label>
                <select
                  value={value}
                  onChange={e => setter(e.target.value)}
                  className="bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-500/60"
                >
                  {!required && <option value="">(none)</option>}
                  {columns.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <div className="overflow-auto max-h-48 rounded-lg border border-[var(--border)]">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-[var(--surface-2)] sticky top-0">
                    {columns.map(c => (
                      <th
                        key={c}
                        className={clsx(
                          'px-3 py-2 text-left font-medium uppercase tracking-wider border-b border-[var(--border)]',
                          c === headerCol
                            ? 'text-amber-400'
                            : c === conceptCol
                            ? 'text-purple-400'
                            : 'text-[var(--text-faint)]'
                        )}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                      {columns.map(c => (
                        <td key={c} className="px-3 py-1.5 text-[var(--text-dim)] max-w-[200px] truncate">
                          {row[c] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={() => setUploadModal(false)}>Cancel</Button>
            <Button onClick={handleUpload} loading={uploading} disabled={!headerCol}>
              <Upload size={13} /> Upload Spec
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Query Spec">
        <p className="text-sm text-[var(--text-dim)] mb-5">
          Delete spec <span className="text-[var(--text)] font-medium">"{confirmDelete?.source_file_name}"</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Delete</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
