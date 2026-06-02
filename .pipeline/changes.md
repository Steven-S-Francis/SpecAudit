# SpecAudit — Change Log

## Commit History

### `(working tree)` — feat: Copy to Clipboard button
- `frontend/src/components/ui/Button.tsx` — added optional `size` prop (`'sm' | 'md'`) with `sizeStyles` map; default `'md'` preserves existing `px-4 py-2 text-sm`; `'sm'` uses `px-2 py-1 text-xs`; class order moved to insert `sizeStyles` before `className` override
- `frontend/src/App.tsx` — added `copied` state, `handleCopy` callback using `navigator.clipboard.writeText(state.result)` with 2s reset timeout; Copy button rendered inside the Audit Results `<h2>` row (after Spinner) when `state.result` is truthy, disabled during streaming, shows "Copied!" feedback for 2s

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

### `032ea6a` — test: commit uncommitted tests, pipeline artifacts, and review fixes
- **New frontend tests (36):** `frontend/src/api/__tests__/auditClient.test.ts` (6), `frontend/src/components/features/__tests__/InputPanel.test.tsx` (15), `frontend/src/components/features/__tests__/ResultPanel.test.tsx` (8), `frontend/src/hooks/__tests__/useAudit.test.tsx` (7)
- **New backend tests (3):** `EndpointValidationTests.cs` — trimmed spec accepted, config returns provider name, config does not return API key
- **Test infrastructure:** `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` deps in `package.json`; `jsdom` env + `setupFiles` in `vite.config.ts`; `frontend/src/test-setup.ts`
- **Pipeline artifacts:** `.pipeline/test-results.md` (59/59 pass), `.pipeline/review.md`
- **Agent files:** `.opencode/agents/review.md`, `.opencode/agents/test.md`, `.opencode/opencode.json` (new); `opencode.json`, `reviewer.md`, `tester.md` (deleted)
- **Review fixes:**
  - `Button.tsx` — added `className` prop for conditional styling
  - `InputPanel.tsx` — format toggle now uses `<Button variant="ghost">` instead of plain `<button>`
  - `ResultPanel.tsx` — added typed signatures (`HrProps`, `StrongProps`) for React 19 compliance

### `e19dc51` — fix: correct pipeline path in review agent prompt (`./pipeline/` → `.pipeline/`)

### *(current commit)* — feat: rate-limit retry with exponential backoff

- **`frontend/src/api/auditClient.ts`** — In `[SPECAUDIT_ERROR]` detection block, distinguish rate-limit messages via `/rate limit/i` regex; set `err.name = 'RateLimitError'` for rate-limit sentinels, `'Error'` for others
- **`frontend/src/hooks/useAudit.ts`** — Added `retryCount` ref and `maxRetries = 3` constant; reset retry count at start of `audit()`; in catch block, detect `RateLimitError` and retry with exponential backoff (1s, 2s, 4s); reset retry count on `AbortError` and non-rate-limit errors

### *(previous)* — feat: add dark mode toggle (light theme)

- **New `frontend/src/hooks/useTheme.ts`** — `useTheme` hook: manages `dark`/`light` state, persists to `localStorage` under key `specaudit-theme`, toggles `.light` class on `<html>` element
- **New `frontend/src/components/ui/ThemeToggle.tsx`** — sun (circle + rays SVG) / moon (crescent SVG) button with `aria-label` for accessibility; uses `light:` variant classes for own styling
- **`frontend/src/index.css`** — added `@custom-variant light (&:where(.light, .light *));` after Tailwind import to enable Tailwind v4 light variant
- **`frontend/src/App.tsx`** — wired `useTheme` + `ThemeToggle` into header; added `light:` variant classes to outer container, h1, subtitle, provider badge, h2 heading, error card, and error text
- **`frontend/src/components/ui/Button.tsx`** — added `light:border-slate-300 light:hover:border-slate-400 light:text-slate-600` to ghost variant
- **`frontend/src/components/ui/Card.tsx`** — added `light:bg-white light:border-slate-200` to wrapper classes
- **`frontend/src/components/features/InputPanel.tsx`** — added `light:` variant classes to textarea (`bg-white`, `border-slate-300`, `text-slate-800`) and character counter (`text-slate-500`)
- **`frontend/src/components/features/ResultPanel.tsx`** — added `light:` variant classes to outer div, h3, code blocks (both block and inline), hr, strong, paragraph, skeleton placeholders, blinking cursor; added `light:bg-red-50`, `light:bg-amber-50`, `light:bg-blue-50` to severity wrappers and `light:text-red-600`, `light:text-amber-600`, `light:text-blue-600` to severity badges/labels (inline code gets `light:text-amber-700` per spec)
- **Pipeline verdict:** SHIP — all checks pass (11 backend tests pass, zero TS errors; frontend tests to be added in test stage)

### *(previous)* — feat: add Copy to Clipboard button
- **`frontend/src/components/ui/Button.tsx`** — added optional `size` prop (`'sm' | 'md'`, default `'md'`) with `sizeStyles` map
- **`frontend/src/App.tsx`** — added "Copy" `<Button variant="ghost" size="sm">` next to "Audit Results" heading; `copied` state + `handleCopy` via `navigator.clipboard.writeText()`; shows "Copied!" for 2 seconds; hidden when no result; disabled during streaming
- **Pre-existing bugfix:** Removed unused variables (`container` in 3 tests, `props` in 2 component overrides, `capturedAbort` in 1 test) that blocked `npm run build`
- **New tests (7):** `frontend/src/components/ui/__tests__/Button.test.tsx` (3), `frontend/src/components/features/__tests__/App.test.tsx` (4)
- **Pipeline verdict:** SHIP — all checks pass (55 frontend, 11 backend, zero TS errors)

### *(current commit)* — feat: add rate-limit retry with exponential backoff

- **`frontend/src/api/auditClient.ts`** — rate-limit `[SPECAUDIT_ERROR]` sentinels detected via `/rate limit/i` regex; thrown error has `name === 'RateLimitError'` (other errors keep `name === 'Error'`)
- **`frontend/src/hooks/useAudit.ts`** — added `retryCount` ref (`maxRetries = 3`); `audit()` now accepts optional `isRetry` parameter to prevent retry count reset on recursive calls; catch block detects `RateLimitError` and retries with exponential backoff (1s, 2s, 4s); non-rate-limit and exhausted retries show error state
- **Bug fix:** Added `!` non-null assertion on `abortRef.current!.signal` for TypeScript strict-null compliance when `isRetry === true` (skips `AbortController` creation)
- **New tests (4):** rate-limit sentinel throws `RateLimitError`; non-rate-limit sentinel throws `Error`; retry succeeds after backoff; retries exhaust after 3 attempts
- **Pipeline verdict:** SHIP — all checks pass (67 frontend, 11 backend, zero TS errors)

---

## Tester Focus Areas

### New: Dark Mode Toggle

| Area | What to test | Risk if broken |
|------|-------------|----------------|
| **Sun icon (dark mode)** | Page loads → sun icon (circle with rays SVG) visible in header | Wrong or missing icon |
| **Moon icon (light mode)** | Click sun → moon icon (crescent SVG) visible | Wrong or missing icon |
| **Theme switch** | Click toggle → page background switches `bg-slate-950` ↔ `bg-white` | Visual flash or broken styling |
| **localStorage persistence** | Toggle to light → refresh page → light theme persists | Theme resets to dark on reload |
| **html class** | Inspect `<html>` element — `.light` class present in light mode, absent in dark | CSS variant doesn't activate |
| **Severity badges in light mode** | CRITICAL/WARNING/INFO badges visible and readable on white background | White text on white bg (invisible) |
| **Error card in light mode** | Trigger an error → red-bordered card with visible text on white bg | Error message invisible |
| **Code blocks in light mode** | Audit results with code blocks → light background (`bg-slate-100`) with dark text | Unreadable code |
| **Skeleton in light mode** | Initial load (no content yet) → skeleton animation uses light gray (`bg-slate-200`) | Dark skeleton on white bg |

### New: Rate-Limit Retry with Exponential Backoff

| Area | What to test | Risk if broken |
|------|-------------|----------------|
| **Rate-limit retry** | Backend sends `[SPECAUDIT_ERROR] Rate limit reached...` → frontend retries silently after 1s → audit completes | Error shows immediately instead of retrying |
| **3 retries exhausted** | Backend sends rate-limit error 3 times → frontend retries 3 times (1s, 2s, 4s delays) → error card appears | Infinite retry loop or wrong number of retries |
| **Non-rate-limit error** | Backend sends `[SPECAUDIT_ERROR] Invalid API key...` → error shown immediately, no retry | Non-rate-limit errors also get retried |
| **Stop during retry delay** | User clicks Stop during the 1s/2s/4s backoff delay → audit aborts and resets to idle | In-flight retry continues after abort |
| **New submission during retry** | User submits new spec while retry is pending → old retry cancelled, fresh audit starts | Two audits run concurrently |

### New: Copy to Clipboard
| Area | What to test | Risk if broken |
|------|-------------|----------------|
| **Button visibility** | No "Copy" button before audit runs; appears after result returns | Button never shows (no clipboard access) |
| **Streaming guard** | Button is `disabled` during streaming; enabled once complete | User copies partial output |
| **Clipboard content** | Click Copy, paste into Notepad — full audit report appears | Wrong/incomplete content copied |
| **Copied feedback** | Button text changes to "Copied!" for 2 seconds then reverts | No visual confirmation of copy |
| **Error handling** | Clipboard API failure (e.g. insecure context) — silently ignored | Unhandled rejection / error in console |

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
| **Backend tests** | `dotnet test SpecAudit.slnx` — all 11 pass |
| **Frontend tests** | `npm run test -- --run` — all 63 pass (10 test files) |
| **TypeScript** | `npx tsc --noEmit` — zero errors |
| **Static files** | Access root URL in production — index.html loads, not a 404 |
| **CORS** | Dev mode: API calls from `localhost:5173` work. Production: same-origin works |
| **API key** | Not stored in any tracked file — only Railway env var + `dotnet user-secrets` |
