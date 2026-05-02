'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Square, Download, RefreshCw, Eye, ChevronRight, Check, CheckCircle, FileText, Settings, ArrowRight, ArrowLeft, Upload, FileSpreadsheet } from 'lucide-react';
import { api, AgentRun, Document, QuerySpec } from '@/lib/api';
import { Button, Input, StatusBadge, Toast, Spinner, SectionHeader, Modal } from '@/components/ui';
import clsx from 'clsx';

const STEPS = [
  'Select project',
  'Select documents & spec',
  'Review & confirm',
  'Running agent',
  'Results'
];

export function AgentPanel({ projectId, documents }: { projectId: number; documents: Document[] }) {
  const router = useRouter();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null);

  const [step, setStep] = useState(1);

  // Form State
  const [runName, setRunName] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set());
  const [maxVerbatims, setMaxVerbatims] = useState('5');
  const [retrievalMode, setRetrievalMode] = useState('global');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');

  // Query Specs State
  const [specs, setSpecs] = useState<QuerySpec[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);

  // Upload Spec State
  const [uploadModal, setUploadModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [headerCol, setHeaderCol] = useState('');
  const [conceptCol, setConceptCol] = useState('');
  const [subheaderCol, setSubheaderCol] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [uploadingSpec, setUploadingSpec] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Run State
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [runProgress, setRunProgress] = useState<{ percent: number; status: string; message: string } | null>(null);
  const [completedRun, setCompletedRun] = useState<AgentRun | null>(null);
  
  const pollRef = useRef<NodeJS.Timeout>();

  const readyDocs = documents.filter(d => ['completed','ingested','processed'].includes(d.processing_status?.toLowerCase()));
  const selectedSpec = specs.find(s => s.id === selectedSpecId) || null;

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadRuns() {
    try {
      const res = await api.agent.listRuns(projectId);
      setRuns(res.runs);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoadingRuns(false);
    }
  }

  async function loadSpecs() {
    try {
      const res = await api.agent.querySpec.list(projectId);
      setSpecs(res.specs);
      if (res.specs.length > 0 && !selectedSpecId) {
        // Default to the most recent valid spec
        const latest = res.specs.reduce((prev, current) => (prev.id > current.id) ? prev : current, res.specs[0]);
        setSelectedSpecId(latest.id);
      }
    } catch {}
  }

  useEffect(() => {
    loadRuns();
    loadSpecs();
  }, [projectId]);

  // Handle Spec File Upload Parse
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
    if (fileRef.current) fileRef.current.value = ''; // Reset
  }

  async function handleSpecUpload() {
    if (!headerCol) { showToast('Header column is required', 'error'); return; }
    setUploadingSpec(true);
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
      showToast('Execution sheet uploaded successfully');
      setUploadModal(false);
      setParsedRows([]);
      setColumns([]);
      
      // Reload specs and automatically select the new one
      const res = await api.agent.querySpec.list(projectId);
      setSpecs(res.specs);
      const latest = res.specs.reduce((prev, current) => (prev.id > current.id) ? prev : current, res.specs[0]);
      if (latest) setSelectedSpecId(latest.id);
      
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setUploadingSpec(false); 
    }
  }

  // Handle Starting the run
  async function startRun() {
    if (!selectedSpec) {
      showToast('Please select an execution sheet first', 'error');
      return;
    }
    
    setGenerating(true);
    try {
      const res = await api.agent.start({
        project_id: projectId,
        document_ids: selectedDocs.size > 0 ? Array.from(selectedDocs) : undefined,
        run_name: runName.trim() || undefined,
        max_verbatims: parseInt(maxVerbatims) || 5,
        retrieval_mode: retrievalMode,
        generate_subquestions: true,
      });
      setActiveRunId(res.agent_run_id);
      setStep(4); // Move to Running Agent step
    } catch (e: any) { 
      showToast(e.message, 'error'); 
    } finally { 
      setGenerating(false); 
    }
  }

  // Handle Stopping the run
  async function stopRun() {
    if (!activeRunId) return;
    try {
      await api.agent.stop(activeRunId);
      showToast('Run cancelled');
      setStep(5);
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  // Poll progress when step is 4 and activeRunId is set
  useEffect(() => {
    if (step !== 4 || !activeRunId) return;

    const poll = async () => {
      try {
        const res = await api.agent.progress(activeRunId);
        setRunProgress({
          percent: res.percent,
          status: res.status,
          message: res.logs[res.logs.length - 1]?.message || '',
        });
        
        if (['completed','failed','cancelled'].includes(res.status)) {
          clearInterval(pollRef.current);
          await loadRuns(); // Refresh all runs
          const runRes = await api.agent.listRuns(projectId);
          const finalRun = runRes.runs.find(r => r.id === activeRunId);
          if (finalRun) setCompletedRun(finalRun);
          setStep(5); // Move to Results
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    };
    
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => clearInterval(pollRef.current);
  }, [step, activeRunId, projectId]);

  async function downloadExcel(id: number) {
    try {
      const res = await api.agent.downloadExcel(id, projectId);
      if (!res.ok) { showToast('Download failed', 'error'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent_run_${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function downloadReport() {
    if (!selectedSpec?.id) return;
    try {
      const res = await api.agent.querySpec.downloadReport(projectId, selectedSpec.id);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation_report_${selectedSpec.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  // Formatters
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDur = (s: number) => !s ? '—' : s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;

  return (
    <div className="flex flex-col h-full fade-in">
      
      {/* Header */}
      <SectionHeader title="Agent Wizard" subtitle="Run the research agent to generate an insight matrix across your documents." />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const isCompleted = step > stepNum;
          const isCurrent = step === stepNum;
          
          return (
            <div key={s} className="flex items-center shrink-0">
              <div 
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                  isCurrent ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' :
                  isCompleted ? 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]' :
                  'border-transparent text-[var(--text-faint)] opacity-60'
                )}
              >
                <div className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                  isCurrent ? 'bg-amber-500 text-black' :
                  isCompleted ? 'bg-[var(--text-faint)] text-[var(--surface-1)]' :
                  'bg-[var(--surface-3)] text-[var(--text-dim)]'
                )}>
                  {isCompleted ? <Check size={10} /> : stepNum}
                </div>
                {s}
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-6 border-t border-[var(--border)] mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full pb-10">
          
          {/* STEP 1: Select Project & Past Runs */}
          {step === 1 && (
            <div className="space-y-8 fade-in max-w-4xl">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Project Context</h3>
                <p className="text-sm text-[var(--text-dim)]">Verify the project scope before continuing.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">Project ID</p>
                  <p className="text-sm font-medium text-[var(--text)]">{projectId}</p>
                </div>
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">Project Description</p>
                  <p className="text-sm text-[var(--text-dim)] italic">No structured description provided.</p>
                </div>
              </div>
              
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)}>Next <ArrowRight size={16} className="ml-2" /></Button>
              </div>

              {/* Past runs section under Step 1 */}
              <div className="pt-6 border-t border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Past Runs</h3>
                    <p className="text-sm text-[var(--text-dim)]">View or download results from previous executions.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadRuns}><RefreshCw size={13} className="mr-2"/> Refresh</Button>
                </div>
                
                {loadingRuns ? (
                  <div className="p-8 flex justify-center text-amber-500"><Spinner size={24} /></div>
                ) : runs.length === 0 ? (
                  <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-8 text-center">
                    <p className="text-sm text-[var(--text-faint)]">No past runs found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {runs.map(run => (
                      <div key={run.id} className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[var(--border-bright)]">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-medium text-[var(--text)]">#{run.id} · {run.run_name || 'Unnamed Run'}</span>
                            <StatusBadge status={run.status} />
                          </div>
                          <p className="text-xs text-[var(--text-faint)]">{fmtDate(run.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/projects/${projectId}/runs/${run.id}`)}>
                            <Eye size={13} className="mr-1.5" /> View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => downloadExcel(run.id)} disabled={!run.has_output}>
                            <Download size={13} className="mr-1.5" /> Excel
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Select Documents & Spec */}
          {step === 2 && (
            <div className="space-y-8 fade-in max-w-4xl">
              
              {/* Target Documents */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Target Documents</h3>
                  <p className="text-sm text-[var(--text-dim)]">Select specific documents to analyze, or leave unselected to process all.</p>
                </div>

                <div className="space-y-4">
                  <Input
                    label="Run Name (Optional)"
                    value={runName}
                    onChange={e => setRunName(e.target.value)}
                    placeholder="e.g. Q1 Deep Dive Analysis"
                  />

                  <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium flex items-center gap-2">
                        <FileText size={14} /> Available Documents
                      </label>
                      <span className="text-[10px] text-[var(--text-faint)] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                        {selectedDocs.size === 0 ? 'All Selected' : `${selectedDocs.size} Selected`}
                      </span>
                    </div>
                    
                    {readyDocs.length === 0 ? (
                      <p className="text-sm text-amber-400 py-2">No ready documents found. Please ingest documents first.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {readyDocs.map(d => (
                          <button
                            key={d.id}
                            onClick={() => setSelectedDocs(prev => { 
                              const s = new Set(prev); 
                              s.has(d.id) ? s.delete(d.id) : s.add(d.id); 
                              return s; 
                            })}
                            className={clsx(
                              'px-3 py-1.5 rounded-md text-xs border transition-all',
                              selectedDocs.has(d.id)
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                                : 'bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-faint)] hover:border-[var(--border-bright)] hover:text-[var(--text)]'
                            )}
                          >
                            {d.original_file_name || d.file_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Execution Sheet Management */}
              <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Execution sheet</h3>
                  <p className="text-sm text-[var(--text-dim)]">Choose a previously validated execution sheet, or upload a new one and map its columns.</p>
                </div>

                <div className="space-y-4">
                  {/* Select Dropdown */}
                  <div>
                    <label className="text-xs text-[var(--text-dim)] mb-1.5 block">Select previously uploaded execution sheet</label>
                    <select
                      value={selectedSpecId || ''}
                      onChange={e => setSelectedSpecId(Number(e.target.value))}
                      className="w-full bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-500/60"
                    >
                      {specs.length === 0 && <option value="" disabled>No execution sheets uploaded yet</option>}
                      {specs.map(spec => (
                        <option key={spec.id} value={spec.id}>
                          {spec.source_file_name} · {fmtDate(spec.created_at)} · {spec.schema_valid && spec.runnable ? 'Validated / Runnable' : 'Invalid'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Summary Table */}
                  {selectedSpec && (
                    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg overflow-hidden">
                      <div className="bg-[var(--surface-3)] px-4 py-2 border-b border-[var(--border)]">
                        <span className="text-[10px] uppercase text-[var(--text-faint)] font-medium">Selected execution sheet summary</span>
                      </div>
                      
                      <div className="p-4 bg-emerald-500/5 text-emerald-400 text-sm border-b border-[var(--border)] flex items-center gap-2">
                        <CheckCircle size={16} /> Selected sheet (Spec ID: {selectedSpec.id}, File: {selectedSpec.source_file_name})
                      </div>
                      
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--surface-2)] text-[10px] uppercase text-[var(--text-faint)] border-b border-[var(--border)]">
                          <tr>
                            <th className="px-4 py-2 font-medium">Metric</th>
                            <th className="px-4 py-2 font-medium text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          <tr className="bg-[var(--surface-1)]">
                            <td className="px-4 py-2.5 text-[var(--text-dim)]">Total uploaded rows</td>
                            <td className="px-4 py-2.5 text-right font-medium text-[var(--text)]">{selectedSpec.validation_summary?.total_uploaded_rows || 0}</td>
                          </tr>
                          <tr className="bg-[var(--surface-2)]">
                            <td className="px-4 py-2.5 text-[var(--text-dim)]">Executable rows</td>
                            <td className="px-4 py-2.5 text-right font-medium text-[var(--text)]">{selectedSpec.validation_summary?.executable_rows || 0}</td>
                          </tr>
                          <tr className="bg-[var(--surface-1)]">
                            <td className="px-4 py-2.5 text-[var(--text-dim)]">Skipped rows</td>
                            <td className="px-4 py-2.5 text-right font-medium text-[var(--text)]">{selectedSpec.validation_summary?.skipped_rows || 0}</td>
                          </tr>
                          <tr className="bg-[var(--surface-2)]">
                            <td className="px-4 py-2.5 text-[var(--text-dim)]">Rows defaulted to factual</td>
                            <td className="px-4 py-2.5 text-right font-medium text-[var(--text)]">{selectedSpec.validation_summary?.defaulted_to_factual_rows || 0}</td>
                          </tr>
                          <tr className="bg-[var(--surface-1)]">
                            <td className="px-4 py-2.5 text-[var(--text-dim)]">Rows with carry-forward applied</td>
                            <td className="px-4 py-2.5 text-right font-medium text-[var(--text)]">{selectedSpec.validation_summary?.carried_forward_rows || 0}</td>
                          </tr>
                          <tr className="bg-[var(--surface-2)]">
                            <td className="px-4 py-2.5 text-[var(--text-dim)]">Rows with warnings</td>
                            <td className="px-4 py-2.5 text-right font-medium text-[var(--text)]">{selectedSpec.validation_summary?.rows_with_warnings || 0}</td>
                          </tr>
                        </tbody>
                      </table>
                      
                      <div className="p-3 bg-[var(--surface-2)] border-t border-[var(--border)]">
                        <Button variant="ghost" size="sm" className="w-full text-center" onClick={downloadReport} disabled={!selectedSpec.validation_report_path}>
                          <Download size={14} className="mr-2" /> Download selected validation report
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Upload File Input */}
                  <div className="pt-4">
                    <h4 className="text-sm font-semibold text-[var(--text)] mb-3">Upload new execution sheet</h4>
                    <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileChange} />
                    <Button variant="outline" onClick={() => fileRef.current?.click()}>
                      <Upload size={14} className="mr-2" /> Upload (.csv / .tsv)
                    </Button>
                    <p className="text-xs text-[var(--text-faint)] mt-2">Maximum file size: 200MB. Select a CSV or TSV to parse and map columns automatically.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-[var(--border)]">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} className="mr-2" /> Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={readyDocs.length === 0 || !selectedSpecId}>
                  Next <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & confirm */}
          {step === 3 && (
            <div className="space-y-6 fade-in max-w-5xl">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Review & Confirm</h3>
                <p className="text-sm text-[var(--text-dim)]">Review your execution scope before triggering the run.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left Column - Scope & Spec */}
                <div className="space-y-5">
                  <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase text-[var(--text-faint)] mb-1 font-medium">Project Scope</p>
                      <p className="text-sm text-[var(--text-dim)]">ID: {projectId} — No headers or structured description found.</p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase text-[var(--text-faint)] mb-2 font-medium flex items-center justify-between">
                        Execution Sheet Validation
                      </p>
                      {selectedSpec ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 border border-emerald-400/20 p-2.5 rounded-md">
                            <CheckCircle size={16} /> Validated sheet selected (ID: {selectedSpec.id})
                          </div>
                          <p className="text-xs text-[var(--text-faint)]">File: {selectedSpec.source_file_name}</p>
                          <p className="text-xs text-[var(--text-faint)]">Total Rows: {selectedSpec.validation_summary?.total_uploaded_rows || 0}</p>
                        </div>
                      ) : (
                        <div className="text-amber-400 text-sm bg-amber-400/10 border border-amber-400/20 p-3 rounded-md">
                          No execution sheet selected. Go back to select one!
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Summary & Config */}
                <div className="space-y-5">
                  <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase text-[var(--text-faint)] mb-1 font-medium">Run Name</p>
                      <p className="text-sm text-[var(--text)]">{runName || <span className="text-[var(--text-faint)] italic">Unnamed run</span>}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase text-[var(--text-faint)] mb-1 font-medium">Documents Target</p>
                        <p className="text-sm text-[var(--text)]">{selectedDocs.size === 0 ? `All (${readyDocs.length})` : selectedDocs.size}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-[var(--text-faint)] mb-1 font-medium">Execution Type</p>
                        <p className="text-sm text-[var(--text)]">Matrix Run</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5">
                    <h4 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2 mb-4">
                      <Settings size={14} className="text-[var(--text-faint)]"/> Agent Configuration
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-[var(--text-dim)] mb-1.5 block">LLM Model</label>
                        <select
                          value={llmModel}
                          onChange={e => setLlmModel(e.target.value)}
                          className="w-full bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-500/60"
                        >
                          <option value="gpt-4o-mini">Balanced — gpt-4o-mini (Recommended)</option>
                          <option value="gpt-4o">High Quality — gpt-4o</option>
                          <option value="claude-3-haiku">Fast — claude-3-haiku</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} className="mr-2" /> Back
                </Button>
                <Button variant="primary" onClick={startRun} disabled={!selectedSpecId} loading={generating}>
                  Start Agent Run <Play size={14} className="ml-2 fill-current" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Running agent */}
          {step === 4 && (
            <div className="space-y-8 py-12 fade-in flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full border-[3px] border-[var(--surface-3)] border-t-amber-500 animate-spin mb-2" />
              
              <div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Agent is Running</h3>
                <p className="text-sm text-[var(--text-dim)] max-w-md mx-auto">
                  The AI is analyzing the documents and building the matrix. This might take a few minutes.
                </p>
              </div>

              {runProgress && (
                <div className="w-full max-w-md bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5 text-left">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-medium text-[var(--text-dim)] uppercase tracking-wider">Progress</span>
                    <span className="text-sm font-mono text-amber-500">{runProgress.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden mb-4">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-500" 
                      style={{ width: `${runProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={runProgress.status} />
                    <p className="text-xs text-[var(--text-faint)] truncate" title={runProgress.message}>
                      {runProgress.message || 'Processing...'}
                    </p>
                  </div>
                </div>
              )}

              <Button variant="danger" onClick={stopRun} className="mt-4">
                <Square size={14} className="mr-2" /> Cancel Run
              </Button>
            </div>
          )}

          {/* STEP 5: Results */}
          {step === 5 && (
            <div className="space-y-8 py-12 fade-in flex flex-col items-center text-center">
              <div className={clsx(
                "w-16 h-16 rounded-full flex items-center justify-center mb-2 border",
                completedRun?.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
              )}>
                {completedRun?.status === 'failed' || completedRun?.status === 'cancelled' 
                  ? <Square size={24} />
                  : <CheckCircle size={24} />
                }
              </div>

              <div>
                <h3 className="text-2xl font-bold text-[var(--text)] mb-2">
                  {completedRun?.status === 'failed' ? 'Run Failed' : 
                   completedRun?.status === 'cancelled' ? 'Run Cancelled' : 'Run Completed'}
                </h3>
                <p className="text-sm text-[var(--text-dim)] max-w-md mx-auto">
                  {completedRun?.status === 'completed' 
                    ? 'The agent has finished generating the matrix. You can now view or download the results.'
                    : 'The agent run was stopped or encountered an error.'}
                </p>
              </div>

              {completedRun && completedRun.status === 'completed' && (
                <div className="w-full max-w-md bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5 text-left grid grid-cols-2 gap-4">
                   <div>
                    <p className="text-[10px] uppercase text-[var(--text-faint)] mb-1 font-semibold">Duration</p>
                    <p className="text-sm text-[var(--text)] font-medium">{fmtDur(completedRun.duration_seconds)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-faint)] mb-1 font-semibold">Docs Processed</p>
                    <p className="text-sm text-[var(--text)] font-medium">{completedRun.document_count}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Return to Start
                </Button>
                {completedRun?.status === 'completed' && (
                  <>
                    <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/runs/${completedRun.id}`)}>
                      <Eye size={16} className="mr-2" /> View Run
                    </Button>
                    <Button variant="primary" onClick={() => downloadExcel(completedRun.id)}>
                      <Download size={16} className="mr-2" /> Download Excel
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Upload Mapping Modal */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Map Query Columns" wide>
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm p-4 rounded flex items-start gap-3">
            <FileSpreadsheet className="shrink-0" />
            <div>
              <p className="font-semibold mb-1">Found {parsedRows.length} rows</p>
              <p className="text-[var(--text-dim)]">Map your spreadsheet columns to the system fields. The "Header / Question" field is required to define what the agent will research.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text)]">Header / Question <span className="text-red-400">*</span></label>
              <select value={headerCol} onChange={e => setHeaderCol(e.target.value)} className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text)] outline-none focus:border-amber-500">
                <option value="">-- Select Column --</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-[10px] text-[var(--text-faint)]">The main query or requirement</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text)]">Sub-header / Criteria</label>
              <select value={subheaderCol} onChange={e => setSubheaderCol(e.target.value)} className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text)] outline-none focus:border-amber-500">
                <option value="">-- Select Column --</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-[10px] text-[var(--text-faint)]">Additional detail or nuance</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text)]">Concept / Theme</label>
              <select value={conceptCol} onChange={e => setConceptCol(e.target.value)} className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text)] outline-none focus:border-amber-500">
                <option value="">-- Select Column --</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-[10px] text-[var(--text-faint)]">Used for grouping questions</p>
            </div>
          </div>

          <div className="border border-[var(--border)] rounded overflow-hidden">
            <div className="bg-[var(--surface-2)] px-4 py-2 text-xs font-medium text-[var(--text-dim)] border-b border-[var(--border)]">
              Data Preview (First 3 rows)
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-1)] border-b border-[var(--border)] text-[var(--text-faint)] text-[10px] uppercase">
                <tr>
                  {columns.map(c => (
                    <th key={c} className={clsx("px-4 py-2 font-medium truncate max-w-[150px]", 
                      c === headerCol ? 'text-amber-500' : 
                      c === subheaderCol || c === conceptCol ? 'text-[var(--text)]' : ''
                    )}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {parsedRows.slice(0, 3).map((r, i) => (
                  <tr key={i} className="hover:bg-[var(--surface-2)]">
                    {columns.map(c => (
                      <td key={c} className="px-4 py-2 truncate max-w-[150px] text-[var(--text)]" title={r[c]}>{r[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setUploadModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSpecUpload} loading={uploadingSpec} disabled={!headerCol}>
              Upload Spec <Upload size={14} className="ml-2" />
            </Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
