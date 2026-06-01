# SpecAudit — Change Log

## Commit History

### `ec0dfdd` — chore: add blueprint and gitignore
- `.gitignore` — ignores `bin/`, `obj/`, `node_modules/`, `.env`, `.env.local`, `*.user.json`
- `SpecAudit_Implementation_Blueprint.md` — the full 10-step architectural contract

### `66cca18` — Step 1: Initialize monorepo structure
- `backend/backend.csproj` — .NET 10 `web` project with `OpenAI` and `Microsoft.Extensions.AI.OpenAI` NuGet
- `backend/Properties/launchSettings.json` — debug launch profile
- `frontend/` — Vite React-TS scaffold, Tailwind CSS v4 (`@tailwindcss/vite` plugin, `@import "tailwindcss"` in CSS)
- `frontend/package.json` — includes `react-markdown` and `remark-gfm`
- `frontend/.gitignore` — Vite defaults
- `frontend/public/` — Vite favicon and icons
- `frontend/src/App.css`, `frontend/src/index.css`, `frontend/src/main.tsx` — Vite entry point
- `frontend/eslint.config.js`, `frontend/tsconfig*.json` — lint/type config
- `opencode.json` — OpenCode agent configuration
- `.opencode/agents/reviewer.md` — architectural reviewer agent prompt
- `.opencode/agents/tester.md` — QA tester agent prompt
- `docker-compose.yml` — dev services (backend:5000, frontend:5173) with volume mounts for hot reload

### `9a38b32` — Step 2: Backend configuration layer and DTOs
- `backend/src/Configuration/AiOptions.cs` — `AiOptions` sealed record: `ApiKey`, `BaseUrl`, `ModelId`, `ProviderName`, `MaxTokens`, `MaxInputLength`
- `backend/src/Models/Requests/AuditRequest.cs` — `AuditRequest` record with `Spec` and optional `SpecFormat`
- `backend/src/Models/Responses/AuditResponse.cs` — `AuditResponse` record with `Content`
- `backend/appsettings.json` — defaults: Groq provider, `BaseUrl`, `ModelId`, `MaxTokens=4096`, `MaxInputLength=100000`; **no API key**
- `backend/appsettings.Development.json` — empty `{}`

### `f407735` — Step 3: Backend service stub, endpoints, and Program wiring
- `backend/src/Services/SpecAuditService.cs` — constructor receives `IOptions<AiOptions>`, exposes `MaxInputLength`, stub `AuditAsync` yields `"test chunk"`
- `backend/src/Endpoints/AuditEndpoints.cs` — `POST /api/audit` with SSE streaming, 413 check via `MaxInputLength`, 400 on empty spec, error sentinel `[SPECAUDIT_ERROR]`, `GET /api/config` returning provider name
- `backend/Program.cs` — composition root: DI registration, CORS for `localhost:5173`, startup guard for `BaseUrl`/`ModelId`, `http://+:5000`

### `3ac5277` — Step 4: Backend AI streaming implementation
- `backend/src/Services/SpecAuditService.cs` — real `AuditAsync` using `CompleteChatStreamingAsync`, `SystemChatMessage`/`UserChatMessage`, `ChatCompletionOptions` with `Temperature=0.1f`
- System prompt stored as `private const string` (C# raw string literal)
- `BuildUserMessage` is `internal static` — embeds spec content with format hint

### `7f63a5d` — Step 5: Frontend data layer
- `frontend/src/types/audit.ts` — `AuditRequest`, `AuditStatus`, `AuditState`, `SeverityLevel` types
- `frontend/src/api/auditClient.ts` — `auditStream()`: SSE fetch with `parseSSEChunks` buffer, `JSON.parse` per chunk, `[SPECAUDIT_ERROR]` sentinel detection
- `frontend/src/hooks/useAudit.ts` — `useAudit` hook with `audit()`, `abort()`, `reset()`; `AbortController` for mid-stream cancellation
- `frontend/src/utils/parseSSEChunks.ts` — pure function, splits SSE stream into `data:` lines, holds partial lines in buffer
- `frontend/src/utils/parseSeverity.ts` — pure function, detects `[CRITICAL]`/`[WARNING]`/`[INFO]` in headings
- `frontend/vite.config.ts` — Vite proxy `/api` → `http://localhost:5000`

### `81b9d2a` — Step 6: Frontend UI primitives
- `frontend/src/components/ui/Button.tsx` — `primary` (indigo), `danger` (red), `ghost` (border) variants; `disabled` state with reduced opacity
- `frontend/src/components/ui/Spinner.tsx` — animated SVG `animate-spin`, `sm`/`md` sizes
- `frontend/src/components/ui/Card.tsx` — slate-themed `div` wrapper with `className` override

### `6547be3` — Step 7: Frontend feature components
- `frontend/src/components/features/InputPanel.tsx` — textarea (300px min, monospace, char counter with color thresholds at 80k/100k), YAML/JSON format toggle, Run/Stop buttons
- `frontend/src/components/features/ResultPanel.tsx` — `react-markdown` with `remark-gfm`, `SEVERITY_STYLES` map (red/amber/blue borders + badges per severity), loading skeleton, blinking cursor; React 19 typing via `ComponentPropsWithoutRef` + `ExtraProps`

### `4158afd` — Step 9: Hardening, polish, and README
- `backend/src/Endpoints/AuditEndpoints.cs` — HTTP 429 rate-limit detection, input trimming on `request.Spec`
- `frontend/src/components/features/ResultPanel.tsx` — loading skeleton (3 pulsing divs)
- All `console.log` calls removed from frontend
- `README.md` — project description, tech stack table, setup steps, provider swap table, screenshot placeholder

### `336290b` — Step 10: Unit tests
- `backend.Tests/backend.Tests.csproj` — xunit + FluentAssertions + WebApplicationFactory
- `backend.Tests/UserMessageBuilderTests.cs` — 3 tests: format hint embedding, null fallback, spec-after-format ordering
- `backend.Tests/EndpointValidationTests.cs` — 3 tests: empty/whitespace/oversized specs return 400/413
- `backend.Tests/AiOptionsValidationTests.cs` — 2 tests: missing `BaseUrl`/`ModelId` throw at startup
- `backend/backend.csproj` — added `InternalsVisibleTo` for test access
- `backend/Program.cs` — added `public partial class Program` for `WebApplicationFactory`
- `frontend/package.json` — added `"test": "vitest run"` script
- `frontend/src/utils/__tests__/parseSSEChunks.test.ts` — 6 tests: single/partial/split/multi-line/non-data/empty input
- `frontend/src/utils/__tests__/parseSeverity.test.ts` — 6 tests: CATICAL/WARNING/INFO/null/multiple/empty

### `fea3520` — feat: finalize App.tsx layout and provider badge
- `frontend/src/App.tsx` — full layout: header with app name + provider badge from `/api/config`, two-column grid (lg), Error card, Spinner during loading
- `frontend/src/App.css` — empty (Tailwind handles all styling)
- `frontend/vite.config.ts` — tailwindcss plugin

### `5a2e250` — ci: add GitHub Actions workflow and README badge
- `.github/workflows/ci.yml` — **CI pipeline**: backend job (restore → build → test) + frontend job (npm ci → build → test), on push/PR to main
- `README.md` — added CI badge
- `SpecAudit.slnx` — solution file grouping `backend/` and `backend.Tests/`
- `docs/.gitkeep` — tracks `docs/` directory for screenshot
- `frontend/vite.config.ts` — switched to `import { defineConfig } from 'vitest/config'` for type correctness

### `d55b789` — docs: add application screenshot
- `docs/screenshot.png` — browser screenshot of the running app

### `11eea5d` — ci: add slnx solution file and fix CI test build
- `.github/workflows/ci.yml` — backend job uses `SpecAudit.slnx` for restore/build/test so both `backend` and `backend.Tests` are built together

### `926ce42` — ci: bump actions to latest versions, pin Node 22
- `.github/workflows/ci.yml` — `actions/checkout@v6`, `actions/setup-node@v6`, Node 22 pinned

### `b812747` — docker: add production Dockerfiles and nginx config
- `backend/Dockerfile` — multi-stage .NET 10 build → runtime
- `frontend/Dockerfile` — multi-stage Node 22 build → nginx:alpine
- `frontend/nginx.conf` — nginx proxy for `/api` with SSE-safe `proxy_buffering off`
- `docker-compose.yml` — production-style, volumes removed, `Ai__ApiKey=${AI_API_KEY}`, `restart: unless-stopped`

### `fc9f274` — docker: combine into single service for Railway
- `Dockerfile` (root) — single multi-stage: Node 22 builds frontend → .NET 10 SDK builds backend → ASP.NET 10 runtime serves both (frontend in `./wwwroot`)
- `backend/Program.cs` — `UseDefaultFiles()`, `UseStaticFiles()`, `MapFallbackToFile("index.html")`
- `docker-compose.yml` — single `app` service, root Dockerfile, port 5000
- **Deleted:** `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`

### `0731b96` — docs: add deployment info, harden CORS, add dockerignore
- `backend/.dockerignore` — excludes `bin/`, `obj/`, `*.user.json`, `logs.txt`, `err.txt`
- `frontend/.dockerignore` — excludes `node_modules/`, `dist/`, logs
- `backend/Program.cs` — CORS conditional on `IsDevelopment()` (same-origin in production, no CORS needed)
- `README.md` — live demo link, Railway/Docker Compose deployment section

---

## Tester Focus Areas

### Critical paths
| Area | What to test | Risk if broken |
|------|-------------|----------------|
| **SSE streaming** | POST to `/api/audit` with a real OpenAPI spec — verify progressive chunks arrive | Silent data loss |
| **Error sentinel** | Force an error (e.g., invalid API key) — verify `[SPECAUDIT_ERROR]` shows in UI | Generic "network error" instead of typed message |
| **413 rejection** | Send spec > 100,000 chars — verify HTTP 413 | AI client receives oversized payload, cryptic failure |
| **Severity styling** | Findings render with correct border/badge colors (red/amber/blue) | Badges silently disappear |
| **Format toggle** | Toggle YAML/JSON, send spec — verify format hint embeds correctly | AI receives wrong format hint, degraded audit |

### Regression checks
| Area | What to test |
|------|-------------|
| **Docker build** | `docker-compose build` — zero errors |
| **CI pipeline** | Push to main — GitHub Actions passes both backend + frontend jobs |
| **Unit tests** | `dotnet test SpecAudit.slnx` (8 pass), `npm run test` (12 pass) |
| **Static files** | Access root URL in production — index.html loads, not a 404 |
| **CORS** | Dev mode: API calls from `localhost:5173` work. Production: same-origin works |
| **API key** | Not stored in any tracked file — only Railway env var + `dotnet user-secrets` |
