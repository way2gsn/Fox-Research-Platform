'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, MessageSquare, Bot, TableProperties } from 'lucide-react';
import { api, Project, Document } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { AgentPanel } from '@/components/AgentPanel';
import { QuerySpecPanel } from '@/components/QuerySpecPanel';
import { Spinner } from '@/components/ui';
import clsx from 'clsx';

type Tab = 'documents' | 'chat' | 'agent' | 'queryspec';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id);

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tab, setTab] = useState<Tab>('documents');
  const [loading, setLoading] = useState(true);
  const [chatExpanded, setChatExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [projects, docs] = await Promise.all([
          api.projects.list(),
          api.documents.list(projectId),
        ]);
        setProject(projects.find(p => p.id === projectId) || null);
        setDocuments(docs);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [projectId]);

  const refreshDocs = async () => {
    try {
      const docs = await api.documents.list(projectId);
      setDocuments(docs);
    } catch {}
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'documents', label: 'Documents', icon: <FileText size={14} />, count: documents.length },
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={14} /> },
    // { id: 'queryspec', label: 'Query Spec', icon: <TableProperties size={14} /> },
    { id: 'agent', label: 'Agent Runs', icon: <Bot size={14} /> },
  ];

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: 'Projects', href: '/' }, { label: 'Loading…' }]}>
        <div className="flex items-center justify-center h-48">
          <Spinner size={24} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: 'Projects', href: '/' }, { label: project?.name || `Project ${projectId}` }]}>
      <div className="flex flex-col flex-1 h-full w-full min-h-0">
        {/* Project header */}
        {!chatExpanded && (
        <div className="max-w-6xl mx-auto w-full px-6 pt-6 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h1 className="text-xl font-bold text-[var(--text)]">{project?.name}</h1>
            <span className="text-xs font-mono text-[var(--text-faint)] bg-[var(--surface-2)] px-2 py-0.5 rounded">#{projectId}</span>
          </div>
          {project?.description && (
            <div className="text-sm text-[var(--text-dim)] ml-5">
              {(() => {
                try {
                  const parsed = JSON.parse(project.description);
                  return (
                    <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-xs">
                      <p><span className="font-medium text-[var(--text)]">Project Description:</span> <span className="text-[var(--text-dim)]">{parsed.project_description || '-'}</span></p>
                      <p><span className="font-medium text-[var(--text)]">Supporting Documents:</span> <span className="text-[var(--text-dim)]">{parsed.supporting_documents_note || '-'}</span></p>
                      <p><span className="font-medium text-[var(--text)]">Research Headers:</span> <span className="text-[var(--text-dim)]">{parsed.research_headers?.length ? parsed.research_headers.join(', ') : '-'}</span></p>
                    </div>
                  );
                } catch (e) {
                  return <p>{project.description}</p>;
                }
              })()}
            </div>
          )}
        </div>
        )}

        {/* Tabs */}
        {!chatExpanded && (
        <div className="max-w-6xl mx-auto w-full px-6">
          <div className="flex gap-1 border-b border-[var(--border)] mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
                tab === t.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
              )}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className="text-[10px] bg-[var(--surface-3)] px-1.5 py-0.5 rounded font-mono">{t.count}</span>
              )}
            </button>
          ))}
          </div>
        </div>
        )}

        {/* Tab content */}
        <div className={clsx("flex-1 min-h-0 fade-up flex flex-col pb-6", chatExpanded && "pt-6")}>
          {tab === 'documents' && (
            <div className="max-w-6xl mx-auto w-full px-6 overflow-auto flex-1">
              <DocumentsPanel projectId={projectId} />
            </div>
          )}
          {tab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 w-full px-6">
              <ChatPanel 
                projectId={projectId} 
                documents={documents} 
                isExpanded={chatExpanded}
                onExpand={() => setChatExpanded(!chatExpanded)}
              />
            </div>
          )}
          {tab === 'queryspec' && (
            <div className="max-w-6xl mx-auto w-full px-6 overflow-auto flex-1">
              <QuerySpecPanel projectId={projectId} />
            </div>
          )}
          {tab === 'agent' && (
            <div className="max-w-6xl mx-auto w-full px-6 overflow-auto flex-1">
              <AgentPanel projectId={projectId} documents={documents} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
