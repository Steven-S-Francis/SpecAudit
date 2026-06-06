# SpecAudit

![CI](https://github.com/Steven-S-Francis/SpecAudit/actions/workflows/ci.yml/badge.svg)

> **Live demo:** [specaudit-production-18ee.up.railway.app](https://specaudit-production-18ee.up.railway.app)

SpecAudit is an AI-powered OpenAPI contract auditor that analyzes your API specification for security vulnerabilities, REST convention violations, schema issues, and naming inconsistencies. It streams structured audit reports with severity-tagged findings directly in your browser.

## Features

- **AI-powered audit** — Paste or upload any OpenAPI/Swagger/Kubernetes spec (YAML/JSON) and get a structured security + design audit with severity-tagged findings
- **Real-time streaming** — Results appear as the AI generates them, with severity-colored highlighting (CRITICAL / WARNING / INFO)
- **Spec file upload** — Drag-and-drop or file-picker for `.yaml`/`.yml`/`.json` files
- **Session history** — Auto-saved to localStorage with LRU eviction (4 MB); collapsible sidebar
- **Toast/snackbar notifications** — Non-blocking feedback for copy, export, errors
- **Configurable provider/model** — UI dropdown selects from Groq, Together, OpenAI (fetched from `GET /api/providers`)
- **Copy full report** — One-click clipboard copy
- **Copy individual finding** — Per-block copy icon
- **Multiple exports:**
  - **Download** — `.md` file
  - **Export PDF** — Formatted PDF via pdfmake with severity-colored tables
  - **Export JSON** — Structured JSON with typed `findings[]` and `summary` objects for programmatic consumption
- **Severity filter** — Toggle CRITICAL / WARNING / INFO visibility
- **Search within results** — Inline keyword search with highlight
- **Auto-scroll** — Scrolls to latest token during streaming
- **Expandable findings** — Collapse/expand groups by severity (CSS transition animation)
- **Dark / Light mode** — Toggle with persistent preference; respects `prefers-color-scheme`
- **Error handling** — Reads AI provider error response body on non-success (no longer uses `EnsureSuccessStatusCode`)
- **Rate-limit handling** — Shows error immediately (exponential backoff retry removed)
- **Sentry monitoring** — Error tracking on both frontend and backend (opt-in via DSN)
- **Keyboard shortcuts** — `Ctrl+Enter` to run audit, `Escape` to abort
- **Governance Score** — Visual scorecard with per-dimension breakdown

## Tech Stack

| Backend | Frontend | AI Integration |
|---|---|---|
| .NET 10 Minimal APIs | React 19 + Vite + Tailwind CSS v4 | OpenAI-compatible providers (Groq, Together, OpenAI) |
| SSE (Server-Sent Events) streaming | react-markdown with severity styling | Raw HttpClient + manual SSE parsing |

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 24+](https://nodejs.org/)
- An API key for one of the supported AI providers

## Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd spec-audit
   ```

2. **Configure the backend:**
   ```bash
   cd backend
   dotnet user-secrets set "Ai:ApiKey" "your-groq-key"
   ```
   > You can change the provider and model from the UI dropdown after starting the app.

3. **Start the backend:**
   ```bash
   dotnet run
   ```
   The API is available at `http://localhost:5000`.

4. **Start the frontend** (in a separate terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The UI is available at `http://localhost:5173`.

5. **Open `http://localhost:5173`** in your browser, paste an OpenAPI spec or upload a `.yaml`/`.json` file, and click **Run Audit**.

## Provider Configuration

Available providers are defined in `backend/appsettings.json` under `AiProviders.Providers`. The UI dropdown fetches `GET /api/providers` at startup — no `appsettings.json` editing needed to switch.

The `Ai:ApiKey` user-secret (or `Ai__ApiKey` env var) is shared across all providers. Currently configured:

| Provider | Default Model | Key prefix | Signup |
|----------|--------------|------------|--------|
| **Groq** | `llama-3.3-70b-versatile` | `gsk_` | [console.groq.com](https://console.groq.com) |
| **Together** | `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free` | `tog-` | [api.together.ai](https://api.together.ai) |
| **OpenAI** | `gpt-4o-mini` | `sk-` | [platform.openai.com](https://platform.openai.com) |

Run the following to set your API key (used by all providers):
```bash
cd backend
dotnet user-secrets set "Ai:ApiKey" "your-groq-key"
```

## Deployment

### Railway (one-click)

1. Push this repo to GitHub
2. [Create a new project](https://railway.app/new) → **Deploy from GitHub repo**
3. Select the repository — Railway auto-detects the root `Dockerfile`
4. Go to **Variables** and add:
   ```
   AI_API_KEY = your-groq-key
   ```
   > **Note:** Railway should also set `Ai__ApiKey` env var (double underscore for .NET) instead of `AI_API_KEY` if you're using the standard configuration.
5. Deploy completes automatically

### Docker Compose (any provider)

```bash
export AI_API_KEY=your-key-here
docker-compose up --build
```

## Running Tests

```bash
# Backend tests (~30 tests, requires .NET 10 SDK)
cd backend.Tests
dotnet test

# Frontend tests (~314 tests)
cd frontend
npm test
```

## Screenshot

![SpecAudit Screenshot](docs/screenshot.png)

## Monitoring

Sentry error tracking is available on both frontend and backend. It is **opt-in** — without a configured DSN, the Sentry SDK initializes in no-op mode.

| Layer | Env variable | Required? |
|-------|-------------|-----------|
| Backend | `Sentry:Dsn` or `Sentry__Dsn` | ❌ (no-op without it) |
| Frontend | `VITE_SENTRY_DSN` | ❌ (no-op without it) |
