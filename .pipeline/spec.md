# Spec: Update Three Documentation Files to Match Current Project State

**OPEN QUESTION 1 (frontend/README.md):** The frontend's `README.md` is still the default Vite/React template (73 lines of boilerplate). Two options:
- **Option A (Recommended):** Replace with a meaningful project-specific README describing the frontend's architecture, hooks, components, and setup notes.
- **Option B:** Delete it (root README already covers setup, and the file adds noise).
- Decision needed before implementation.

**OPEN QUESTION 2 (commit list):** The `updated_spec.md` commits are right-truncated. The Coder should run `git log --oneline` to capture all commits from `9f7bd00` to `bbb0faf` and append them to section §9. The ROADMAP.md references these commits: `679149a`, `10c9d94`, `75fd570`, `be75242`, `5230ea8`, `4be9fb5`, `e1207a3`, `8c6b3f7`, `7642f2c`, `80f5598`, `a059f4d`, `7d90689`, `393aa77`, `81761c9`, `57fcb4b`, `bbb0faf`.

---

## Files to Modify

| # | File | Action |
|---|------|--------|
| 1 | `README.md` | Modify (rewrite features, setup, provider sections) |
| 2 | `frontend/README.md` | Either replace or delete (see Open Question 1) |
| 3 | `updated_spec.md` | Modify (comprehensive update across all sections) |

---

## 1. `README.md` — Root Project README

**Risk: Low** — README only; no code changes.

### Changes Required

#### 1.1 Features section (lines 10–20)
Replace the bullet list with an updated comprehensive list reflecting all currently implemented features:

**Remove:**
- "Rate-limit handling — Automatic exponential backoff retry (1s, 2s, 4s, max 3) with zero data loss"
- "Provider-agnostic — Switch between Groq, NVIDIA NIM, OpenRouter, Gemini, Together AI by editing `appsettings.json` (no code changes)"

**Add/Update:**
- **AI-powered audit** — Paste or upload any OpenAPI/Swagger/Kubernetes spec (YAML/JSON) and get a structured security + design audit with severity-tagged findings
- **Real-time streaming** — Results appear as the AI generates them, with severity-colored highlighting (CRITICAL / WARNING / INFO)
- **Spec file upload** — Drag-and-drop or file-picker for `.yaml`/`.yml`/`.json` files
- **Session history** — Auto-saved to localStorage with LRU eviction (4 MB); collapsible sidebar
- **Toast/snackbar notifications** — Non-blocking feedback for copy, export, errors
- **Configurable provider/model** — UI dropdown selects from Groq, Together, OpenAI (fetched from `GET /api/providers`)
- **Multiple exports:** Copy to clipboard, Download `.md`, Export PDF (pdfmake), Export JSON (structured `findings[]` + `summary`)
- **Severity filter** — Toggle CRITICAL / WARNING / INFO visibility
- **Search within results** — Inline keyword search with highlight
- **Copy individual finding** — Per-block copy icon
- **Copy full report** — One-click clipboard copy
- **Auto-scroll** — Scrolls to latest token during streaming
- **Expandable findings** — Collapse/expand groups by severity (CSS transition animation)
- **Dark / Light mode** — Toggle with persistent preference; respects `prefers-color-scheme`
- **Error handling** — Reads AI provider error response body on non-success (no longer uses `EnsureSuccessStatusCode`)
- **Rate-limit handling** — Shows error immediately (exponential backoff retry removed)
- **Sentry monitoring** — Error tracking on both frontend and backend (opt-in via DSN)
- **Keyboard shortcuts** — `Ctrl+Enter` to run audit, `Escape` to abort
- **Governance Score** — Visual scorecard with per-dimension breakdown

#### 1.2 Tech Stack table (lines 23–28)
Update the "AI Integration" column:
- Remove: "Provider-agnostic via OpenAI C# client"
- Replace with: "Raw HttpClient + manual SSE parsing; OpenAI-compatible providers (Groq, Together, OpenAI)"

#### 1.3 Prerequisites (lines 30–33)
Keep as-is (still correct).

#### 1.4 Setup section (lines 35–63)
Update step 2:
- Current: `dotnet user-secrets set "Ai:ApiKey" "your-key-here"`
- Change to: `dotnet user-secrets set "Ai:ApiKey" "your-groq-key"`
- Add a note: "You can change the provider and model from the UI dropdown after starting the app."

Step 5:
- Update: "paste an OpenAPI spec" → "paste an OpenAPI spec or upload a `.yaml`/`.json` file"

#### 1.5 Provider Configuration section (lines 65–79)
**Replace entirely** — providers are now configured via UI dropdown, not by editing `appsettings.json`.

New content should:
- Explain that `appsettings.json` defines available providers in `AiProviders.Providers`
- Remove the table of 5 old providers (NVIDIA NIM, OpenRouter, Gemini)
- Show the 3 current providers: Groq, Together, OpenAI
- Emphasize that the UI dropdown fetches `/api/providers` at startup
- Note: The `Ai:ApiKey` user-secret or `Ai__ApiKey` env var is shared across all providers
- Keep the `dotnet user-secrets` command with updated example key

#### 1.6 Provider table (lines 69–75)
Replace with concise table showing current 3 providers:

| Provider | Default Model | Key prefix | Signup |
|----------|--------------|------------|--------|
| **Groq** | `llama-3.3-70b-versatile` | `gsk_` | console.groq.com |
| **Together** | `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free` | `tog-` | api.together.ai |
| **OpenAI** | `gpt-4o-mini` | `sk-` | platform.openai.com |

#### 1.7 Deployment section (lines 81–99)
- Keep Railway instructions (still correct)
- Keep Docker Compose instructions (still correct)
- Add note: Railway should set `Ai__ApiKey` env var (double underscore for .NET)

#### 1.8 Test section (lines 101–111)
Add approximate counts:
```bash
# Backend tests (~30 tests, requires .NET 10 SDK)
cd backend.Tests
dotnet test

# Frontend tests (~314 tests)
cd frontend
npm test
```

#### 1.9 After line 115
Optionally add a "## Monitoring" section briefly mentioning Sentry is opt-in via `Sentry:Dsn` / `VITE_SENTRY_DSN`.

### Existing Patterns to Follow
- Keep the same markdown structure, heading levels, and code-block style as current `README.md`
- Preserve the CI badge, live demo link, screenshot reference

---

## 2. `frontend/README.md` — Frontend-Specific README

**Risk: Low** — README only; no code changes.

### Option A: Replace with project-specific README

If chosen, replace the entire file with:

```markdown
# SpecAudit Frontend

React 19 + Vite 8 + Tailwind CSS v4 frontend for the SpecAudit AI-powered API audit tool.

## Setup

```bash
npm install
npm run dev        # starts at http://localhost:5173 (proxies /api to http://localhost:5000)
```

## Key Architecture

- **SSE streaming**: `api/auditClient.ts` — raw `fetch` + `ReadableStream` reader; manual SSE parsing
- **State machine**: `hooks/useAudit.ts` — `idle → loading → streaming → complete → error`
- **Session history**: `hooks/useHistory.ts` — localStorage with LRU eviction at 4 MB
- **Toast system**: `hooks/useToast.ts` + `ToastContainer.tsx` — React context-based notifications
- **Provider config**: `components/ui/ProviderSelector.tsx` — dropdown fetched from `GET /api/providers`
- **Severity filter**: `utils/filterMarkdown.ts` — block splitting at `### ` headings
- **Export**: `utils/exportPdf.ts` — pdfmake; `App.tsx` for clipboard, download, JSON export

## Key Files

| File | Purpose |
|------|---------|
| `src/types/audit.ts` | All TypeScript interfaces |
| `src/api/auditClient.ts` | SSE stream client |
| `src/hooks/useAudit.ts` | Audit state machine |
| `src/hooks/useHistory.ts` | localStorage history |
| `src/hooks/useToast.ts` | Toast/snackbar context |
| `src/hooks/useAutoScroll.ts` | Scroll-to-bottom logic |
| `src/hooks/useTheme.ts` | Dark/light mode |
| `src/App.tsx` | Shell, layout, export handlers |
| `src/components/features/InputPanel.tsx` | Spec input + file upload |
| `src/components/features/ResultPanel.tsx` | Markdown renderer + severity styling |
| `src/components/ui/ProviderSelector.tsx` | Provider/model dropdown |
| `src/components/ui/ToastContainer.tsx` | Toast stack display |
| `src/components/features/HistorySidebar.tsx` | Collapsible history sidebar |

## Tests

~314 tests using vitest + jsdom + testing-library. Run with `npm test`.

## UI Components

- `Button`: `primary | ghost | danger` variants, `sm | md` sizes
- `Card`: Content container with border
- `Spinner`: `sm | md | lg` animated loading indicator
- `ThemeToggle`: Sun/moon icon button
- `ScrollButton`: Up/down floating scroll control
```

### Option B: Delete

Remove the file entirely. The root `README.md` already covers all setup instructions.

---

## 3. `updated_spec.md` — Complete Project Context

**Risk: Low** — documentation only; no code changes. This is the largest change (~500 lines need updating across all 17 sections).

### Changes Required

#### 3.1 Header (line 3)
- Update: `HEAD: 9f7bd00` → `HEAD: bbb0faf`
- Update: `Generated: 2026-06-03` → `Generated: 2026-06-06` (or current date)
- Update: `Branch: main` (keep if still main)

#### 3.2 Tech Stack table (§1, lines 23–33)
- **Row "Backend AI"**: Change "OpenAI C# client (provider-agnostic) 2.10.0" to "Raw HttpClient + manual SSE parsing (no OpenAI SDK in streaming path)"
- **Row "Frontend"**: Update versions to match current `package.json`:
  - React: 19 (keep; verify exact version)
  - Vite: 8 (keep; verify exact version)
  - Tailwind: 4.3 (keep)
- Update test counts inline:
  - "Tests (FE)": `vitest 4.1` → keep; add note "~314 tests"
  - "Tests (BE)": `xUnit 2.9.2` → keep; add note "~30 tests"

#### 3.3 Architecture & Data Flow (§2)

**§2.1 Request Flow diagram (lines 41–66):**
- Update the backend column: `SpecAuditService.AuditAsync()` now uses raw HttpClient + manual SSE streaming, not OpenAI C# client SDK streaming
- Box `SpecAuditService.AuditAsync()` should note: "raw HttpClient → POST {provider}/chat/completions → StreamReader.ReadLineAsync → JSON.parse per `data:` line"
- Add a note about `GET /api/providers` being called on startup to populate provider dropdown

**§2.2 SSE Wire Protocol (lines 69–101):**
- Keep as-is (protocol hasn't changed)

**§2.3 Error Flow (lines 103–121):**
- **Remove** the entire exponential backoff retry flow
- **Replace with current flow:**
  - AI provider returns non-success → `SpecAuditService` reads error body → throws `HttpRequestException` with status + body
  - `AuditEndpoints` catches → sends `[SPECAUDIT_ERROR]` with rate-limit detection (429) or generic message
  - Frontend `auditClient.ts`: non-ok response → throws with status + body text (no retry)
  - Frontend `useAudit.ts`: error → sets status='error', shows error message
  - Add: 45-second server-side timeout → sends `[SPECAUDIT_ERROR]` timeout message
  - Add: Sentry exception capture on backend errors

**§2.4 Export Behavior Matrix (lines 124–132):**
- Keep as-is (still correct)

#### 3.4 Full Directory Map (§3, lines 136–247)

**Missing backend files to add:**
- `backend/src/Configuration/AiProviderOptions.cs` — multi-provider config model
- Under `backend/src/Endpoints/AuditEndpoints.cs`:
  - Update comment: `POST /api/audit, GET /api/config, GET /api/providers, GET /api/diagnose, GET /api/test-error`
- Under `backend/src/Models/Requests/AuditRequest.cs`:
  - Add comment showing current record: `{ Spec, SpecFormat?, Provider?, Model? }`

**Missing backend.Tests files to add:**
- `DiagnoseEndpointTests.cs` — 7 tests for `/api/diagnose` endpoint (raw + SDK modes)

**Missing frontend files to add:**
- `frontend/src/hooks/useHistory.ts` — localStorage session history
- `frontend/src/hooks/useToast.ts` — toast context hook
- `frontend/src/hooks/useToast.tsx` — ToastProvider component (if separate)
- `frontend/src/components/ui/ToastContainer.tsx` — toast stack UI
- `frontend/src/components/ui/ProviderSelector.tsx` — provider/model dropdown
- `frontend/src/components/features/HistorySidebar.tsx` — collapsible history sidebar
- `frontend/src/utils/filterMarkdown.ts` — block splitting for severity filter
- `frontend/src/utils/highlightText.ts` — keyword search highlight
- `frontend/src/utils/splitIntoBlocks.ts` (if exists) — block splitting utility

**Missing test files to add:**
- `hooks/__tests__/useToast.test.tsx`
- `hooks/__tests__/useHistory.test.tsx`
- `components/ui/__tests__/ProviderSelector.test.tsx`
- `components/ui/__tests__/ToastContainer.test.tsx`
- `components/features/__tests__/HistorySidebar.test.tsx`
- `utils/__tests__/filterMarkdown.test.ts`
- `utils/__tests__/highlightText.test.ts`
- `utils/__tests__/splitIntoBlocks.test.ts` (if exists)

**Missing root files:**
- `.env` (already listed)
- `docker-compose.yml` (already listed)
- `Dockerfile` (already listed)

#### 3.5 Backend Implementation (§4)

**§4.1 Program.cs (lines 253–307):**
- Update to reflect current state:
  - Add `builder.Services.Configure<AiProvidersConfig>(...)` binding
  - Remove `using System.Threading.RateLimiting;` (keep but verify)
  - Remove or update Sentry initialization code
  - Update endpoint registrations: `app.MapAuditEndpoints()` (not `app.MapAuditEndpoints`)
  - Update startup validation to mention `AiProviders` config too (optional)
  - Remove the `AddRateLimiter` code block (keep as-is — still present)

**§4.2 SpecAuditService.cs (lines 318–456):**
- **Replace entirely** with current implementation (raw HttpClient + manual SSE streaming)
- Show the new `AuditAsync()` that:
  - Creates `HttpClient` per request
  - Resolves provider from `AiProvidersConfig` dictionary
  - Builds JSON payload with `model`, `messages`, `stream: true`
  - Calls `client.SendAsync` with `HttpCompletionOption.ResponseHeadersRead`
  - Reads error body on non-success status code
  - Reads SSE `data:` lines via `StreamReader.ReadLineAsync`
  - Parses each `data:` line as JSON to extract `choices[0].delta.content`
  - Handles `[DONE]` sentinel
  - Calls `ExtractStructuredJson` after stream completes
- Show updated constructor with `IOptions<AiProvidersConfig>` dependency
- Keep `SystemPrompt` (lines 16–147) — still current
- Keep `BuildUserMessage` — still current
- Keep `ExtractStructuredJson` — still current

**§4.3 AuditEndpoints.cs (lines 458–498):**
- Update to show current endpoints:
  - `POST /api/audit` with 45-second timeout, Sentry capture, dual `OperationCanceledException` handling (client abort vs timeout)
  - `GET /api/config` — returns provider name (unchanged)
  - `GET /api/providers` — NEW: returns list of providers with id/name/models/defaultModel
  - `GET /api/diagnose` — NEW: tests AI provider connectivity (raw mode and SDK mode)
  - `GET /api/test-error` — NEW: intentional throw for Sentry verification

**§4.4 Models (lines 520–527):**
- Update `AuditRequest` to show current record:
  ```csharp
  public sealed record AuditRequest(
      string Spec,
      string? SpecFormat,
      string? Provider = null,
      string? Model = null
  );
  ```

**§4.5 Configuration (lines 528–554):**
- Add new section showing `AiProviderOptions` and `AiProvidersConfig`:
  ```csharp
  public sealed class AiProviderOptions
  {
      public string BaseUrl { get; init; } = string.Empty;
      public string DefaultModel { get; init; } = string.Empty;
      public List<string> Models { get; init; } = new();
  }
  
  public sealed class AiProvidersConfig
  {
      public Dictionary<string, AiProviderOptions> Providers { get; init; } = new();
  }
  ```
- Update `appsettings.json` sample to show the `AiProviders.Providers` dictionary
- Keep `AiOptions` as-is (still used for `ApiKey`, `MaxTokens`, `MaxInputLength`)

#### 3.6 Frontend Implementation (§5)

**§5.1 Types (lines 562–593):**
- Update `AuditRequest` to include `provider?: string; model?: string;`
- The rest is unchanged

**§5.2 SSE Client (lines 597–635):**
- Keep as-is (already updated to match current implementation)

**§5.3–§5.12 (lines 637–860):**
- Keep as-is — sufficiently matches current implementation
- Add a subsection for `useHistory.ts` (localStorage LRU) and `useToast.ts`/`ToastContainer.tsx`
- Add a subsection for `ProviderSelector.tsx` (dropdown)
- Add a subsection for `HistorySidebar.tsx` (collapsible sidebar)
- Add a subsection for `filterMarkdown.ts` (block splitting with `/\n(?=### )/`)
- Add a subsection for `highlightText.ts` (keyword search highlight)

#### 3.7 Regex Reference (§6, lines 864–877)
- Update block splitter regex in the table from `/\n(?=### \[(?:CRITICAL|WARNING|INFO)\])/` to `/\n(?=### )/`
- Keep all other entries as-is

#### 3.8 Tests (§7, lines 880–926)

**Update test counts:**
- Frontend: `205 tests` → `~314 tests` (verify exact count from `npm test`)
- Backend: `21 tests` → `~30 tests` (verify exact count)

**Add new test files to the tables:**
- `hooks/__tests__/useHistory.test.tsx` — ~X tests
- `hooks/__tests__/useToast.test.tsx` — ~X tests
- `components/ui/__tests__/ProviderSelector.test.tsx` — ~X tests
- `components/ui/__tests__/ToastContainer.test.tsx` — ~X tests
- `components/features/__tests__/HistorySidebar.test.tsx` — ~X tests
- `utils/__tests__/filterMarkdown.test.ts` — ~X tests
- `utils/__tests__/splitIntoBlocks.test.ts` — ~X tests (if exists)
- `utils/__tests__/highlightText.test.ts` — ~X tests (if exists)
- `backend.Tests/DiagnoseEndpointTests.cs` — 7 tests

**Update "What it covers" for existing test files** that have expanded coverage.

#### 3.9 Features Table (§8, lines 931–973)
**Add these rows (in order of completion, after existing rows):**

| Feature | Commit | Description |
|---------|--------|-------------|
| Search within results | `679149a` | Inline keyword search with highlight |
| Copy individual finding | `10c9d94` | Per-block copy icon in ResultPanel |
| Keyboard shortcuts | `75fd570` | Ctrl+Enter to run, Escape to abort |
| Remove NetworkTimeout | `be75242` | Fixes AI streaming hang on slow responses |
| Fix AI streaming token passthrough | `5230ea8` | Don't pass CancellationToken to OpenAI SDK |
| Diagnostic endpoint (raw + SDK) | `4be9fb5`+ | `GET /api/diagnose` with `?mode=raw\|sdk` |
| Fresh client per request | `7642f2c` | Prevents HTTP/2 connection poisoning |
| Raw HttpClient + manual SSE | `80f5598` | Replace OpenAI SDK streaming with raw SSE parsing |
| Spec file upload | `a059f4d` | Drag-and-drop + file picker for .yaml/.yml/.json |
| Session history + sidebar | `7d90689` | localStorage with LRU eviction (4 MB) |
| Toast/snackbar system | `393aa77` | React context-based notification system |
| Configurable provider/model | `81761c9` | UI dropdown fetches /api/providers |
| Expandable findings | `57fcb4b` | Collapse/expand by severity with CSS transition |
| Governance Score collapse fix | `bbb0faf` | Block splitter: `/\n(?=### )/` (any heading, not just severity) |

**Update existing rows:**
- "Rate-limit retry" (`9c2c58e`): Add note "Removed in later build — now shows error immediately"
- "Severity filter block splitting fix" (`227231b`): Update regex to `/\n(?=### )/` (current state)

#### 3.10 Commit History (§9, lines 976–1010)
- Append all commits from `9f7bd00` (exclusive) to `bbb0faf` (inclusive)
- Order: newest first
- Commits to add (from context, run `git log --oneline` to verify full list):
  ```
  bbb0faf fix: Governance Score collapse bug — block splitter from /\n(?=### \[(?:CRITICAL|WARNING|INFO)\])/ to /\n(?=### )/
  57fcb4b feat: expandable findings groups by severity
  81761c9 feat: configurable provider/model in UI dropdown
  393aa77 feat: toast/snackbar notification system
  7d90689 feat: session history sidebar with localStorage LRU eviction
  a059f4d feat: spec file upload via drag-and-drop + file input
  80f5598 refactor: replace OpenAI SDK streaming with raw HttpClient + manual SSE parsing
  7642f2c fix: fresh OpenAI client per request (fixes HTTP/2 connection poisoning)
  8c6b3f7 test: DiagnoseEndpoint tests for raw + SDK modes
  e1207a3 fix: diagnose endpoint improvements
  4be9fb5 feat: diagnostic endpoint GET /api/diagnose
  5230ea8 fix: don't pass CancellationToken to SDK (fixes streaming timeout)
  be75242 fix: remove NetworkTimeout from OpenAI client (fixes streaming hang)
  75fd570 feat: keyboard shortcuts Ctrl+Enter and Escape
  10c9d94 feat: copy individual finding per-block
  679149a feat: search within results with inline highlight
  ```

#### 3.11 Configuration & Environment (§10, lines 1015–1045)
- Add `AiProvidersConfig` binding in Program.cs to the "API Key Management" mentions
- Update "Provider Switching" section:
  - Remove the 5-provider table (NVIDIA NIM, OpenRouter, Gemini were removed)
  - Replace with: "Available providers are defined in `appsettings.json:AiProviders.Providers`. The UI dropdown fetches `GET /api/providers` at startup. No `appsettings.json` editing needed to switch."

#### 3.12 Key Architectural Decisions (§13, lines 1134–1149)
- **Row "AI provider abstraction"**: Change "OpenAI C# client" to "Raw HttpClient + manual SSE"
  - Update rationale: "OpenAI SDK streaming had HTTP/2 connection-poisoning and timeout issues. Raw HttpClient gives full control over SSE parsing, error handling, and connection lifecycle. Fresh client per request prevents state leaks."
- **Row "Rate-limit retry"**: Entirely replace — retry was removed. New entry:
  - "Error handling" / "Read AI provider error response body on non-success" / "Previously used EnsureSuccessStatusCode which discarded error details" / rationale
  - "Rate-limit handling" / "Show error immediately (no retry)" / "Exponential backoff retry was removed because it caused state conflicts and UX confusion. Simpler to show error and let user retry manually."
- **Add new rows:**
  - **"Provider resolution"**: Dynamic via `AiProvidersConfig` dictionary, not single `AiOptions` — enables multi-provider UI
  - **"Session history"**: localStorage with LRU eviction at 4 MB — no backend needed, survives page refresh
  - **"Toast system"**: React context provider — decouples notifications from component tree
  - **"Spec file upload"**: Frontend reads file as text, sends via existing POST /api/audit — no backend changes needed
  - **"Block splitting"**: Updated from severity-only regex to `/\n(?=### )/` — fixes Governance Score being swallowed

#### 3.13 Edge Cases (§14, lines 1152–1172)
- Remove: "Rate limit (429 from AI)" → exponential backoff retry (no longer exists)
- Add: "45-second server timeout" → `CancellationTokenSource.CancelAfter(45s)` → `[SPECAUDIT_ERROR]` timeout message
- Update: "Rate limiter rejection (429)" → now goes directly to error (no retry)
- Update: "Rate limit from AI" → reads error body, throws `HttpRequestException` with `{status}: {body}`

#### 3.14 Known Issues (§15, lines 1175–1183)
- Keep items 1–5 as-is (still relevant)
- Remove item 3? "No client-side spec validation" — if file upload was added, this is partially addressed. Keep as known issue.
- Remove item 4? "No persistence" — history sidebar partially addresses this. Change to: "Results persist via localStorage but are device-specific. No server-side persistence."
- Add new known issue: "History sidebar 'Copied!' toast may appear briefly for non-copy actions depending on timing."

#### 3.15 Roadmap (§16, lines 1187–1213)
- **Move all items from "Small" and "Medium" sections to the "Completed" list** — they are all implemented:
  - Severity filter → ✅ Completed
  - Search within results → ✅ Completed
  - Copy individual finding → ✅ Completed
  - Keyboard shortcuts → ✅ Completed
  - Spec file upload → ✅ Completed
  - Session history → ✅ Completed
  - Audit history sidebar → ✅ Completed
  - Toast/snackbar system → ✅ Completed
  - Configurable provider/model → ✅ Completed
  - Expandable findings → ✅ Completed
- Replace the "Small" and "Medium" sections with empty headings or remove entirely

#### 3.16 Quick Reference (§17, lines 1216–1239)
- Add entries for new key files:
  - `useHistory.ts` → Session history hook
  - `useToast.ts` / `useToast.tsx` → Toast/snackbar provider
  - `ToastContainer.tsx` → Toast UI stack
  - `ProviderSelector.tsx` → Provider/model dropdown
  - `HistorySidebar.tsx` → Collapsible history sidebar
  - `filterMarkdown.ts` → Block splitting utility
  - `highlightText.ts` → Search highlight utility
  - `AiProviderOptions.cs` → Multi-provider config model

---

## Implementation Order

1. **`README.md`** — Start here (simplest; most visible).
2. **`frontend/README.md`** — After Open Question 1 is resolved.
3. **`updated_spec.md`** — Most complex; leave for last.

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Stale test counts | Low | Run `npm test` and `dotnet test` to get exact numbers before writing |
| Git commit log changes | Low | Run `git log --oneline` before writing; the Coder should do this |
| Open Question 1 blocks `frontend/README.md` | Low | Decide before implementation starts; Option A is recommended |
| Cross-reference drift | Low | Re-read the current source files before each edit to ensure accuracy |
| No code changes involved | **None** | Documentation-only; no risk of breaking functionality |

## Existing Patterns to Follow

- `README.md`: Keep the same heading style, code fences, badge, and link formats as the current file
- `frontend/README.md` (if replaced): Model after the root `README.md` tone but frontend-focused
- `updated_spec.md`: Maintain the same section numbering, table formatting, and code-block style. The Coder should run `git log --oneline` to get the authoritative commit list rather than relying on the spec's pre-filled list.
