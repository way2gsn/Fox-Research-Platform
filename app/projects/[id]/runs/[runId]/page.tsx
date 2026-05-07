'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { api, AgentRunDetail } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { Button, Modal, StatusBadge, Spinner, Badge } from '@/components/ui';
import clsx from 'clsx';

export default function RunDetailPage() {
  const { id: projectId, runId } = useParams<{ id: string; runId: string }>();
  const pid = parseInt(projectId);
  const rid = parseInt(runId);

  const [detail, setDetail] = useState<AgentRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCell, setActiveCell] = useState<AgentRunDetail['cells'][0] | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.agent.getRunDetail(rid, pid);
        setDetail(res);
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [rid, pid]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await api.agent.downloadExcel(rid, pid);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail?.run.run_name || `run_${rid}`}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  }

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: 'Projects', href: '/' }, { label: `Project ${projectId}`, href: `/projects/${projectId}` }, { label: 'Run Detail' }]}>
        <div className="flex items-center justify-center h-48"><Spinner size={24} /></div>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell breadcrumbs={[{ label: 'Projects', href: '/' }, { label: `Project ${projectId}`, href: `/projects/${projectId}` }, { label: 'Run Detail' }]}>
        <div className="flex items-center justify-center h-48 text-[var(--text-dim)]">Run not found</div>
      </AppShell>
    );
  }

  const { run, rows, cells } = detail;

  // Build unique document IDs
  const docIds = Array.from(new Set(cells.map(c => c.document_id))).sort();

  // Cells lookup: rowId -> docId -> cell
  const cellMap = new Map<string, typeof cells[0]>();
  cells.forEach(c => cellMap.set(`${c.agent_row_id}:${c.document_id}`, c));

  const strengthColor = (s: string) => {
    if (!s) return 'text-[var(--text-faint)]';
    if (s === 'strong') return 'text-emerald-400';
    if (s === 'moderate') return 'text-amber-400';
    if (s === 'weak') return 'text-orange-500';
    return 'text-[var(--text-faint)]';
  };

  const strengthDot = (s: string) => {
    if (!s || s === 'none') return <span className="text-[var(--text-faint)] text-xs">—</span>;
    return (
      <div className={clsx('w-2.5 h-2.5 rounded-full', s === 'strong' ? 'bg-emerald-500' : s === 'moderate' ? 'bg-amber-500' : 'bg-orange-500')} />
    );
  };

  // Group rows by header
  const headers = Array.from(new Set(rows.map(r => r.header)));

  return (
    <AppShell breadcrumbs={[
      { label: 'Projects', href: '/' },
      { label: `Project ${projectId}`, href: `/projects/${projectId}` },
      { label: run.run_name || `Run #${rid}` },
    ]}>
      <div className="px-6 py-5">
        {/* Run header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-bold text-[var(--text)]">{run.run_name || `Run #${rid}`}</h1>
              <StatusBadge status={run.status} />
            </div>
            <div className="flex gap-4 text-[11px] text-[var(--text-faint)] font-mono flex-wrap">
              <span>{run.document_count} documents</span>
              <span>{run.subquestion_count} subquestions</span>
              <span>{run.cell_count} cells</span>
              {run.duration_seconds && <span>{run.duration_seconds < 60 ? `${run.duration_seconds}s` : `${Math.floor(run.duration_seconds/60)}m ${run.duration_seconds%60}s`}</span>}
              <span>{run.token_input_count?.toLocaleString()} in · {run.token_output_count?.toLocaleString()} out tokens</span>
            </div>
          </div>
          <Button onClick={handleDownload} loading={downloading} size="sm">
            <Download size={13} /> Download Excel
          </Button>
        </div>

        {/* Matrix */}
        <div className="overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-1)]">
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + docIds.length * 140}px` }}>
            <thead>
              <tr>
                <th className="sticky left-0 bg-[var(--surface-2)] border-b border-r border-[var(--border)] px-4 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)] font-medium z-10 min-w-[200px]">
                  Sub-question
                </th>
                {docIds.map(docId => (
                  <th key={docId} className="bg-[var(--surface-2)] border-b border-r border-[var(--border)] px-3 py-3 text-center text-[11px] text-[var(--text-dim)] font-mono min-w-[140px]">
                    Doc #{docId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                // Show header row when header changes
                const prevHeader = ri > 0 ? rows[ri-1].header : null;
                const showHeader = row.header !== prevHeader;
                return (
                  <>
                    {showHeader && (
                      <tr key={`hdr-${row.header}`}>
                        <td
                          colSpan={docIds.length + 1}
                          className="bg-[var(--surface-2)] border-b border-[var(--border)] px-4 py-2 text-[11px] uppercase tracking-widest text-amber-400 font-semibold"
                        >
                          {row.header}
                        </td>
                      </tr>
                    )}
                    <tr key={row.id} className="group hover:bg-[var(--surface-2)] transition-colors">
                      <td className="sticky left-0 bg-[var(--surface-1)] group-hover:bg-[var(--surface-2)] border-b border-r border-[var(--border)] px-4 py-3 text-[var(--text-dim)] transition-colors z-10 align-top">
                        <div className="flex items-start gap-2">
                          {row.is_reflective && (
                            <Badge className="bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">R</Badge>
                          )}
                          <span className="leading-relaxed">{row.sub_question}</span>
                        </div>
                      </td>
                      {docIds.map(docId => {
                        const cell = cellMap.get(`${row.id}:${docId}`);
                        return (
                          <td
                            key={docId}
                            className={clsx(
                              'border-b border-r border-[var(--border)] px-3 py-3 text-center cursor-pointer transition-all align-top',
                              cell?.has_evidence ? 'hover:bg-amber-500/5' : ''
                            )}
                            onClick={() => cell && setActiveCell(cell)}
                          >
                            {cell ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex justify-center">{strengthDot(cell.evidence_strength)}</div>
                                {cell.summary && (
                                  <p className="text-[11px] text-[var(--text-faint)] line-clamp-2 leading-relaxed text-left">{cell.summary}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[var(--text-faint)] text-[11px]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 text-[11px] text-[var(--text-faint)]">
          {[['strong','bg-emerald-500'], ['moderate','bg-amber-500'], ['weak','bg-orange-500']].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={clsx('w-2 h-2 rounded-full', color)} /> {label}
            </span>
          ))}
          <span className="ml-2">Click a cell to see details</span>
        </div>
      </div>

      {/* Cell detail modal */}
      <Modal open={!!activeCell} onClose={() => setActiveCell(null)} title="Cell Detail" wide>
        {activeCell && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-[var(--surface-3)] text-[var(--text-dim)]">Doc #{activeCell.document_id}</Badge>
              <Badge className={clsx('capitalize', strengthColor(activeCell.evidence_strength))}>
                {activeCell.evidence_strength || 'no evidence'}
              </Badge>
            </div>

            {activeCell.summary && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">Summary</p>
                <p className="text-sm text-[var(--text)] leading-relaxed">{activeCell.summary}</p>
              </div>
            )}

            {activeCell.inference && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">Inference</p>
                <p className="text-sm text-[var(--text-dim)] leading-relaxed">{activeCell.inference}</p>
              </div>
            )}

            {activeCell.verbatims?.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">Verbatims ({activeCell.verbatims.length})</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {activeCell.verbatims.map((v: any, i) => (
                    <div key={i} className="source-card text-[var(--text-dim)] italic">
                      "{typeof v === 'string' ? v : (v.snippet || v.full_chunk_text || JSON.stringify(v))}"
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
