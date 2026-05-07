'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Folder, Trash2, Pencil, FileText, Calendar } from 'lucide-react';
import { api, Project } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { Button, Modal, Input, Textarea, StatusBadge, EmptyState, Toast, Spinner } from '@/components/ui';

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null);

  // Create modal
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Delete confirm
  const [deleting, setDeleting] = useState<Project | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.projects.list();
      setProjects(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const p = await api.projects.create(newName.trim(), newDesc.trim());
      setProjects(prev => [p, ...prev]);
      setCreating(false);
      setNewName(''); setNewDesc('');
      showToast('Project created');
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const p = await api.projects.update(editing.id, { name: editName, description: editDesc });
      setProjects(prev => prev.map(x => x.id === p.id ? p : x));
      setEditing(null);
      showToast('Project updated');
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.projects.delete(deleting.id);
      setProjects(prev => prev.filter(x => x.id !== deleting.id));
      setDeleting(null);
      showToast('Project deleted');
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  return (
    <AppShell breadcrumbs={[{ label: 'Projects' }]}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--amber)] mb-1">Workspace</p>
            <h1 className="text-2xl font-bold text-[var(--text)]">Research Projects</h1>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              Organize documents, run AI-powered analysis, and chat with your knowledge base.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} /> New Project
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Total Projects', value: projects.length },
            { label: 'Active', value: projects.length },
            { label: 'Backend', value: <span className="text-emerald-400 font-mono text-xs">● Online</span> },
          ].map((s, i) => (
            <div key={i} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-lg px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1">{s.label}</p>
              <p className="text-xl font-bold text-[var(--text)] font-mono">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 skeleton rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<Folder size={40} />}
            title="No projects yet"
            description="Create your first project to start uploading documents and running AI analysis."
            action={<Button onClick={() => setCreating(true)}><Plus size={14} /> Create Project</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={() => { setEditing(p); setEditName(p.name); setEditDesc(p.description || ''); }}
                onDelete={() => setDeleting(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="New Project">
        <div className="flex flex-col gap-4">
          <Input label="Project Name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Market Research 2025" autoFocus />
          <Textarea label="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What documents will you analyze?" rows={3} />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!newName.trim()}>Create Project</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Project">
        <div className="flex flex-col gap-4">
          <Input label="Project Name" value={editName} onChange={e => setEditName(e.target.value)} />
          <Textarea label="Description" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleEdit} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Project">
        <p className="text-sm text-[var(--text-dim)] mb-5">
          Are you sure you want to delete <span className="text-[var(--text)] font-medium">"{deleting?.name}"</span>?
          All documents and runs will be permanently removed.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete Project</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AppShell>
  );
}

function ProjectCard({ project, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  const date = new Date(project.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="group relative bg-[var(--surface-1)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--border-bright)] transition-all duration-200 hover:shadow-lg hover:shadow-black/20 fade-up">
      {/* Accent line */}
      <div className="accent-line" />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Folder size={17} className="text-amber-400" />
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-[var(--surface-3)] text-[var(--text-faint)] hover:text-[var(--text-dim)]">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-faint)] hover:text-red-400">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <Link href={`/projects/${project.id}`} className="block group/link">
          <h3 className="font-semibold text-sm text-[var(--text)] group-hover/link:text-amber-400 transition-colors line-clamp-1 mb-1">
            {project.name}
          </h3>
          <p className="text-xs text-[var(--text-faint)] line-clamp-2 min-h-[2rem]">
            {project.description || 'No description provided'}
          </p>
        </Link>

        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-[var(--border)]">
          <Calendar size={11} className="text-[var(--text-faint)]" />
          <span className="text-[11px] text-[var(--text-faint)] font-mono">{date}</span>
          <span className="ml-auto text-[11px] text-[var(--text-faint)] font-mono">#{project.id}</span>
        </div>
      </div>
    </div>
  );
}
