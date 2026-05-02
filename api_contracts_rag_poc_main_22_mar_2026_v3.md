# API Contracts extracted from `rag-poc-main_22_march_2026_v3.zip`

This document is derived only from the uploaded codebase.

Scope rules used:
- Included: implemented Flask HTTP routes only.
- Excluded: commented-out routes and non-HTTP helper functions.
- Blueprint routes are shown with their mounted prefix: `/agent`.
- When a route returns raw DB rows via `jsonify(...)` without explicit formatting, this document does **not** guess an exact timestamp serialization format.

## Route inventory

Implemented route functions found:
- `app.py`: `health`, `list_projects`, `create_project`, `update_project`, `delete_project`, `upload_document`, `list_documents`, `get_ingestion_job`, `delete_documents`, `chat_endpoint`
- `agent/agent_routes.py`: `start_agent_endpoint`, `stop_agent_run_endpoint`, `list_agent_runs`, `agent_progress`, `get_agent_run_details`, `download_agent_excel`, `upload_query_spec`, `list_query_specs`, `get_latest_query_spec`, `delete_query_spec`

That yields **16 implemented route functions** and **20 method/path combinations**.

---

## Shared patterns actually present in code

### Common error envelope
Most endpoints return:
```json
{ "error": "<message>" }
```

Known exceptions:
- `POST /agent/start` may also return `{"error": "Some document_ids do not belong to this project", "invalid_ids": [...]}`.
- `POST /chat` / `GET /chat` in some non-error branches return success payloads with different shapes depending on routing path.

### Timestamp formatting
Three patterns exist in the codebase:
1. **Explicit ISO strings**: e.g. `/ingestion/jobs/<id>`, `/agent/runs`, `/agent/progress`
2. **Raw DB datetime returned through `jsonify`**: e.g. `/projects`, `/documents`, `/agent/run/<id>`, query-spec list/latest
3. **File download responses**: binary payloads for `/agent/download/<id>/excel`

Because the code does not normalize timestamps consistently, this document only marks explicit ISO conversion where it is actually coded.

---

# 1) Core app routes (`app.py`)

## 1.1 GET `/`
## 1.2 GET `/health`
Source: `app.py:1367-1371`

Aliases of the same handler.

### Request
- No body
- No params

### Success response
HTTP `200`
```json
{ "status": "Backend is running and ready" }
```

### Errors
- None coded in this handler

---

## 1.3 GET `/projects`
Source: `app.py:1377-1386`, `db/db.py:82-97`

### Request
- No body
- No params

### Success response
HTTP `200`

Returns an array of project objects from `database.list_projects()`.
Each object contains these fields selected in SQL:
- `id`
- `name`
- `description`
- `created_at`

Schema:
```json
[
  {
    "id": 1,
    "name": "...",
    "description": "...",
    "created_at": "<datetime serialized by Flask>"
  }
]
```

### Errors
HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 1.4 POST `/projects`
Source: `app.py:1389-1414`, `db/db.py:63-80`

### Accepted input modes
The handler supports **two** input styles:

#### A. JSON body (preferred by code comment)
```json
{
  "name": "...",
  "description": "..."
}
```

#### B. Query parameters
- `name`
- `description`

### Validation
- `name` is required after `.strip()`
- `description` is optional

### Success response
HTTP `201`

Returns the inserted row from SQL `RETURNING id, name, description, created_at`:
```json
{
  "id": 1,
  "name": "...",
  "description": "...",
  "created_at": "<datetime serialized by Flask>"
}
```

### Errors
HTTP `400`
```json
{ "error": "Project name is required" }
```
or
```json
{ "error": "<exception text>" }
```

---

## 1.5 PUT `/projects/<project_id>`
## 1.6 PATCH `/projects/<project_id>`
Source: `app.py:1417-1460`, `db/db.py:99-147`

Both methods use the same handler.

### Path params
- `project_id` (integer path converter)

### Request body
JSON only:
```json
{
  "name": "...",         
  "description": "..."
}
```
Both fields are optional individually.

### Validation
- Project must exist, otherwise `404`
- Request must be JSON, otherwise `400`
- If `name` is present, it is stripped and cannot become empty
- If neither `name` nor `description` is supplied, the DB layer returns the current project row unchanged

### Success response
HTTP `200`

Returns updated project row:
```json
{
  "id": 1,
  "name": "...",
  "description": "...",
  "created_at": "<datetime serialized by Flask>"
}
```

### Errors
HTTP `404`
```json
{ "error": "Invalid project_id" }
```

HTTP `400`
```json
{ "error": "JSON body required" }
```
or
```json
{ "error": "Project name cannot be empty" }
```

HTTP `500`
```json
{ "error": "Update failed" }
```
or
```json
{ "error": "<exception text>" }
```

---

## 1.7 DELETE `/projects/<project_id>`
Source: `app.py:1463-1510`, `db/db.py:99-163`, `db/db.py:541-562`

Deletes the project row and first deletes all project documents to collect file paths for best-effort disk cleanup.

### Path params
- `project_id`

### Success response
HTTP `200`
```json
{
  "deleted": true,
  "project_id": 123,
  "documents_deleted": 5
}
```

### Errors
HTTP `404`
```json
{ "error": "Invalid project_id" }
```
or
```json
{ "error": "Project not found or already deleted" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 1.8 POST `/upload`
Source: `app.py:1516-1597`, `db/db.py:165-192`, `db/db.py:673-690`

Uploads one file and immediately enqueues async ingestion.

### Content type
`multipart/form-data`

### Accepted inputs
- File part: `file` (required)
- `project_id` can be provided either:
  - as query param, or
  - as form field

### Validation
- `project_id` required
- `project_id` must parse as integer
- project must exist
- `file` part must exist
- `file.filename` cannot be empty
- No file-type restriction is enforced in this route

### Server-side behavior that affects contract
- File is saved to `uploads/<project_id>/<filename>`
- A document row is inserted
- An ingestion job row is created with status `queued`
- Celery task `ingest_document.delay(...)` is called

### Success response
HTTP `200`
```json
{
  "status": "queued",
  "job_id": 10,
  "document_id": 99,
  "file_name": "example.pdf"
}
```

### Errors
HTTP `400`
```json
{ "error": "project_id is required" }
```
```json
{ "error": "project_id must be an integer" }
```
```json
{ "error": "No file part in the request" }
```
```json
{ "error": "Empty filename" }
```

HTTP `404`
```json
{ "error": "Invalid project_id" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 1.9 GET `/documents`
Source: `app.py:1601-1620`, `db/db.py:221-263`

### Query params
- `project_id` (required, integer)

### Validation
- `project_id` required
- project must exist

### Success response
HTTP `200`

Returns document rows from `database.get_documents(project_id=...)`.
Each item contains these DB-selected fields:
- `id`
- `file_name`
- `original_file_name`
- `file_size`
- `file_type`
- `checksum`
- `file_path`
- `processing_status`
- `project_id`
- `created_at`
- `updated_at`

Schema:
```json
[
  {
    "id": 99,
    "file_name": "stored-name.ext",
    "original_file_name": "original-name.ext",
    "file_size": 12345,
    "file_type": "application/pdf",
    "checksum": "...",
    "file_path": "uploads/1/example.pdf",
    "processing_status": "pending",
    "project_id": 1,
    "created_at": "<datetime serialized by Flask>",
    "updated_at": "<datetime serialized by Flask>"
  }
]
```

### Errors
HTTP `400`
```json
{ "error": "project_id is required" }
```

HTTP `404`
```json
{ "error": "Invalid project_id" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 1.10 GET `/ingestion/jobs/<job_id>`
Source: `app.py:1622-1631`, `db/db.py:728-752`

### Path params
- `job_id`

### Success response
HTTP `200`

This route returns the explicit dict built in `get_ingestion_job()`:
```json
{
  "job_id": 10,
  "document_id": 99,
  "status": "queued",
  "message": "Queued for ingestion",
  "progress_current": 0,
  "progress_total": 0,
  "created_at": "<isoformat or null>",
  "updated_at": "<isoformat or null>"
}
```

### Errors
HTTP `404`
```json
{ "error": "Job not found" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 1.11 DELETE `/documents`
Source: `app.py:1634-1701`, `db/db.py:541-596`

Supports two deletion modes.

### Mode A: delete specific documents
JSON body:
```json
{
  "document_ids": [1, 2, 3],
  "project_id": 123
}
```
`project_id` is optional in this mode and is not used to validate ownership of `document_ids`.

### Mode B: delete all documents under one project
Either:
- query param `project_id=123`, or
- JSON body `{ "project_id": 123 }`

### Validation
- If body includes `project_id`, it must parse as integer
- If `document_ids` is present, it must be a list and every member must parse as integer
- If `document_ids` is absent/empty, `project_id` becomes required

### Success response
HTTP `200`
```json
{ "deleted": 3 }
```
`deleted` is the count of DB rows deleted.

### Errors
HTTP `400`
```json
{ "error": "project_id must be an integer" }
```
```json
{ "error": "document_ids must be a list of integers" }
```
```json
{ "error": "project_id is required if document_ids are not provided" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 1.12 GET `/chat`
## 1.13 POST `/chat`
Source: `app.py:1708-2413`, `agent/research_agent.py:2550-2567`, `agent/research_agent.py:2195-2264`, `agent/research_agent.py:2270-2297`

This is the most polymorphic API in the codebase. The contract depends on:
- input transport (GET query params vs POST JSON)
- `search_type` (`factual`, `behavioural`, `deep research`)
- whether retrieval returned any contexts

### Accepted inputs

#### POST JSON
```json
{
  "query": "...",
  "project_id": 1,
  "document_ids": [10, 11],
  "history": [{"role": "user", "content": "..."}],
  "llm_model": "...",
  "search_type": "behavioural"
}
```

#### GET query params
- `query` (required)
- `project_id` (required)
- `document_ids` as comma-separated string, for example `10,11`
- `llm_model` (optional)
- `search_type` (optional; default `behavioural`)

### Input normalization and validation
- `query` is required
- `project_id` is required and must be integer
- `document_ids` accepted as:
  - POST: list of integers / coercible integers
  - GET: comma-separated string of integers
- `search_type` is lowercased and must be one of:
  - `factual`
  - `behavioural`
  - `deep research`
- Project must exist
- `history` is accepted but is **not used** in the normal factual/behavioural path because both LLM calls pass `history=None`
- In deep research mode, `history` is carried into the deep-research request object, but the deep-research validator only records that history was provided; it is not used to generate the answer

### Important routing rule
If `search_type == "deep research"`, the route bypasses the normal retrieval/answer flow and returns the payload from `run_deep_research(...)` directly.

---

### 1.13.A `/chat` success contract for normal `factual` or `behavioural` path with retrieved context
HTTP `200`

Returned object:
```json
{
  "answer": "<final answer text>",
  "raw_l1": {
    "direct_answer": "...",
    "key_observations": ["..."],
    "evidence": ["..."]
  },
  "level_intent": "L1|L2|L3|L4",
  "context_used": 0,
  "sources": [
    {
      "document": "...",
      "page": 1,
      "snippet": "...",
      "snippet_lines": ["..."],
      "snippet_html": "...",
      "summary": "...",
      "full_chunk_text": "...",
      "source_type": "chunk_context",
      "relevance_score": 0.73,
      "document_id": 10,
      "chunk_id": 1234
    }
  ],
  "coverage": {
    "selected_docs_count": 2,
    "used_docs_count": 1,
    "used_doc_ids": [10],
    "missing_doc_ids": [11]
  }
}
```

#### Notes tied to code
- `level_intent` is derived from the first model call and normalized to one of `L1`, `L2`, `L3`, `L4`
- `raw_l1` is guaranteed to be a dict; missing keys are filled with:
  - `direct_answer: "Not observed in this excerpt."`
  - `key_observations: []`
  - `evidence: []`
- `context_used` equals `len(contexts)`
- `coverage.selected_docs_count` is `null` when no explicit `document_ids` were supplied
- `sources` are chunk-level audit records, not just quoted evidence

---

### 1.13.B `/chat` success contract for normal path when retrieval returns no contexts
HTTP `200`

Returned object is **not identical** to the normal success object:
```json
{
  "answer": "I don’t have enough information in the retrieved excerpts to answer that.",
  "raw_l1": null,
  "intent": "lookup",
  "context_used": 0,
  "sources": [],
  "coverage": {
    "selected_docs_count": 2,
    "used_docs_count": 0,
    "used_doc_ids": [],
    "missing_doc_ids": [10, 11]
  }
}
```

#### Code-truth note
This branch returns `intent`, not `level_intent`. That inconsistency is present in the code.

---

### 1.13.C `/chat` success contract for `search_type = "deep research"`
HTTP `200`

The route returns whatever `DeepResearchAgent.run()` returns.

#### Completed deep-research payload
```json
{
  "answer": "<final answer text>",
  "raw_l1": null,
  "level_intent": "DEEP_RESEARCH",
  "search_type": "deep research",
  "context_used": 6,
  "sources": [
    {
      "document": "...",
      "page": 1,
      "snippet": "...",
      "summary": "...",
      "relevance_score": 0.88,
      "document_id": 10,
      "chunk_id": 1234
    }
  ],
  "coverage": {
    "selected_docs_count": 1,
    "used_docs_count": 1,
    "used_doc_ids": [10],
    "missing_doc_ids": []
  },
  "debug_trace": {
    "run_id": "...",
    "started_at_utc": "...",
    "finished_at_utc": "...",
    "request_summary": {"...": "..."},
    "settings": {"...": "..."},
    "planner": {"initial_sub_questions": [], "iteration_notes": []},
    "retrieval": {"iterations": []},
    "final_answer": {
      "status": "completed",
      "model_used": "...",
      "context_chunk_count": 6,
      "used_chunk_ids": [1234],
      "prompt_preview": "...",
      "raw_output_preview": "...",
      "evidence_profile": {},
      "enforced_guardrails": []
    },
    "final_evidence_pack": [],
    "stop_reason": "...",
    "status": "completed",
    "error": null
  },
  "debug_trace_run_id": "...",
  "debug_trace_file": ".../agent_outputs/...json",
  "stop_reason": "...",
  "error": null,
  "deep_research_status": "completed"
}
```

#### Failure-shaped deep-research payload
Still returned with HTTP `200` because deep research catches internal exceptions and returns a failure payload:
```json
{
  "answer": "Deep research failed during testing. Please inspect the debug trace for details.",
  "raw_l1": null,
  "level_intent": "DEEP_RESEARCH",
  "search_type": "deep research",
  "context_used": 0,
  "sources": [],
  "coverage": {
    "selected_docs_count": 0,
    "used_docs_count": 0,
    "used_doc_ids": [],
    "missing_doc_ids": []
  },
  "debug_trace": { "...": "..." },
  "debug_trace_run_id": "...",
  "debug_trace_file": "...",
  "stop_reason": "Deep research failed before completion.",
  "error": "ValueError: ...",
  "deep_research_status": "failed"
}
```

#### Deep-research-specific validations implemented in code
Inside `DeepResearchAgent`:
- requires exactly one selected document
- selected document must exist
- selected document must belong to the provided project

But these failures become a **200 response with failure payload**, not an HTTP 4xx/5xx from `/chat`.

---

### `/chat` explicit 4xx/5xx errors from the route itself
HTTP `400`
```json
{ "error": "query is required" }
```
```json
{ "error": "project_id is required" }
```
```json
{ "error": "project_id must be an integer" }
```
```json
{ "error": "document_ids must be a comma-separated list of integers" }
```
```json
{ "error": "document_ids must contain only integers" }
```
```json
{ "error": "document_ids must be a list of integers or comma-separated string" }
```
```json
{ "error": "Invalid search_type. Allowed values are: factual, behavioural, deep research" }
```

HTTP `404`
```json
{ "error": "Invalid project_id" }
```

HTTP `500`
```json
{ "error": "Internal server error" }
```

---

# 2) Agent routes (`/agent/...` from `agent/agent_routes.py`)

## 2.1 POST `/agent/start`
Source: `agent/agent_routes.py:28-127`, `agent/agent_service.py:1109-1207`

Starts an agent run and returns immediately.

### Request body
JSON:
```json
{
  "project_id": 123,
  "document_ids": [1, 2, 3],
  "generate_subquestions": true,
  "manual_subquestions": "line1\nline2\n...",
  "max_verbatims": 5,
  "run_name": "optional",
  "llm_model": "optional",
  "retrieval_mode": "global"
}
```

### Input behavior and validation
- `project_id` required and must be integer
- `document_ids`, if provided, must be a list whose elements coerce to integers
- If `document_ids` is provided, all IDs are checked against the project’s document list
- `max_verbatims` is coerced to int; on parse failure it falls back to `5`
- `run_name` is stripped; empty becomes `null`
- `llm_model` is stripped; empty becomes `null`
- `retrieval_mode` is lowercased; invalid values silently fall back to `global`
- If `generate_subquestions` is `false` and `manual_subquestions` has non-empty lines, those lines become the manual plan override

### Success response
HTTP `202`
```json
{
  "agent_run_id": 77,
  "status": "started"
}
```

### Errors
HTTP `400`
```json
{ "error": "project_id is required" }
```
```json
{ "error": "project_id must be an integer" }
```
```json
{ "error": "document_ids must be a list of integers" }
```
```json
{
  "error": "Some document_ids do not belong to this project",
  "invalid_ids": [99]
}
```

HTTP `404`
```json
{ "error": "Project id=123 not found" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

Code-backed note:
- If the project exists but there are no resolved documents for the run, `start_agent_run()` raises `ValueError("No documents found for this project (or selected document_ids).")`, and the endpoint surfaces that as HTTP `500` because it only has a generic exception handler.

---

## 2.2 POST `/agent/stop/<agent_run_id>`
Source: `agent/agent_routes.py:132-159`

Soft-cancels a run by setting status to `cancelled` if current status is one of `pending | planned | running`.

### Path params
- `agent_run_id`

### Success response
If cancellable:
HTTP `200`
```json
{
  "agent_run_id": 77,
  "status": "cancelled"
}
```

If already not cancellable:
HTTP `200`
```json
{
  "agent_run_id": 77,
  "status": "completed"
}
```
(or whatever current status already is)

### Errors
HTTP `404`
```json
{ "error": "agent_run_id=77 not found" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 2.3 GET `/agent/runs`
Source: `agent/agent_routes.py:161-265`, schema `db/schema.sql:102-139`

Lists past runs for a project.

### Query params
- `project_id` (required)
- `q` (optional substring search on `run_name` or stringified `id`)
- `status` (optional exact lowercased filter)
- `limit` (optional, default `50`, clamped to `1..200`)

### Validation
- `project_id` is required
- `status` is not enum-validated; it is used as a lowercased equality filter if supplied

### Success response
HTTP `200`
```json
{
  "runs": [
    {
      "id": 77,
      "run_name": "...",
      "status": "running",
      "created_at": "<isoformat or null>",
      "updated_at": "<isoformat or null>",
      "duration_seconds": 42,
      "document_count": 3,
      "retrieval_mode": "global",
      "has_output": true
    }
  ]
}
```

### Response derivation notes
- `retrieval_mode` is derived from `agent_runs.config.retrieval_mode`, defaulting to `global`
- invalid stored values are normalized to `global`
- `document_count` uses `agent_runs.document_count`; if that is falsy and `document_ids_used` is a list, it falls back to the list length
- `has_output` checks whether `excel_path` or `csv_path` exists on disk at request time

### Errors
HTTP `400`
```json
{ "error": "project_id is required" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 2.4 GET `/agent/progress/<agent_run_id>`
Source: `agent/agent_routes.py:268-337`

Polling endpoint for run progress.

### Path params
- `agent_run_id`

### Success response
HTTP `200`
```json
{
  "agent_run_id": 77,
  "status": "running",
  "percent": 60,
  "done_cells": 12,
  "cell_count": 20,
  "logs": [
    {
      "log_time": "<isoformat or null>",
      "step": "...",
      "message": "..."
    }
  ]
}
```

### Calculation note
- `percent` is `0` when `cell_count` is falsy
- otherwise it is `int(done_cells / cell_count * 100)`
- `logs` are fetched newest-first then reversed before returning, so the response is chronological

### Errors
HTTP `404`
```json
{ "error": "agent_run not found" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 2.5 GET `/agent/run/<agent_run_id>`
Source: `agent/agent_routes.py:416-476`, schema `db/schema.sql:102-181`

Returns normalized matrix data for one run.

### Path params
- `agent_run_id`

### Query params
- `project_id` (required)

### Validation
- `project_id` required
- run must exist
- run’s `project_id` must equal supplied `project_id`

### Success response
HTTP `200`
```json
{
  "run": {
    "id": 77,
    "project_id": 123,
    "run_name": "...",
    "description_used": "...",
    "headers_used": [],
    "document_ids_used": [1, 2],
    "config": {},
    "status": "running",
    "created_at": "<raw DB datetime serialized by Flask>",
    "updated_at": "<raw DB datetime serialized by Flask>",
    "duration_seconds": 42,
    "subquestion_count": 10,
    "document_count": 2,
    "cell_count": 20,
    "token_input_count": 1000,
    "token_output_count": 500,
    "excel_path": "...",
    "csv_path": "..."
  },
  "rows": [
    {
      "id": 1,
      "header": "...",
      "sub_question": "...",
      "is_reflective": false,
      "row_index": 0
    }
  ],
  "cells": [
    {
      "agent_row_id": 1,
      "document_id": 10,
      "has_evidence": true,
      "evidence_strength": "strong",
      "verbatims": ["..."],
      "summary": "...",
      "inference": "..."
    }
  ]
}
```

### Code-truth notes
- `run` comes from `SELECT * FROM agent_runs` via `_get_agent_run`, so it includes the table columns shown above
- this route **does not include** `research_insight` even though that column exists in `agent_cells`
- `created_at` / `updated_at` in `run` are not explicitly isoformatted here

### Errors
HTTP `400`
```json
{ "error": "project_id is required" }
```

HTTP `404`
```json
{ "error": "agent_run not found" }
```

HTTP `403`
```json
{ "error": "Run does not belong to this project" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 2.6 GET `/agent/download/<agent_run_id>/excel`
Source: `agent/agent_routes.py:479-556`, `agent/excel_generator.py`

Downloads spreadsheet output for a run.

### Path params
- `agent_run_id`

### Query params
- `project_id` (required)

### Validation
- `project_id` required
- run must exist
- run must belong to supplied project

### Success response
Two possible binary responses:

#### A. Excel file
HTTP `200`
Content-Type:
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Filename:
- uses `run_name` if available
- otherwise `agent_matrix_run_<agent_run_id>.xlsx`
- invalid filename characters are sanitized

#### B. CSV file
HTTP `200`
Content-Type:
`text/csv`

Filename:
- `agent_matrix_run_<agent_run_id>.csv`

### Generation behavior
- If stored `excel_path` / `csv_path` exists in DB but file is missing on disk, the path is cleared locally
- If neither file exists, `generate_spreadsheet_for_run(agent_run_id)` is called on demand, and the new paths are persisted back to `agent_runs`

### Errors
HTTP `400`
```json
{ "error": "project_id is required" }
```

HTTP `404`
```json
{ "error": "agent_run not found" }
```
```json
{ "error": "No spreadsheet file found for this run" }
```

HTTP `403`
```json
{ "error": "Run does not belong to this project" }
```

HTTP `500`
```json
{ "error": "<exception text>" }
```

---

## 2.7 POST `/agent/query-spec/<project_id>`
Source: `agent/agent_routes.py:680-713`, `agent/agent_routes.py:647-677`, `db/db.py:597-621`

Stores a new query-spec version for a project.

### Path params
- `project_id`

### Request body
JSON:
```json
{
  "source_file_name": "file.xlsx",
  "column_mapping": {
    "concept": "Concept Column or null",
    "header": "Header Column",
    "subheader": "Subheader Column or null"
  },
  "rows": [
    { "Header Column": "Question A", "Concept Column": "Theme 1" }
  ]
}
```

### Internal normalization actually performed
- `header` mapping is required
- `concept` is optional; if present, concept values are carry-forwarded across blank rows
- `subheader` is optional
- rows with blank resolved header are dropped
- normalized row shape is:
```json
{ "concept": "...", "header": "...", "sub_header": "..." }
```

### Success response
HTTP `200`

Returns only the inserted spec metadata from DB `RETURNING`:
```json
{
  "status": "ok",
  "spec": {
    "id": 5,
    "project_id": 123,
    "source_file_name": "file.xlsx",
    "created_at": "<datetime serialized by Flask>"
  }
}
```

### Errors
HTTP `404`
```json
{ "error": "Project not found" }
```

HTTP `400`
```json
{ "error": "header column mapping is required" }
```
or
```json
{ "error": "<exception text>" }
```

---

## 2.8 GET `/agent/query-spec/<project_id>`
Source: `agent/agent_routes.py:716-728`, `db/db.py:623-636`

Lists stored query-spec versions for a project.

### Path params
- `project_id`

### Success response
HTTP `200`
```json
{
  "project_id": 123,
  "specs": [
    {
      "id": 5,
      "project_id": 123,
      "source_file_name": "file.xlsx",
      "created_at": "<datetime serialized by Flask>"
    }
  ]
}
```

### Errors
HTTP `404`
```json
{ "error": "Project not found" }
```

HTTP `400`
```json
{ "error": "<exception text>" }
```

---

## 2.9 GET `/agent/query-spec/<project_id>/latest`
Source: `agent/agent_routes.py:731-758`, `db/db.py:638-654`

Returns only a summary of the latest query-spec version.

### Path params
- `project_id`

### Success response when a spec exists
HTTP `200`
```json
{
  "project_id": 123,
  "spec": {
    "id": 5,
    "project_id": 123,
    "source_file_name": "file.xlsx",
    "created_at": "<datetime serialized by Flask>",
    "has_concept": true,
    "has_subheader": false,
    "rows_count": 27
  }
}
```

### Success response when no spec exists
HTTP `200`
```json
{
  "project_id": 123,
  "spec": null
}
```

### Errors
HTTP `404`
```json
{ "error": "Project not found" }
```

HTTP `400`
```json
{ "error": "<exception text>" }
```

---

## 2.10 DELETE `/agent/query-spec/<project_id>/<spec_id>`
Source: `agent/agent_routes.py:761-776`, `db/db.py:656-670`

Deletes one query-spec version.

### Path params
- `project_id`
- `spec_id`

### Success response
HTTP `200`
```json
{ "status": "ok" }
```

### Errors
HTTP `404`
```json
{ "error": "Project not found" }
```
or
```json
{ "error": "Spec not found" }
```

HTTP `400`
```json
{ "error": "<exception text>" }
```

---

# 3) Contract observations from the codebase

These are not assumptions; they are visible in the code and may matter if you want to standardize the API later.

1. `/chat` has **three success shapes**:
   - normal success with `level_intent`
   - no-context success with `intent`
   - deep-research success/failure payload with debug fields

2. Timestamp handling is inconsistent across endpoints:
   - some explicitly use `.isoformat()`
   - some return raw DB datetime objects through `jsonify`

3. `/chat` accepts `history` but the current code does not use it to generate the normal response.

4. `/chat` deep research returns HTTP `200` even for internal request-validation failures inside the deep-research engine; failure is indicated in payload fields like `error` and `deep_research_status`.

5. `DELETE /documents` in selected-document mode deletes by document IDs directly and does not validate that those IDs belong to the supplied `project_id`.

6. `GET /agent/run/<id>` returns raw `agent_runs` columns, while `GET /agent/runs` returns a curated summary shape.

7. `POST /agent/start` silently normalizes invalid `retrieval_mode` to `global` rather than rejecting it.

---

# 4) What was intentionally not included

Not treated as public HTTP API contracts:
- commented-out route implementations in `app.py`
- Celery task functions
- DB helper methods
- Streamlit frontend helper functions
- internal deep-research helper methods beyond the payloads they directly control
