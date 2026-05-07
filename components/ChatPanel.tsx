'use client';
import { useEffect, useRef, useState } from 'react';
import { Send, FileText, ChevronDown, ChevronUp, Zap, Brain, Search, Plus, Trash2, Edit2, MessageSquare, Maximize2, Minimize2, Menu, X } from 'lucide-react';
import { api, ChatResponse, Document, ChatSession, ChatMessage } from '@/lib/api';
import { Button, Spinner, Modal, Input } from '@/components/ui';
import clsx from 'clsx';

type SearchType = 'factual' | 'behavioural' | 'deep research';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: ChatResponse;
  loading?: boolean;
  error?: string;
  dbId?: number; // Backend message ID
}

export function ChatPanel({ projectId, documents, isExpanded, onExpand }: { projectId: number; documents: Document[]; isExpanded?: boolean; onExpand?: () => void }) {
  // Chat Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Rename / Delete Modal State
  const [editingSession, setEditingSession] = useState<ChatSession | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingSession, setDeletingSession] = useState<ChatSession | null>(null);

  // Current Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('behavioural');
  const [llmModel, setLlmModel] = useState<string>('gpt-4o-mini');
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [showSources, setShowSources] = useState<string | null>(null);
  const [docsDropdownOpen, setDocsDropdownOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipLoadRef = useRef(false);

  const readyDocs = documents.filter(d => ['completed','ingested','processed'].includes(d.processing_status?.toLowerCase()));

  // Load Sessions
  useEffect(() => {
    async function load() {
      try {
        const res = await api.chatSessions.list(projectId);
        setSessions(res.chat_sessions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSessions(false);
      }
    }
    load();
  }, [projectId]);

  // Load Messages when activeSessionId changes
  useEffect(() => {
    if (skipLoadRef.current) {
      skipLoadRef.current = false;
      return;
    }

    async function loadMessages() {
      if (!activeSessionId) {
        setMessages([]);
        return;
      }
      try {
        const res = await api.chatSessions.getMessages(activeSessionId);
        const mapped: Message[] = (res.messages || []).map(m => ({
          id: String(m.id),
          role: m.type,
          content: m.content,
          meta: m.message_meta as ChatResponse | undefined,
          dbId: m.id
        }));
        setMessages(mapped);
      } catch (e) {
        console.error(e);
      }
    }
    loadMessages();
  }, [activeSessionId]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  function startNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
  }

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    
    let currentSessionId = activeSessionId;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: q };
    const aiMsg: Message = { id: (Date.now()+1).toString(), role: 'assistant', content: '', loading: true };
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput('');
    setSending(true);

    try {
      // 1. Create session if it doesn't exist
      if (!currentSessionId) {
        // Auto-generate title from the first query (first 30 chars)
        const title = q.length > 30 ? q.slice(0, 30) + '...' : q;
        const res = await api.chatSessions.create(projectId, title);
        currentSessionId = res.chat_session.id;
        
        // Signal the useEffect to skip the next load to prevent state wipe
        skipLoadRef.current = true;
        setActiveSessionId(currentSessionId);
        setSessions(prev => [res.chat_session, ...prev]);
      }

      // 2. Save User Message
      await api.chatSessions.saveMessage(currentSessionId, {
        type: 'user',
        content: q,
        sources: [],
        timestamp: new Date().toISOString()
      });

      // 3. Get AI Response
      const res = await api.chat({
        query: q,
        project_id: projectId,
        search_type: searchType,
        llm_model: llmModel,
        document_ids: selectedDocs.size > 0 ? Array.from(selectedDocs) : undefined,
        history: messages.filter(m => !m.loading).map(m => ({ 
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content 
        })),
      });

      // 4. Update UI with answer
      setMessages(prev => prev.map(m =>
        m.id === aiMsg.id ? { ...m, content: res.answer, meta: res, loading: false } : m
      ));

      // 5. Save AI Message (Separated to avoid wiping UI on save failure)
      try {
        await api.chatSessions.saveMessage(currentSessionId, {
          type: 'assistant',
          content: res.answer,
          search_type: searchType,
          document_ids: selectedDocs.size > 0 ? Array.from(selectedDocs) : undefined,
          timestamp: new Date().toISOString(),
          sources: res.sources || []
        });
      } catch (saveErr: any) {
        console.error("Failed to save AI response:", saveErr);
        // We don't throw here so the user can still see the answer they just got
      }

    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsg.id ? { ...m, loading: false, error: e.message } : m
      ));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleRename() {
    if (!editingSession || !editTitle.trim()) return;
    try {
      const res = await api.chatSessions.rename(editingSession.id, editTitle.trim());
      setSessions(prev => prev.map(s => s.id === res.chat_session.id ? res.chat_session : s));
      setEditingSession(null);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete() {
    if (!deletingSession) return;
    try {
      await api.chatSessions.delete(deletingSession.id);
      setSessions(prev => prev.filter(s => s.id !== deletingSession.id));
      if (activeSessionId === deletingSession.id) {
        startNewChat();
      }
      setDeletingSession(null);
    } catch (e) {
      console.error(e);
    }
  }

  const searchModes: { id: SearchType; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'factual', label: 'Factual', icon: <Search size={13} />, desc: 'Direct facts & lookup' },
    { id: 'behavioural', label: 'Behavioural', icon: <Brain size={13} />, desc: 'Analytical reasoning' },
    { id: 'deep research', label: 'Deep Research', icon: <Zap size={13} />, desc: 'Multi-pass synthesis' },
  ];

  return (
    <div className="flex-1 min-h-0 flex gap-5 relative">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full bg-[var(--surface-1)] border-r border-[var(--border)] p-4 flex flex-col shadow-2xl animate-slide-right">
            <div className="flex items-center justify-between mb-6">
              <span className="font-semibold text-[var(--text)]">Chat History</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1 text-[var(--text-dim)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>
            <Button onClick={() => { startNewChat(); setMobileSidebarOpen(false); }} className="w-full justify-start mb-4" variant={!activeSessionId ? 'primary' : 'outline'}>
              <Plus size={14} className="mr-2" /> New Chat
            </Button>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {loadingSessions ? (
                <div className="flex justify-center p-4"><Spinner size={16} /></div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-[var(--text-faint)] text-center py-4">No saved chats</p>
              ) : (
                sessions.map(s => (
                  <div
                    key={s.id}
                    className={clsx(
                      'group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                      activeSessionId === s.id
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                    )}
                    onClick={() => { setActiveSessionId(s.id); setMobileSidebarOpen(false); }}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <MessageSquare size={13} className="shrink-0" />
                      <span className="text-sm truncate">{s.title}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setEditingSession(s); setEditTitle(s.title); }} className="p-1 hover:text-amber-400"><Edit2 size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeletingSession(s); }} className="p-1 hover:text-red-400"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar for Chat Sessions (Desktop) */}
      <div className="hidden md:flex w-64 shrink-0 flex-col border-r border-[var(--border)] pr-5">
        <Button onClick={startNewChat} className="w-full justify-start mb-4" variant={!activeSessionId ? 'primary' : 'outline'}>
          <Plus size={14} className="mr-2" /> New Chat
        </Button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {loadingSessions ? (
            <div className="flex justify-center p-4"><Spinner size={16} /></div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-[var(--text-faint)] text-center py-4">No saved chats</p>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                className={clsx(
                  'group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                  activeSessionId === s.id
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                )}
                onClick={() => setActiveSessionId(s.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare size={13} className="shrink-0" />
                  <span className="text-sm truncate">{s.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); setEditingSession(s); setEditTitle(s.title); }} className="p-1 hover:text-amber-400"><Edit2 size={11} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setDeletingSession(s); }} className="p-1 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Settings bar */}
        <div className="shrink-0 border-b border-[var(--border)] pb-3 mb-4 flex flex-wrap gap-4 items-start">
          <button 
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <Menu size={16} />
            <span className="text-xs font-medium">History</span>
          </button>
          {onExpand && (
            <div className="ml-auto order-last flex items-center justify-end w-full sm:w-auto sm:order-none mb-2 sm:mb-0">
              <button 
                onClick={onExpand}
                className="p-1.5 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                title={isExpanded ? "Collapse Chat" : "Expand Chat"}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          )}
          {/* Search type */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">Mode</p>
            <div className="flex gap-1">
              {searchModes.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSearchType(m.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    searchType === m.id
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-[var(--text-dim)] border border-[var(--border)] hover:border-[var(--border-bright)]'
                  )}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* LLM Model */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">Model</p>
            <select
              value={llmModel}
              onChange={e => setLlmModel(e.target.value)}
              className="bg-transparent border border-[var(--border)] text-[var(--text-dim)] rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-amber-500/60 hover:border-[var(--border-bright)] transition-all cursor-pointer h-[30px]"
            >
              <option value="gpt-4o-mini" className="bg-[var(--surface-1)] text-[var(--text)]">GPT-4o Mini</option>
              <option value="gpt-4o" className="bg-[var(--surface-1)] text-[var(--text)]">GPT-4o</option>
              <option value="claude-3-haiku" className="bg-[var(--surface-1)] text-[var(--text)]">Claude 3 Haiku</option>
            </select>
          </div>

          {/* Doc filter */}
          {readyDocs.length > 0 && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">
                Filter documents ({selectedDocs.size > 0 ? `${selectedDocs.size} selected` : 'all'})
              </p>
              <div className="relative">
                <button
                  onClick={() => setDocsDropdownOpen(!docsDropdownOpen)}
                  className="w-full flex items-center justify-between bg-transparent border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-amber-500/60 hover:border-[var(--border-bright)] transition-all h-[30px]"
                >
                  <span className="truncate">
                    {selectedDocs.size === 0 
                      ? 'All Documents' 
                      : `${selectedDocs.size} Document${selectedDocs.size > 1 ? 's' : ''}`}
                  </span>
                  <ChevronDown size={14} className={clsx('transition-transform', docsDropdownOpen && 'rotate-180')} />
                </button>
                
                {docsDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDocsDropdownOpen(false)} />
                    <div className="absolute z-20 mt-1 w-64 bg-[var(--surface-1)] border border-[var(--border-bright)] rounded-md shadow-xl max-h-60 overflow-y-auto flex flex-col py-1">
                      {/* Select All Toggle */}
                      <label className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] hover:bg-[var(--surface-2)] cursor-pointer text-xs text-[var(--text)] font-semibold transition-colors">
                        <input
                          type="checkbox"
                          checked={readyDocs.length > 0 && selectedDocs.size === readyDocs.length}
                          onChange={() => {
                            if (selectedDocs.size === readyDocs.length) {
                              setSelectedDocs(new Set());
                            } else {
                              setSelectedDocs(new Set(readyDocs.map(d => d.id)));
                            }
                          }}
                          className="accent-amber-500"
                        />
                        <span>Select All</span>
                        <span className="ml-auto text-[var(--text-faint)] font-normal">{readyDocs.length}</span>
                      </label>

                      {readyDocs.map(d => (
                        <label
                          key={d.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-2)] cursor-pointer text-xs text-[var(--text)] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDocs.has(d.id)}
                            onChange={() => {
                              setSelectedDocs(prev => {
                                const s = new Set(prev);
                                s.has(d.id) ? s.delete(d.id) : s.add(d.id);
                                return s;
                              });
                            }}
                            className="accent-amber-500"
                          />
                          <FileText size={12} className="text-[var(--text-faint)]" />
                          <span className="truncate">{d.original_file_name || d.file_name}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto p-5 space-y-6">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <Brain size={22} className="text-amber-400" />
              </div>
              <p className="text-sm font-medium text-[var(--text-dim)]">Ask anything about your documents</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">
                {readyDocs.length} document{readyDocs.length !== 1 ? 's' : ''} ready · {searchType} mode
              </p>
              {/* Suggested queries */}
              <div className="flex flex-col gap-2 mt-5">
                {['Summarize the key findings', 'What are the main conclusions?', 'List all recommendations'].map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-xs px-4 py-2 rounded-full border border-[var(--border)] text-[var(--text-dim)] hover:border-amber-500/30 hover:text-amber-400 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={clsx('px-4 py-3 text-sm fade-up max-w-[85%]', msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai')}>
                {msg.loading ? (
                  <div className="flex items-center gap-2 text-[var(--text-dim)]">
                    <Spinner size={14} />
                    <span className="text-xs">Thinking…</span>
                  </div>
                ) : msg.error ? (
                  <p className="text-red-400 text-xs">{msg.error}</p>
                ) : (
                  <>
                    <p className="text-[var(--text)] leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                    {msg.meta && msg.role === 'assistant' && (
                      <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-3 text-[11px] text-[var(--text-faint)]">
                        {msg.meta.level_intent && (
                          <span className="font-mono bg-[var(--surface-3)] px-2 py-0.5 rounded">{msg.meta.level_intent}</span>
                        )}
                        {msg.meta.context_used !== undefined && (
                          <span>{msg.meta.context_used} chunk{msg.meta.context_used !== 1 ? 's' : ''} used</span>
                        )}
                        {msg.meta.coverage?.used_docs_count > 0 && (
                          <span>{msg.meta.coverage.used_docs_count} doc{msg.meta.coverage.used_docs_count !== 1 ? 's' : ''} referenced</span>
                        )}
                        {msg.meta.sources && msg.meta.sources.length > 0 && (
                          <button
                            className="ml-auto flex items-center gap-1 text-amber-400 hover:text-amber-300"
                            onClick={() => setShowSources(showSources === msg.id ? null : msg.id)}
                          >
                            {showSources === msg.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            {msg.meta.sources.length} source{msg.meta.sources.length !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>
                    )}

                    {showSources === msg.id && msg.meta?.sources && (
                      <div className="mt-2 space-y-2 fade-up">
                        {msg.meta.sources.map((s, i) => (
                          <div key={i} className="source-card">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[var(--amber)] font-medium truncate max-w-[60%]">{s.document}</span>
                              <div className="flex items-center gap-2">
                                {s.page && <span className="text-[var(--text-faint)]">p.{s.page}</span>}
                                {s.relevance_score && <span className="text-[var(--text-faint)]">{Math.round(s.relevance_score * 100)}%</span>}
                              </div>
                            </div>
                            <p className="text-[var(--text-dim)] leading-relaxed line-clamp-3">{s.snippet}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="shrink-0 mt-6 relative premium-input p-1 focus-within:shadow-lg transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="w-full bg-transparent border-none px-4 py-3 pr-14 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none resize-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="absolute right-3 bottom-3 w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500 text-black disabled:opacity-30 hover:bg-amber-400 transition-all"
          >
            {sending ? <Spinner size={14} /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {/* Modals */}
      <Modal open={!!editingSession} onClose={() => setEditingSession(null)} title="Rename Chat">
        <div className="flex flex-col gap-4">
          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Chat name..." autoFocus />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={() => setEditingSession(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!editTitle.trim()}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deletingSession} onClose={() => setDeletingSession(null)} title="Delete Chat">
        <p className="text-sm text-[var(--text-dim)] mb-5">
          Are you sure you want to delete <span className="text-[var(--text)] font-medium">"{deletingSession?.title}"</span>?
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setDeletingSession(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
