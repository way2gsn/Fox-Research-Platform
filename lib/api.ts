const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Document {
  id: number;
  file_name: string;
  original_file_name: string;
  file_size: number;
  file_type: string;
  processing_status: string;
  project_id: number;
  created_at: string;
  updated_at: string;
}

export interface IngestionJob {
  job_id: number;
  document_id: number;
  status: string;
  message: string;
  progress_current: number;
  progress_total: number;
  created_at: string;
  updated_at: string;
}

export interface ChatSource {
  document: string;
  page: number;
  snippet: string;
  snippet_lines?: string[];
  snippet_html?: string;
  summary: string;
  full_chunk_text?: string;
  source_type?: string;
  relevance_score: number;
  document_id: number;
  chunk_id: number;
}

export interface ChatResponse {
  answer: string;
  raw_l1: { direct_answer: string; key_observations: string[]; evidence: string[] } | null;
  level_intent?: string;
  intent?: string;
  context_used: number;
  sources: ChatSource[];
  coverage: {
    selected_docs_count: number | null;
    used_docs_count: number;
    used_doc_ids: number[];
    missing_doc_ids: number[];
  };
  deep_research_status?: string;
  error?: string | null;
}

export interface AgentRun {
  id: number;
  run_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  duration_seconds: number;
  document_count: number;
  retrieval_mode: string;
  has_output: boolean;
}

export interface AgentProgress {
  agent_run_id: number;
  status: string;
  percent: number;
  done_cells: number;
  cell_count: number;
  logs: { log_time: string; step: string; message: string }[];
}

export interface AgentRunDetail {
  run: {
    id: number;
    project_id: number;
    run_name: string;
    description_used?: string;
    headers_used?: string[];
    document_ids_used?: number[];
    config?: Record<string, any>;
    status: string;
    duration_seconds: number;
    subquestion_count: number;
    document_count: number;
    cell_count: number;
    token_input_count: number;
    token_output_count: number;
    created_at: string;
    updated_at?: string;
    excel_path?: string;
    csv_path?: string;
  };
  rows: { id: number; header: string; sub_question: string; is_reflective: boolean; row_index: number }[];
  cells: {
    agent_row_id: number;
    document_id: number;
    has_evidence: boolean;
    evidence_strength: string;
    verbatims: any[]; // Can be strings or structured ChatSource objects
    summary: string;
    inference: string;
  }[];
}

export interface QuerySpec {
  id: number;
  project_id: number;
  source_file_name: string;
  schema_valid?: boolean;
  runnable?: boolean;
  validation_report_path?: string;
  validation_summary?: {
    total_uploaded_rows?: number;
    executable_rows?: number;
    skipped_rows?: number;
    defaulted_to_factual_rows?: number;
    carried_forward_rows?: number;
    rows_with_warnings?: number;
  };
  created_at: string;
}

export interface ChatSession {
  id: number;
  project_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp?: string;
  message_meta?: Record<string, any>;
  created_at?: string;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export const api = {
  health: () => req<{ status: string }>('/health'),

  projects: {
    list: () => req<Project[]>('/projects'),
    create: (name: string, description: string) =>
      req<Project>('/projects', { method: 'POST', body: JSON.stringify({ name, description }) }),
    update: (id: number, data: Partial<{ name: string; description: string }>) =>
      req<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      req<{ deleted: boolean; project_id: number; documents_deleted: number }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  documents: {
    list: (projectId: number) => req<Document[]>(`/documents?project_id=${projectId}`),
    upload: (projectId: number, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('project_id', String(projectId));
      return fetch(`${BASE}/upload`, { method: 'POST', body: fd }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Upload failed');
        return d as { status: string; job_id: number; document_id: number; file_name: string };
      });
    },
    delete: (documentIds: number[], projectId?: number) =>
      req<{ deleted: number }>('/documents', {
        method: 'DELETE',
        body: JSON.stringify({ document_ids: documentIds, project_id: projectId }),
      }),
    deleteAll: (projectId: number) =>
      req<{ deleted: number }>('/documents', {
        method: 'DELETE',
        body: JSON.stringify({ project_id: projectId }),
      }),
  },

  ingestion: {
    getJob: (jobId: number) => req<IngestionJob>(`/ingestion/jobs/${jobId}`),
  },

  chat: (payload: {
    query: string;
    project_id: number;
    document_ids?: number[];
    search_type?: 'factual' | 'behavioural' | 'deep research';
    llm_model?: string;
    history?: { type?: string; role?: string; content: string }[];
  }) => req<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify(payload) }),

  chatSessions: {
    list: (projectId: number) => req<{ project_id: number; chat_sessions: ChatSession[] }>(`/projects/${projectId}/chat-sessions`),
    create: (projectId: number, title: string) =>
      req<{ created: boolean; chat_session: ChatSession }>(`/projects/${projectId}/chat-sessions`, { method: 'POST', body: JSON.stringify({ title }) }),
    getMessages: (sessionId: number) =>
      req<{ chat_session_id: number; messages: ChatMessage[] }>(`/chat-sessions/${sessionId}/messages`),
    saveMessage: (sessionId: number, message: Omit<ChatMessage, 'id' | 'created_at' | 'message_meta'> & { search_type?: string; document_ids?: number[] }) =>
      req<{ saved: boolean; chat_session_id: number; project_id: number; message_id: number }>(`/chat-sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
    rename: (sessionId: number, title: string) =>
      req<{ updated: boolean; chat_session: ChatSession }>(`/chat-sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
    delete: (sessionId: number) => req<{ deleted: boolean; chat_session_id: number; project_id: number }>(`/chat-sessions/${sessionId}`, { method: 'DELETE' }),
  },

  agent: {
    start: (payload: {
      project_id: number;
      document_ids?: number[];
      generate_subquestions?: boolean;
      manual_subquestions?: string;
      max_verbatims?: number;
      run_name?: string;
      llm_model?: string;
      retrieval_mode?: string;
    }) => req<{ agent_run_id: number; status: string }>('/agent/start', { method: 'POST', body: JSON.stringify(payload) }),

    stop: (runId: number) =>
      req<{ agent_run_id: number; status: string }>(`/agent/stop/${runId}`, { method: 'POST' }),

    listRuns: (projectId: number, params?: { q?: string; status?: string; limit?: number }) => {
      const p = new URLSearchParams({ project_id: String(projectId) });
      if (params?.q) p.set('q', params.q);
      if (params?.status) p.set('status', params.status);
      if (params?.limit) p.set('limit', String(params.limit));
      return req<{ runs: AgentRun[] }>(`/agent/runs?${p}`);
    },

    progress: (runId: number) => req<AgentProgress>(`/agent/progress/${runId}`),

    getRunDetail: (runId: number, projectId: number) =>
      req<AgentRunDetail>(`/agent/run/${runId}?project_id=${projectId}`),

    downloadExcel: (runId: number, projectId: number) =>
      fetch(`${BASE}/agent/download/${runId}/excel?project_id=${projectId}`),

    querySpec: {
      upload: (projectId: number, body: object) =>
        req<{ status: string; spec: QuerySpec }>(`/agent/query-spec/${projectId}`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      list: (projectId: number) => req<{ project_id: number; specs: QuerySpec[] }>(`/agent/query-spec/${projectId}`),
      latest: (projectId: number) =>
        req<{ project_id: number; spec: (QuerySpec & { has_concept: boolean; has_subheader: boolean; rows_count: number }) | null }>(
          `/agent/query-spec/${projectId}/latest`
        ),
      delete: (projectId: number, specId: number) =>
        req<{ status: string }>(`/agent/query-spec/${projectId}/${specId}`, { method: 'DELETE' }),
      downloadReport: (projectId: number, specId: number) =>
        fetch(`${BASE}/agent/query-spec/${projectId}/${specId}/report`),
    },
  },
};
