# FoxSense AI — Frontend ↔ Backend API Contract (Easy Read)

This file is written for the React frontend developer. It lists the backend APIs that the current Streamlit frontend uses, grouped by screen/feature.

Backend source checked from latest uploaded codebase:

- `app.py`
- `agent/agent_routes.py`
- `streamlit_app.py`
- `pages/agent_wizard.py`

---

## 0. Base Setup

### Base URL

Use one environment variable in React:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:15000";
```

For Docker internal calls, the current Streamlit app uses:

```txt
http://rag-backend:5000
```

For browser/React calls from your machine or EC2 public UI, use the externally reachable backend URL, for example:

```txt
http://localhost:15000
http://<EC2_PUBLIC_IP>:15000
```

### Common error format

Most failed APIs return:

```json
{
  "error": "Reason for failure"
}
```

### Main frontend screens and API groups

| Frontend screen / feature | API group |
|---|---|
| Backend status | Health APIs |
| Project list/create/edit/delete | Project APIs |
| Upload/list/delete documents | Document APIs |
| Ask Your Doc Q&A | Chat API + Chat Session APIs |
| Saved chats in sidebar | Chat Session APIs |
| Agent Matrix execution sheet upload/selection | Agent Query Spec APIs |
| Agent Matrix run/progress/result/download | Agent Run APIs |

---

# 1. Health APIs

## 1.1 Check backend health

**Use when:** App loads or user opens sidebar/status panel.

```http
GET /health
GET /
```

### Success response

```json
{
  "status": "Backend is running and ready"
}
```

---

# 2. Project APIs

## 2.1 List projects

**Use when:** App opens, project dropdown/sidebar loads.

```http
GET /projects
```

### Success response

```json
[
  {
    "id": 1,
    "name": "Project name",
    "description": "Optional description",
    "created_at": "2026-04-30T10:00:00"
  }
]
```

---

## 2.2 Create project

**Use when:** User creates a new project.

```http
POST /projects
Content-Type: application/json
```

### Request body

```json
{
  "name": "Project name",
  "description": "Optional description"
}
```

The backend also accepts `name` and `description` as query params, but React should use JSON.

### Success response

```json
{
  "id": 1,
  "name": "Project name",
  "description": "Optional description"
}
```

### Common errors

```json
{ "error": "name is required" }
```

---

## 2.3 Rename/update project

**Use when:** User edits project name/description.

```http
PUT /projects/{project_id}
PATCH /projects/{project_id}
Content-Type: application/json
```

### Request body

```json
{
  "name": "Updated project name",
  "description": "Updated description"
}
```

### Success response

```json
{
  "updated": true,
  "project": {
    "id": 1,
    "name": "Updated project name",
    "description": "Updated description"
  }
}
```

---

## 2.4 Delete project

**Use when:** User deletes a project.

```http
DELETE /projects/{project_id}
```

### Success response

```json
{
  "deleted": true,
  "project_id": 1
}
```

---

# 3. Document APIs

## 3.1 Upload document

**Use when:** User uploads transcript/document files.

```http
POST /upload?project_id={project_id}
Content-Type: multipart/form-data
```

### Form data

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `file` | File | Yes | Uploaded document |
| `project_id` | number/string | Yes | Can be query param or form field |

### React example payload

```ts
const formData = new FormData();
formData.append("file", selectedFile);
formData.append("project_id", String(projectId));
```

### Success response

```json
{
  "status": "queued",
  "job_id": 10,
  "document_id": 25,
  "file_name": "IDI-1.docx"
}
```

### Important frontend behavior

After upload, poll the ingestion job using:

```http
GET /ingestion/jobs/{job_id}
```

---

## 3.2 Get ingestion job status

**Use when:** Frontend needs to show upload/processing progress.

```http
GET /ingestion/jobs/{job_id}
```

### Success response

```json
{
  "id": 10,
  "document_id": 25,
  "status": "queued | running | completed | failed",
  "message": "Queued for ingestion",
  "created_at": "2026-04-30T10:00:00",
  "updated_at": "2026-04-30T10:01:00"
}
```

---

## 3.3 List documents for project

**Use when:** User opens document selector or Agent Matrix document selection step.

```http
GET /documents?project_id={project_id}
```

### Success response

```json
[
  {
    "id": 25,
    "project_id": 1,
    "file_name": "IDI-1.docx",
    "original_file_name": "IDI-1.docx",
    "file_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "file_size": 123456,
    "created_at": "2026-04-30T10:00:00"
  }
]
```

---

## 3.4 Delete selected documents

**Use when:** User selects one or more documents and deletes them.

```http
DELETE /documents
Content-Type: application/json
```

### Request body

```json
{
  "project_id": 1,
  "document_ids": [25, 26]
}
```

### Success response

```json
{
  "deleted": 2
}
```

---

## 3.5 Delete all documents in a project

**Use when:** User chooses delete all documents from project.

```http
DELETE /documents?project_id={project_id}
```

or

```http
DELETE /documents
Content-Type: application/json
```

```json
{
  "project_id": 1
}
```

### Success response

```json
{
  "deleted": 10
}
```

---

# 4. Ask Your Doc API

## 4.1 Ask a question

**Use when:** User asks a question in Ask Your Doc.

```http
POST /chat
Content-Type: application/json
```

### Request body

```json
{
  "query": "What does the respondent say about the packaging?",
  "project_id": 1,
  "document_ids": [25],
  "history": [],
  "llm_model": "gpt-4o-mini",
  "search_type": "factual"
}
```

### Request fields

| Field | Type | Required | Allowed / Notes |
|---|---:|---:|---|
| `query` | string | Yes | User question |
| `project_id` | number | Yes | Active project id |
| `document_ids` | number[] | Optional | Selected documents. If omitted, backend retrieves from project scope. |
| `history` | array | Optional | Current backend keeps strict/no-history behavior in key generation paths. |
| `llm_model` | string | Optional | Example: `gpt-4o-mini` |
| `search_type` | string | Optional | `factual`, `behavioural`, `deep research` |

### Success response for factual / behavioural

```json
{
  "answer": "Answer:\n...\n\nEvidence:\n...",
  "raw_l1": {
    "direct_answer": "...",
    "key_observations": ["..."],
    "evidence": ["..."]
  },
  "level_intent": "L1 | L2 | L3 | L4",
  "question_frames": {
    "primary_frame": "...",
    "secondary_frame": "..."
  },
  "context_used": 8,
  "sources": [
    {
      "document": "IDI-1.docx",
      "page": 1,
      "snippet": "Moderator and respondent excerpt...",
      "snippet_lines": ["..."],
      "snippet_html": "...",
      "summary": "...",
      "full_chunk_text": "...",
      "source_type": "chunk_context",
      "relevance_score": 0.72,
      "document_id": 25,
      "chunk_id": 6176
    }
  ],
  "coverage": {
    "selected_docs_count": 1,
    "used_docs_count": 1,
    "used_doc_ids": [25],
    "missing_doc_ids": []
  }
}
```

### Success response for deep research

Deep Research is routed through the same `/chat` endpoint when:

```json
{
  "search_type": "deep research"
}
```

The response is the payload returned by the Deep Research pipeline. React should always read:

```json
{
  "answer": "...",
  "sources": ["..."],
  "coverage": {},
  "context_used": 0
}
```

Additional debug/metadata keys may exist depending on backend generation.

### Common errors

```json
{ "error": "query is required" }
{ "error": "project_id is required" }
{ "error": "Invalid project_id" }
{ "error": "Invalid search_type. Allowed values are: factual, behavioural, deep research" }
```

---

# 5. Chat Session APIs

These APIs store chat history/sidebar sessions. They are separate from `/chat`, which generates the answer.

## 5.1 List chat sessions for a project

**Use when:** Sidebar loads saved chats.

```http
GET /projects/{project_id}/chat-sessions
```

### Success response

```json
{
  "project_id": 1,
  "chat_sessions": [
    {
      "id": 100,
      "project_id": 1,
      "title": "Packaging question",
      "created_at": "2026-04-30T10:00:00",
      "updated_at": "2026-04-30T10:05:00"
    }
  ]
}
```

---

## 5.2 Create chat session

**Use when:** User starts a new chat in a project.

```http
POST /projects/{project_id}/chat-sessions
Content-Type: application/json
```

### Request body

```json
{
  "title": "New chat title"
}
```

### Success response

```json
{
  "created": true,
  "chat_session": {
    "id": 100,
    "project_id": 1,
    "title": "New chat title"
  }
}
```

---

## 5.3 Get messages in a chat session

**Use when:** User clicks an older chat session.

```http
GET /chat-sessions/{chat_session_id}/messages
```

### Success response

```json
{
  "chat_session_id": 100,
  "messages": [
    {
      "id": 1,
      "type": "user",
      "content": "What does she say about packaging?",
      "sources": [],
      "timestamp": "10:05:00",
      "message_meta": {},
      "created_at": "2026-04-30T10:05:00"
    },
    {
      "id": 2,
      "type": "assistant",
      "content": "Answer...",
      "sources": [{ "document": "IDI-1.docx" }],
      "timestamp": "10:05:20",
      "message_meta": {},
      "created_at": "2026-04-30T10:05:20"
    }
  ]
}
```

---

## 5.4 Save one chat message

**Use when:** After user sends a message and after assistant answer is received.

```http
POST /chat-sessions/{chat_session_id}/messages
Content-Type: application/json
```

### Request body

```json
{
  "message": {
    "type": "user",
    "content": "What does she say about packaging?",
    "sources": [],
    "timestamp": "10:05:00"
  }
}
```

For assistant message:

```json
{
  "message": {
    "type": "assistant",
    "content": "Answer...",
    "sources": [
      {
        "document": "IDI-1.docx",
        "page": 1,
        "snippet": "..."
      }
    ],
    "timestamp": "10:05:20",
    "search_type": "behavioural",
    "document_ids": [25]
  }
}
```

Any extra keys inside `message` are saved into `message_meta`.

### Success response

```json
{
  "saved": true,
  "chat_session_id": 100,
  "project_id": 1,
  "message_id": 2
}
```

---

## 5.5 Rename chat session

**Use when:** User edits chat title.

```http
PATCH /chat-sessions/{chat_session_id}
Content-Type: application/json
```

### Request body

```json
{
  "title": "Updated chat title"
}
```

### Success response

```json
{
  "updated": true,
  "chat_session": {
    "id": 100,
    "title": "Updated chat title"
  }
}
```

---

## 5.6 Delete chat session

**Use when:** User deletes a saved chat.

```http
DELETE /chat-sessions/{chat_session_id}
```

### Success response

```json
{
  "deleted": true,
  "chat_session_id": 100,
  "project_id": 1
}
```

---

# 6. Agent Matrix — Execution Sheet APIs

Execution sheet = the uploaded question matrix/specification used by Agent Matrix.

## 6.1 Upload / validate execution sheet

**Use when:** User uploads an Excel/CSV question sheet and maps columns.

```http
POST /agent/query-spec/{project_id}
Content-Type: application/json
```

### Request body

```json
{
  "source_file_name": "question_format.xlsx",
  "column_mapping": {
    "concept": "Concept",
    "header": "Header",
    "question": "Question",
    "analysis_mode": "Analysis Mode"
  },
  "rows": [
    {
      "Concept": "Packaging",
      "Header": "Ease of use",
      "Question": "Which pack is easier to use and why?",
      "Analysis Mode": "behavioural"
    }
  ]
}
```

### Column mapping rules

| Canonical key | Required? | Notes |
|---|---:|---|
| `concept` | No | If blank in a row, backend carries forward last non-blank concept. |
| `header` | No | If blank in a row, backend carries forward last non-blank header. |
| `question` | Yes | Blank question rows are skipped. |
| `analysis_mode` | Yes | Blank/invalid values default to factual with warning. |

### Allowed analysis modes in execution sheet

Backend canonical values:

```txt
factual
behavioural
deep
```

Accepted aliases include:

```txt
fact, facts, behavioral, behaviour, behavior, behav, deep research, deep-research, deep_research
```

### Success response when schema is valid

```json
{
  "status": "ok",
  "validation_import": {
    "id": 5,
    "project_id": 1,
    "source_file_name": "question_format.xlsx",
    "schema_valid": true,
    "runnable": true,
    "validation_report_path": "agent_outputs/.../report.xlsx"
  },
  "validation": {
    "schema_valid": true,
    "runnable": true,
    "column_mapping": {
      "concept": "Concept",
      "header": "Header",
      "question": "Question",
      "analysis_mode": "Analysis Mode"
    },
    "summary": {
      "total_uploaded_rows": 10,
      "executable_rows": 9,
      "skipped_rows": 1,
      "defaulted_to_factual_rows": 0,
      "carried_forward_rows": 3,
      "rows_with_warnings": 0
    },
    "errors": []
  }
}
```

### Response when schema is invalid

HTTP status is `400`, but response still contains validation details:

```json
{
  "status": "ok",
  "validation_import": {},
  "validation": {
    "schema_valid": false,
    "runnable": false,
    "summary": {},
    "errors": ["Missing required mapped column: \"Question\""]
  }
}
```

---

## 6.2 List uploaded execution sheets for project

**Use when:** Agent Matrix Step 2 needs dropdown of previously uploaded sheets.

```http
GET /agent/query-spec/{project_id}
```

### Success response

```json
{
  "project_id": 1,
  "specs": [
    {
      "id": 5,
      "project_id": 1,
      "source_file_name": "question_format.xlsx",
      "created_at": "2026-04-30T10:00:00",
      "schema_valid": true,
      "runnable": true,
      "validation_summary": {},
      "validation_errors": [],
      "validation_report_path": "agent_outputs/.../report.xlsx"
    }
  ]
}
```

Frontend should sort latest first if backend output is not already sorted as needed.

---

## 6.3 Get latest execution sheet

**Use when:** Agent Matrix wants to auto-select latest valid sheet.

```http
GET /agent/query-spec/{project_id}/latest
```

### Success response

```json
{
  "project_id": 1,
  "spec": {
    "id": 5,
    "project_id": 1,
    "source_file_name": "question_format.xlsx",
    "created_at": "2026-04-30T10:00:00",
    "schema_valid": true,
    "runnable": true,
    "validation_report_path": "agent_outputs/.../report.xlsx",
    "summary": {
      "total_uploaded_rows": 10,
      "executable_rows": 9
    }
  }
}
```

If no sheet exists:

```json
{
  "project_id": 1,
  "spec": null
}
```

---

## 6.4 Download execution sheet validation report

**Use when:** User clicks validation report download.

```http
GET /agent/query-spec/{project_id}/{spec_id}/report
```

### Success response

Binary file download:

- `.xlsx` if validation report is Excel
- `.txt` if schema-level error report

### Common errors

```json
{ "error": "Validation import not found" }
{ "error": "Validation report file not found" }
```

---

## 6.5 Delete execution sheet

**Use when:** User removes a previously uploaded execution sheet.

```http
DELETE /agent/query-spec/{project_id}/{spec_id}
```

### Success response

```json
{
  "status": "ok"
}
```

---

# 7. Agent Matrix — Run APIs

## 7.1 Start agent run

**Use when:** User clicks Run Matrix / Start Analysis.

```http
POST /agent/start
Content-Type: application/json
```

### Request body

```json
{
  "project_id": 1,
  "document_ids": [25, 26],
  "query_spec_id": 5,
  "run_name": "April packaging analysis",
  "llm_model": "gpt-4o-mini"
}
```

### Request fields

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `project_id` | number | Yes | Active project |
| `document_ids` | number[] | Optional | If omitted, backend can use all project docs depending on service behavior. |
| `query_spec_id` | number | Optional but recommended | If omitted, backend uses latest valid execution sheet. |
| `run_name` | string | Optional | Display name for run history |
| `llm_model` | string | Optional | Model override |

### Success response

HTTP status: `202`

```json
{
  "agent_run_id": 101,
  "status": "started"
}
```

### Important frontend behavior

After this response, poll:

```http
GET /agent/progress/{agent_run_id}
```

---

## 7.2 Stop/cancel agent run

**Use when:** User clicks Stop while run is pending/running.

```http
POST /agent/stop/{agent_run_id}
```

### Success response

```json
{
  "agent_run_id": 101,
  "status": "cancelled"
}
```

If the run is already completed/failed/cancelled, backend returns current status:

```json
{
  "agent_run_id": 101,
  "status": "completed"
}
```

---

## 7.3 Poll agent run progress

**Use when:** Agent run is in progress.

```http
GET /agent/progress/{agent_run_id}
```

### Success response

```json
{
  "agent_run_id": 101,
  "status": "pending | planned | running | completed | failed | cancelled",
  "percent": 45,
  "done_cells": 9,
  "cell_count": 20,
  "logs": [
    {
      "log_time": "2026-04-30T10:00:00",
      "step": "retrieval",
      "message": "Running cell 9 of 20"
    }
  ]
}
```

---

## 7.4 List previous agent runs

**Use when:** Run history panel loads.

```http
GET /agent/runs?project_id={project_id}&q={search_text}&status={status}&limit=50
```

### Query params

| Param | Required | Notes |
|---|---:|---|
| `project_id` | Yes | Active project |
| `q` | No | Search by run name or id |
| `status` | No | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `limit` | No | Default 50, max 200 |

### Success response

```json
{
  "runs": [
    {
      "id": 101,
      "run_name": "April packaging analysis",
      "status": "completed",
      "created_at": "2026-04-30T10:00:00",
      "updated_at": "2026-04-30T10:15:00",
      "duration_seconds": 900,
      "document_count": 2,
      "llm_model": "gpt-4o-mini",
      "cell_count": 20,
      "successful_cell_count": 19,
      "failed_cell_count": 1,
      "token_input_count": 50000,
      "token_output_count": 8000,
      "total_llm_calls": 60,
      "total_latency_ms": 180000,
      "estimated_cost_usd": 0.25,
      "has_output": true
    }
  ]
}
```

---

## 7.5 Get one agent run details

**Use when:** User opens run details or frontend wants to render result matrix without downloading Excel.

```http
GET /agent/run/{agent_run_id}?project_id={project_id}
```

### Success response

```json
{
  "run": {
    "id": 101,
    "project_id": 1,
    "run_name": "April packaging analysis",
    "status": "completed",
    "llm_model": "gpt-4o-mini",
    "cell_count": 20,
    "successful_cell_count": 19,
    "failed_cell_count": 1,
    "token_input_count": 50000,
    "token_output_count": 8000,
    "total_llm_calls": 60,
    "total_latency_ms": 180000,
    "estimated_cost_usd": 0.25
  },
  "rows": [
    {
      "id": 501,
      "concept": "Packaging",
      "header": "Ease of use",
      "question": "Which pack is easier to use and why?",
      "analysis_mode": "behavioural",
      "skip_reason": "",
      "is_skipped": false,
      "source_excel_row_number": 2,
      "row_index": 1
    }
  ],
  "cells": [
    {
      "agent_row_id": 501,
      "document_id": 25,
      "status": "completed",
      "answer_text": "Answer...",
      "error_category": null,
      "has_evidence": true,
      "evidence_strength": "strong",
      "evidence_score": 0.83,
      "verbatims": [],
      "input_tokens": 2500,
      "output_tokens": 600,
      "total_tokens": 3100,
      "total_llm_calls": 3,
      "latency_per_call": [],
      "total_latency_ms": 9000
    }
  ]
}
```

---

## 7.6 Download agent output Excel

**Use when:** User clicks Download Output.

```http
GET /agent/download/{agent_run_id}/excel?project_id={project_id}
```

### Success response

Binary file download:

```txt
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Backend regenerates Excel/CSV on demand if DB file path is missing.

---

# 8. Recommended React Flow

## 8.1 Ask Your Doc flow

```txt
1. GET /projects
2. User selects project
3. GET /documents?project_id=...
4. Optional: GET /projects/{project_id}/chat-sessions
5. User asks question
6. POST /chat
7. Show answer + sources
8. Save user message: POST /chat-sessions/{id}/messages
9. Save assistant message: POST /chat-sessions/{id}/messages
```

## 8.2 Document upload flow

```txt
1. POST /upload?project_id=... with multipart file
2. Backend returns job_id and document_id
3. Poll GET /ingestion/jobs/{job_id}
4. When completed, refresh GET /documents?project_id=...
```

## 8.3 Agent Matrix flow

```txt
1. GET /projects
2. User selects project
3. GET /documents?project_id=...
4. GET /agent/query-spec/{project_id}
5. Upload new sheet if needed: POST /agent/query-spec/{project_id}
6. Start run: POST /agent/start
7. Poll: GET /agent/progress/{agent_run_id}
8. On completed/cancelled/failed: GET /agent/run/{agent_run_id}?project_id=...
9. Download: GET /agent/download/{agent_run_id}/excel?project_id=...
```

---

# 9. Minimal TypeScript Types

These are frontend-friendly types. They do not need to match every backend DB column exactly.

```ts
export type SearchType = "factual" | "behavioural" | "deep research";
export type AgentAnalysisMode = "factual" | "behavioural" | "deep";
export type RunStatus = "pending" | "planned" | "running" | "completed" | "failed" | "cancelled";

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

export interface DocumentItem {
  id: number;
  project_id?: number;
  file_name?: string;
  original_file_name?: string;
  file_type?: string;
  file_size?: number;
  created_at?: string;
}

export interface SourceItem {
  document?: string;
  page?: number | null;
  snippet?: string;
  snippet_lines?: string[];
  snippet_html?: string;
  summary?: string;
  full_chunk_text?: string;
  source_type?: string;
  relevance_score?: number;
  document_id?: number;
  chunk_id?: number;
}

export interface ChatRequest {
  query: string;
  project_id: number;
  document_ids?: number[];
  history?: unknown[];
  llm_model?: string;
  search_type?: SearchType;
}

export interface ChatResponse {
  answer: string;
  sources?: SourceItem[];
  context_used?: number;
  coverage?: {
    selected_docs_count?: number | null;
    used_docs_count?: number;
    used_doc_ids?: number[];
    missing_doc_ids?: number[] | null;
  };
  raw_l1?: unknown;
  level_intent?: "L1" | "L2" | "L3" | "L4";
  question_frames?: {
    primary_frame?: string;
    secondary_frame?: string | null;
  };
}

export interface QuerySpecSummary {
  id: number;
  project_id: number;
  source_file_name: string;
  created_at?: string;
  schema_valid: boolean;
  runnable: boolean;
  validation_report_path?: string;
  summary?: Record<string, unknown>;
  validation_summary?: Record<string, unknown>;
  validation_errors?: string[];
}

export interface AgentRunSummary {
  id: number;
  run_name?: string | null;
  status: RunStatus;
  created_at?: string;
  updated_at?: string;
  duration_seconds?: number | null;
  document_count?: number;
  llm_model?: string | null;
  cell_count?: number;
  successful_cell_count?: number;
  failed_cell_count?: number;
  token_input_count?: number;
  token_output_count?: number;
  total_llm_calls?: number;
  total_latency_ms?: number;
  estimated_cost_usd?: number;
  has_output?: boolean;
}
```

---

# 10. Quick Endpoint Checklist

| Done? | Method | Endpoint | Feature |
|---|---|---|---|
| ☐ | GET | `/health` | Backend status |
| ☐ | GET | `/projects` | Project list |
| ☐ | POST | `/projects` | Create project |
| ☐ | PUT/PATCH | `/projects/{project_id}` | Edit project |
| ☐ | DELETE | `/projects/{project_id}` | Delete project |
| ☐ | POST | `/upload?project_id={project_id}` | Upload document |
| ☐ | GET | `/ingestion/jobs/{job_id}` | Ingestion status |
| ☐ | GET | `/documents?project_id={project_id}` | List documents |
| ☐ | DELETE | `/documents` | Delete selected/all documents |
| ☐ | POST | `/chat` | Ask Your Doc answer generation |
| ☐ | GET | `/projects/{project_id}/chat-sessions` | List saved chats |
| ☐ | POST | `/projects/{project_id}/chat-sessions` | Create saved chat |
| ☐ | GET | `/chat-sessions/{chat_session_id}/messages` | Load saved messages |
| ☐ | POST | `/chat-sessions/{chat_session_id}/messages` | Save message |
| ☐ | PATCH | `/chat-sessions/{chat_session_id}` | Rename chat |
| ☐ | DELETE | `/chat-sessions/{chat_session_id}` | Delete chat |
| ☐ | POST | `/agent/query-spec/{project_id}` | Upload/validate execution sheet |
| ☐ | GET | `/agent/query-spec/{project_id}` | List execution sheets |
| ☐ | GET | `/agent/query-spec/{project_id}/latest` | Latest execution sheet |
| ☐ | GET | `/agent/query-spec/{project_id}/{spec_id}/report` | Download validation report |
| ☐ | DELETE | `/agent/query-spec/{project_id}/{spec_id}` | Delete execution sheet |
| ☐ | POST | `/agent/start` | Start Agent Matrix run |
| ☐ | POST | `/agent/stop/{agent_run_id}` | Stop run |
| ☐ | GET | `/agent/progress/{agent_run_id}` | Poll progress |
| ☐ | GET | `/agent/runs?project_id={project_id}` | Run history |
| ☐ | GET | `/agent/run/{agent_run_id}?project_id={project_id}` | Run details/matrix |
| ☐ | GET | `/agent/download/{agent_run_id}/excel?project_id={project_id}` | Download output Excel |
