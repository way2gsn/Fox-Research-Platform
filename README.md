# RAG Research Platform — Next.js Frontend

A production-grade frontend for the RAG backend API, built with Next.js 14 + TypeScript + Tailwind CSS.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript** — fully typed API client
- **Tailwind CSS** — utility-first styling
- **Lucide React** — icons

## Features

| Section | What it does |
|---|---|
| **Projects** | Create, edit, delete projects; card grid with stats |
| **Documents** | Drag-and-drop upload; auto-polls ingestion status; bulk delete |
| **Chat** | Factual / Behavioural / Deep Research modes; source citations; document filtering |
| **Agent Runs** | Start runs; live progress bar polling; stop runs; download Excel |
| **Run Matrix** | Full matrix view with evidence strength indicators; click cell for verbatims + inference |

## Setup

### 1. Install dependencies

```bash
cd rag-frontend
npm install
```

### 2. Configure backend URL

The backend URL is set in `next.config.mjs` as a proxy rewrite:

```js
// next.config.mjs
destination: 'http://3.108.220.238:13000/:path*'
```

Change this to your backend URL if it moves.

All API calls in the frontend use `/api/...` which gets proxied to the backend automatically — **no CORS issues**.

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for production

```bash
npm run build
npm start
```

## Project Structure

```
rag-frontend/
├── app/
│   ├── layout.tsx                          # Root layout
│   ├── globals.css                         # Design system + global styles
│   ├── page.tsx                            # Projects homepage
│   └── projects/
│       └── [id]/
│           ├── page.tsx                    # Project detail (Docs / Chat / Agent tabs)
│           └── runs/
│               └── [runId]/
│                   └── page.tsx            # Agent run matrix detail
├── components/
│   ├── ui.tsx                              # Button, Modal, Badge, Toast, Input, etc.
│   ├── AppShell.tsx                        # Sidebar + breadcrumb layout
│   ├── DocumentsPanel.tsx                  # Document upload & management
│   ├── ChatPanel.tsx                       # Chat interface
│   └── AgentPanel.tsx                      # Agent runs management
├── lib/
│   └── api.ts                              # Typed client for all 20 API endpoints
├── next.config.mjs                         # Proxy config
├── tailwind.config.js
└── tsconfig.json
```

## API Endpoints Covered

All 20 endpoints from the backend are wired up:

**Core (`app.py`)**
- `GET /health`
- `GET /projects` — `POST /projects` — `PATCH /projects/:id` — `DELETE /projects/:id`
- `POST /upload` — `GET /documents` — `DELETE /documents`
- `GET /ingestion/jobs/:id`
- `GET /chat` — `POST /chat` (factual / behavioural / deep research)

**Agent (`agent_routes.py`)**
- `POST /agent/start` — `POST /agent/stop/:id`
- `GET /agent/runs` — `GET /agent/progress/:id`
- `GET /agent/run/:id` — `GET /agent/download/:id/excel`
- `POST /agent/query-spec/:pid` — `GET /agent/query-spec/:pid`
- `GET /agent/query-spec/:pid/latest` — `DELETE /agent/query-spec/:pid/:sid`

## Deployment (PM2 + Nginx example)

```bash
# Build
npm run build

# Start with PM2
pm2 start npm --name "rag-frontend" -- start
pm2 save

# Nginx config (port 3000 → 80)
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```
