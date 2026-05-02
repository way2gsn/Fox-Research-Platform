'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, Trash2, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { api, Document } from '@/lib/api';
import { Button, StatusBadge, EmptyState, Modal, Toast, Spinner } from '@/components/ui';
import clsx from 'clsx';

export function DocumentsPanel({ projectId }: { projectId: number }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Polling for in-progress docs
  const pollRef = useRef<NodeJS.Timeout>();

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    try {
      const data = await api.documents.list(projectId);
      setDocs(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [projectId]);

  // Poll if any doc is still processing
  useEffect(() => {
    const active = docs.some(d => ['queued','pending','ingesting'].includes(d.processing_status?.toLowerCase()));
    if (active) {
      pollRef.current = setInterval(load, 4000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [docs]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const arr = Array.from(files);
    let successCount = 0;
    for (const file of arr) {
      try {
        await api.documents.upload(projectId, file);
        successCount++;
      } catch (e: any) {
        showToast(`${file.name}: ${e.message}`, 'error');
      }
    }
    if (successCount > 0) showToast(`${successCount} file(s) queued for ingestion`);
    setUploading(false);
    load();
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleAll() {
    if (selected.size === docs.length) setSelected(new Set());
    else setSelected(new Set(docs.map(d => d.id)));
  }

  async function handleDeleteSelected() {
    setDeletingSelected(true);
    try {
      const res = await api.documents.delete(Array.from(selected));
      showToast(`${res.deleted} document(s) deleted`);
      setSelected(new Set());
      setConfirmDeleteSelected(false);
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setDeletingSelected(false); }
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      const res = await api.documents.deleteAll(projectId);
      showToast(`${res.deleted} document(s) deleted`);
      setConfirmDeleteAll(false);
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setDeletingAll(false); }
  }

  const statusIcon = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'completed' || s === 'ingested') return <CheckCircle2 size={13} className="text-emerald-400" />;
    if (s === 'failed') return <AlertCircle size={13} className="text-red-400" />;
    if (s === 'running' || s === 'ingesting' || s === 'queued' || s === 'pending') return <Spinner size={13} />;
    return <Clock size={13} className="text-[var(--text-faint)]" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1048576).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
        <Button onClick={() => inputRef.current?.click()} loading={uploading} size="sm">
          <Upload size={13} /> Upload Files
        </Button>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </Button>
        {selected.size > 0 && (
          <Button variant="danger" size="sm" onClick={() => setConfirmDeleteSelected(true)}>
            <Trash2 size={13} /> Delete {selected.size} selected
          </Button>
        )}
        {docs.length > 0 && (
          <Button variant="danger" size="sm" className="ml-auto" onClick={() => setConfirmDeleteAll(true)}>
            <Trash2 size={13} /> Delete All
          </Button>
        )}
      </div>

      {/* Drop zone overlay */}
      <div
        className="border-2 border-dashed border-[var(--border)] rounded-lg mb-4 p-4 text-center text-xs text-[var(--text-faint)] hover:border-amber-500/30 hover:text-[var(--text-dim)] transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
      >
        Drop files here or click to upload · PDF, DOCX, TXT, XLSX and more supported
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_,i) => <div key={i} className="h-10 skeleton rounded" />)}
        </div>
      ) : docs.length === 0 ? (
        <EmptyState icon={<FileText size={32} />} title="No documents yet" description="Upload files to begin indexing them into your knowledge base." />
      ) : (
        <div className="rounded-lg overflow-hidden border border-[var(--border)] overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Table header */}
            <div className="grid grid-cols-[24px_1fr_100px_80px_100px] gap-3 px-3 py-2 bg-[var(--surface-2)] text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">
              <input type="checkbox" checked={selected.size === docs.length && docs.length > 0} onChange={toggleAll} className="w-3.5 h-3.5 accent-amber-500" />
            <span>File</span>
            <span>Type</span>
            <span>Size</span>
            <span>Status</span>
          </div>
          {docs.map((doc, idx) => (
            <div
              key={doc.id}
              className={clsx(
                'grid grid-cols-[24px_1fr_100px_80px_100px] gap-3 items-center px-3 py-2.5 border-t border-[var(--border)] text-sm transition-colors cursor-pointer',
                selected.has(doc.id) ? 'bg-amber-500/5' : 'hover:bg-[var(--surface-2)]'
              )}
              onClick={() => toggleSelect(doc.id)}
            >
              <input
                type="checkbox"
                checked={selected.has(doc.id)}
                onChange={() => toggleSelect(doc.id)}
                onClick={e => e.stopPropagation()}
                className="w-3.5 h-3.5 accent-amber-500"
              />
              <div className="flex items-center gap-2 min-w-0">
                {statusIcon(doc.processing_status)}
                <span className="truncate text-xs text-[var(--text)]">{doc.original_file_name || doc.file_name}</span>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-faint)] truncate">{doc.file_type?.split('/')[1] || '—'}</span>
              <span className="text-[10px] font-mono text-[var(--text-faint)]">{formatSize(doc.file_size)}</span>
              <StatusBadge status={doc.processing_status || 'unknown'} />
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal open={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)} title="Delete All Documents">
        <p className="text-sm text-[var(--text-dim)] mb-5">
          This will permanently delete all {docs.length} documents from this project. This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setConfirmDeleteAll(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteAll} loading={deletingAll}>Delete All</Button>
        </div>
      </Modal>

      {/* Confirm delete selected */}
      <Modal open={confirmDeleteSelected} onClose={() => setConfirmDeleteSelected(false)} title="Delete Selected Documents">
        <p className="text-sm text-[var(--text-dim)] mb-5">
          Are you sure you want to permanently delete {selected.size} selected document{selected.size !== 1 ? 's' : ''}? This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setConfirmDeleteSelected(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteSelected} loading={deletingSelected}>Delete Selected</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
