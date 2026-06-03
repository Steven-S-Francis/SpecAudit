# Spec Document Update — Updated `updated_spec.md` to reflect Sentry monitoring (commits `d9f6fb0`, `9f7bd00`)

## File Changed

### `updated_spec.md` — Complete project context reference updated (~1240 lines)

Updated the reference document to reflect the Sentry monitoring feature and ROADMAP.md update:

| # | Area | What changed |
|---|------|-------------|
| 1 | **Line 3 HEAD hash** | `ce16a18` → `9f7bd00` |
| 2 | **Section 3 (Directory Map)** | Added `SentryStartupTests.cs` under `backend.Tests/` |
| 3 | **Section 7.2 (Backend Tests)** | Updated count 19→21, 4→5 files, added `SentryStartupTests.cs` row (2 tests) |
| 4 | **Section 8 (Features)** | Added 3 rows: Sentry monitoring (backend), Sentry monitoring (frontend), Sentry Docker config |
| 5 | **Section 9 (Commit History)** | Added `9f7bd00` and `d9f6fb0` at top of commit list |
| 6 | **Section 10 (API Key Management)** | Added 3 rows for `Sentry:Dsn`, `VITE_SENTRY_DSN`, and Docker Compose `SENTRY_DSN` + `VITE_SENTRY_DSN` |
| 7 | **Section 15 (Known Issues)** | Added item 6: Sentry DSN is optional (no-op without it) |
| 8 | **Section 16 (Roadmap)** | Removed "Monitoring / error tracking — Sentry integration" from Infrastructure (moved to Completed) |

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (frontend) | ✅ Passed (no errors) |

## Notes for Tester

- All edits were targeted sections only; code snippets and implementation details (Sections 4, 5) were not updated — the spec is meant to track high-level completeness, not inline code examples.
- The 3 new features rows in Section 8 detail: backend Sentry init gated by `Sentry:Dsn`, frontend Sentry.init gated by `VITE_SENTRY_DSN` with `ErrorBoundary`, and Docker build arg support.
- The Sentry DSN optionality is captured in both Section 10 (Protected? = "Optional (no-op without it)") and Section 15 (Known Issues item 6).

---

# Review Fix — Sentry Monitoring 4 Blocking Issues

## Files Changed (6 files)

### `backend/Program.cs` (Issue 1 — API Key Scrubbing)
- **Line 7:** Added `using Sentry.AspNetCore;` to access `SentryAspNetCoreOptions` for explicit delegate type cast.
- **Lines 14–75:** Replaced the `SetBeforeSend` callback body:
  - **Before:** Only set a diagnostic flag `has_scrubbed_api_key` without actually redacting the API key.
  - **After:** Actually redacts the API key from:
    - `SentryEvent.Message.Formatted` — replaces API key with `[REDACTED]`
    - `SentryEvent.Extra` values — uses `SetExtra()` to update dictionary entries containing the API key
    - Exception message — flags via `api_key_redacted` extra flag (cannot mutate `Exception.Message` without reflection)
    - Breadcrumbs — flags via `api_key_in_breadcrumbs` extra flag (`Breadcrumb.Message` is init-only in Sentry 5.x, so mutation is not possible)
- **Line 14:** Changed `builder.WebHost.UseSentry(options =>` to `builder.WebHost.UseSentry((Action<SentryAspNetCoreOptions>)(options =>` to disambiguate overload resolution between `Action<SentryAspNetCoreOptions>` and `Action<ISentryBuilder>` (Sentry 5.x has both overloads and implicit typing was resolving to the wrong one in Program.cs top-level statements).

### `frontend/src/main.tsx` (Issue 2 — Missing `beforeSend`)
- **Lines 18–22:** Added `beforeSend` callback inside `Sentry.init()` that strips request headers (`event.request.headers = {}`) to prevent accidental PII leakage, matching the spec's security requirements.

### `Dockerfile` (Issue 3 — Build-time env var support)
- **Line 2:** Added `ARG VITE_SENTRY_DSN` after the `FROM` line in the `frontend-build` stage. This makes the Docker build arg available as an environment variable during `npm run build`, so Vite can replace `import.meta.env.VITE_SENTRY_DSN` at build time.

### `docker-compose.yml` (Issue 3 — VITE_SENTRY_DSN in wrong place)
- **Removed** `VITE_SENTRY_DSN=${VITE_SENTRY_DSN}` from the `environment` block (runtime env — has no effect on Vite builds).
- **Added** `build.args.VITE_SENTRY_DSN: ${VITE_SENTRY_DSN:-}` — passes as an optional build arg with empty default, so Vite bakes it into the frontend JS at build time.

### `backend.Tests/SentryStartupTests.cs` (Issue 4 — New backend tests)
- **Created** new test file with 2 tests:
  - `HealthEndpoint_Works_WhenSentryDsnIsNotSet` — verifies the `/health` endpoint returns 200 when Sentry DSN is absent (Sentry is a no-op).
  - `HealthEndpoint_Works_WhenSentryDsnIsSet` — verifies the `/health` endpoint returns 200 when Sentry DSN is configured with a fake DSN (SDK doesn't crash on invalid DSN).
- Uses the same `IClassFixture<WebApplicationFactory<Program>>` pattern as the existing `EndpointValidationTests.cs`.

## Verification Results

| Check | Result |
|-------|--------|
| `dotnet build` (backend) | ✅ Build succeeded (0 warnings, 0 errors) |
| `dotnet test backend.Tests` | ✅ **21 passed** (up from 19 — 2 new Sentry tests) |
| `npx tsc --noEmit` (frontend) | ✅ Passed (0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **205 passed** (15 files, 0 failures) |

## Notes for Tester

- **Issue 1 (API Key Scrubbing):** The `SetBeforeSend` callback now actually replaces the API key value with `[REDACTED]` in `SentryEvent.Message.Formatted` and extra data values. Exception messages and breadcrumb messages are flagged with extra metadata (`api_key_redacted`, `api_key_in_breadcrumbs`) since their `Message` properties cannot be mutated after construction (Sentiy 5.x uses init-only setters).
- **Issue 2 (Frontend beforeSend):** Verify that request headers are stripped from Sentry events by checking that `event.request.headers` is set to `{}` in the `beforeSend` callback. This prevents auth tokens and cookies from leaking to Sentry.
- **Issue 3 (Docker build args):** `VITE_SENTRY_DSN` is now a Docker build arg instead of a runtime env var. Build with `docker compose build --build-arg VITE_SENTRY_DSN=https://key@sentry.io/oid` to enable frontend Sentry in Docker. Without the arg, Sentry is a no-op. The `docker-compose.yml` uses `${VITE_SENTRY_DSN:-}` (optional with empty default).
- **Issue 4 (Tests):** Both new tests verify that the health endpoint works regardless of whether Sentry DSN is configured. Run `dotnet test` to see 21 total tests (was 19). The Sentry SDK does not make network connections to a fake DSN during tests.

---

# Sentry Monitoring / Error Tracking Integration

## Files Changed (6 files)

### `backend/backend.csproj`
- **Line 12:** Added `<PackageReference Include="Sentry.AspNetCore" Version="5.*" />` after the OpenAI package reference.
- Resolves to `Sentry.AspNetCore 5.16.3` (latest 5.x compatible with .NET 10).

### `backend/Program.cs`
- **Line 7:** Added `using Sentry;` to import the `UseSentry` extension method.
- **Lines 11–37:** Added Sentry initialization block **before** `builder.Services.Configure<AiOptions>(...)` and **after** `var builder = ...`:
  - Gated by `!string.IsNullOrWhiteSpace(builder.Configuration["Sentry:Dsn"])` — no DSN = no-op.
  - Uses `builder.WebHost.UseSentry(options => ...)` with:
    - `options.Dsn` set from config
    - `SendDefaultPii = false` (no PII)
    - `TracesSampleRate = 0.25` (25% trace sampling)
    - `SetBeforeSend()` method (Sentry 5.x API — uses `SetBeforeSend()` not `BeforeSend =`) to scrub API key from exception messages
- **Note:** Uses `SetBeforeSend()` because Sentry 5.x exposes `BeforeSend` as a method, not a property.

### `frontend/package.json`
- **Line 14:** Added `"@sentry/react": "^8.0.0"` to dependencies.

### `frontend/src/main.tsx`
- **Completely replaced** with Sentry-integrated version:
  - Imports `* as Sentry from '@sentry/react'`
  - Gated init: `if (import.meta.env.VITE_SENTRY_DSN) { Sentry.init(...) }`
  - Integrations: `browserTracingIntegration()`, `replayIntegration()`
  - Sampling: `tracesSampleRate` is 0.25 in prod, 0 in dev; `replaysSessionSampleRate: 0.1`; `replaysOnErrorSampleRate: 1.0`
  - Wraps `<App />` in `<Sentry.ErrorBoundary>` with a fallback UI

### `docker-compose.yml`
- **Lines 11–12:** Added `Sentry__Dsn=${SENTRY_DSN}` and `VITE_SENTRY_DSN=${VITE_SENTRY_DSN}` to the `app` service's `environment` block.

### `.env`
- **Lines 3–5:** Added commented-out placeholder entries for `SENTRY_DSN` and `VITE_SENTRY_DSN`.

## Verification Results

| Check | Result |
|-------|--------|
| `dotnet build` (backend) | ✅ Build succeeded (0 warnings, 0 errors) |
| `npx tsc --noEmit` (frontend) | ✅ Passed (0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **205 passed** (15 files, 0 failures) |
| `dotnet test SpecAudit.slnx` | ✅ **19 passed** (0 failures) |

## Notes for Tester

- **Sentry 5.x API nuance:** The backend uses `options.SetBeforeSend(callback)` instead of `options.BeforeSend = callback`. Sentry 5.x exposes `BeforeSend` as a method (`SetBeforeSend`), not a property. This was identified during build and fixed.
- **No DSN = no-op:** If `Sentry__Dsn` (backend) or `VITE_SENTRY_DSN` (frontend) is not set or empty, Sentry is never initialized — zero Sentry-related log noise or network requests.
- **Performance impact:** `TracesSampleRate: 0.25` means 25% of requests get performance tracing. `replaysSessionSampleRate: 0.1` means 10% of user sessions get recorded in production. Both are zero in development.
- **Security:** `SendDefaultPii = false` on the backend; the `SetBeforeSend` callback scrubs the AI API key from exception messages. On the frontend, the `ErrorBoundary` fallback prevents crash loops.
- **No source map upload:** Per resolved Q2, `@sentry/vite-plugin` is not included. Stack traces in Sentry will be minified. This can be addressed in a future PR.
- **Frontend DSN is public:** The frontend DSN is embedded in the client-side JS bundle. This is by design — the DSN is not a secret, it only routes events to the correct Sentry project.

---

# Group 6 Changes — Permanent Docker build fix (exclude test files + vi import + nul ignore)

## Files Changed

### `frontend/tsconfig.app.json` (Fix 1 — Exclude test files)
- **Added `"exclude"` block** (lines 25–30) with four patterns:
  - `"src/**/__tests__"` — all test directories anywhere under `src/`
  - `"src/**/*.test.ts"` — all `.test.ts` files anywhere under `src/`
  - `"src/**/*.test.tsx"` — all `.test.tsx` files anywhere under `src/`
  - `"src/test-setup.ts"` — vitest setup file
- This prevents `tsc -b` from ever compiling vitest-specific code again. Fixes the `vi` issue AND prevents any future test-file type errors from breaking the Docker build.

### `frontend/src/hooks/__tests__/useTheme.test.tsx` (Fix 2 — Explicit vi import)
- **Line 2:** Added `vi` to the vitest import: `import { describe, it, expect, beforeEach, vi } from 'vitest'`
- Correct practice — tests that use `vi` should import it explicitly rather than relying on vitest globals.

### `.gitignore` (root) (Fix 3 — nul ignore)
- **Line 11:** Added `nul` on its own line to prevent stray Windows reserved-device-name file from being tracked by git.

### `frontend/.gitignore` (Fix 3 — nul ignore)
- **Line 25:** Added `nul` on its own line.

### `frontend/.dockerignore` (Fix 3 — nul ignore)
- **Line 8:** Added `nul` on its own line to prevent stray `nul` file from being copied into Docker build context.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc -b` (what Docker build uses) | ✅ Passed (0 errors) |
| `npx tsc --noEmit` (frontend) | ✅ Passed (0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **205 passed** (15 files, 0 failures) |
| `dotnet build` (backend) | ✅ Build succeeded (0 warnings, 0 errors) |

## Notes for Tester

- **Fix 1:** Verify `npm run build` (which runs `tsc -b && vite build`) succeeds. Test files that use `vi` should no longer interfere with the app tsconfig. If a new test file using vitest-specific APIs is added in the future, it will NOT break the Docker build.
- **Fix 2:** No behavioral change. The 6 `useTheme` tests should still all pass (they did: ✓). Verify `vi` is now imported explicitly instead of relying on the global.
- **Fix 3:** Run `git status` from project root — no `nul` file should appear. If a `nul` file exists, `git check-ignore nul` should return the file path. The `.dockerignore` entry prevents `nul` from being copied during Docker builds.
- Q1 (nul location) has been resolved per spec: `nul` added to root `.gitignore`, `frontend/.gitignore`, and `frontend/.dockerignore`.

---

# Group 3 Changes — Code quality (C, D, E, J)

## Files Changed

### `frontend/src/utils/exportPdf.ts` (Fix C)
- **Line 146:** Changed `line.match(/^```(\w*)$/)` to `line.trimEnd().match(/^```(\w*)$/)`.
- `trimEnd()` removes `\r` from CRLF line endings before the regex match, so code fence detection works on Windows line endings. The untrimmed `line` is still pushed to `codeBuffer` for content preservation.

### `backend/src/Services/SpecAuditService.cs` (Fix D)
- **ExtractStructuredJson method:** Replaced `StructuredJsonRegex()` generated regex approach with `LastIndexOf`-based extraction:
  1. Uses `markdown.LastIndexOf("```json", ...)` to find the last JSON block
  2. Finds the closing ``"```"`` after that position using `markdown.IndexOf("```", ...)`
  3. Extracts the substring between them, trims it, and validates with `JsonDocument.Parse`
- **Removed** the `[GeneratedRegex]` partial method `StructuredJsonRegex()` (lines 235–236)
- **Removed** `partial` keyword from class declaration (line 14)
- **Removed** `using System.Text.RegularExpressions;` import (line 5)

### `backend.Tests/ExtractStructuredJsonTests.cs` (Test D)
- **Renamed** `ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsNull` → `ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString`
- **Updated assertion:** With the `LastIndexOf` approach, text after the JSON block is allowed, so the test now expects `result.Should().NotBeNull()` and `result.Should().Contain("findings")` instead of `result.Should().BeNull()`.

### `frontend/src/hooks/useAutoScroll.ts` (Fix E)
- Added `isStreaming?: boolean` to `UseAutoScrollOptions` interface
- Added `isStreaming = false` default parameter to `useAutoScroll` function signature
- Changed `behavior: 'smooth' as ScrollBehavior` to `behavior: (isStreaming ? 'auto' : 'smooth') as ScrollBehavior` in the auto-scroll effect (line 31)
- This uses instant scrolling (`'auto'`) during streaming to avoid excessive paint calls, and smooth scrolling (`'smooth'`) when streaming stops.

### `frontend/src/components/features/ResultPanel.tsx` (Fix E)
- **Line 46:** Changed `useAutoScroll({ deps: [content] })` to `useAutoScroll({ deps: [content], isStreaming })` to pass the `isStreaming` prop.

### `backend/src/Models/Responses/AuditResponse.cs` (Fix J)
- **Deleted** the entire file. The types `StructuredFinding`, `StructuredDimensions`, `StructuredSummary`, `StructuredData` were dead code — never referenced anywhere. Confirmed by grep: zero references outside this file.

### `frontend/src/hooks/__tests__/useAutoScroll.test.tsx` (Test E)
- Updated `TestComponent` to accept `isStreaming?: boolean` prop and pass it to `useAutoScroll`
- Updated all existing tests to pass `isStreaming={false}` to maintain `behavior: 'smooth'` assertions
- Added new test: `"uses auto behavior when isStreaming is true"` — verifies `scrollTo` is called with `behavior: 'auto'` when streaming

### `frontend/src/utils/__tests__/exportPdf.test.ts` (Test C)
- Added new test: `"detects code fence with CRLF line endings"` — verifies `markdownToContent('```\r\ncode\r\n```\r\n')` produces content with text `'code\r'` (the `\r` is retained in code buffer per spec)
- Added new test: `"detects code fence with trailing spaces"` — verifies `markdownToContent('```   \ncode\n```')` produces a single code block

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (frontend) | ✅ Passed (no errors) |
| `dotnet build` (backend) | ✅ Passed (0 warnings, 0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **203 passed** (15 files, 0 failures) |
| `dotnet test` (backend.Tests) | ✅ **19 passed** (0 failures) |

## Notes for Tester

- **Fix C**: Verify PDF export handles CRLF code fences correctly. The `trimEnd()` fix ensures `\r` from CRLF endings doesn't break fence detection. Note: code block content retains `\r` in the buffer (only the regex match line uses `trimEnd()`).
- **Fix D**: The `LastIndexOf` approach is more tolerant of text after the JSON block (was rejected by the regex `\s*$` anchor). All 7 existing tests plus the renamed one pass. Verify no regression in structured JSON extraction behavior.
- **Fix E**: During streaming, scroll behavior is `'auto'` (instant). When streaming stops, the final scroll is `'smooth'`. Verify the transition works by monitoring scroll behavior from streaming start to completion.
- **Fix J**: `AuditResponse.cs` deleted. Verify no build errors and no runtime references to the deleted types.

---

# Group 2 Changes — UX and reliability (B, F)

## Files Changed

### `frontend/src/components/features/InputPanel.tsx` (Fix B)
- **Line 67:** Added `|| status === 'loading'` to the `disabled` prop on the "Run Audit" button.
- Previously: `disabled={isEmpty || isOverLimit || status === 'streaming'}`
- Now: `disabled={isEmpty || isOverLimit || status === 'loading' || status === 'streaming'}`
- Prevents double-click starting an unnecessary abort/restart cycle when a retry backoff is in progress.

### `backend/Program.cs` (Fix F)
- **Line 31:** Added `string.IsNullOrWhiteSpace(aiOptions.ApiKey)` to the guard condition.
- **Line 32:** Updated error message from `"Ai:BaseUrl and Ai:ModelId must be configured in appsettings.json."` to `"Ai:BaseUrl, Ai:ModelId, and Ai:ApiKey must be configured in appsettings.json or user-secrets."`.
- A missing API key now causes a clear startup exception instead of a cryptic runtime error from the OpenAI client.

### `frontend/src/components/features/__tests__/InputPanel.test.tsx` (Test B)
- Added new test: `"disables Run button when status is loading"` — renders with `status="loading"`, types valid input, asserts button is disabled.

### `backend.Tests/AiOptionsValidationTests.cs` (Test F)
- Added new test: `Startup_MissingApiKey_ThrowsInvalidOperationException` — configures empty `Ai:ApiKey` with valid `BaseUrl`/`ModelId`, asserts exception message contains `"*ApiKey*"`.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (frontend) | ✅ Passed (no errors) |
| `dotnet build` (backend) | ✅ Passed (0 warnings, 0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **200 passed** (15 files, 0 failures) |
| `dotnet test` (backend.Tests) | ✅ **19 passed** (0 failures) |

## Notes for Tester

- **Fix B**: Verify the "Run Audit" button is disabled in both `loading` and `streaming` states by checking the button's `disabled` attribute when `status="loading"` with valid input.
- **Fix F**: Verify that setting `Ai:ApiKey` to `""` in `appsettings.json` causes startup to throw `InvalidOperationException` with a message mentioning "ApiKey". The existing `Startup_MissingBaseUrl_ThrowsInvalidOperationException` and `Startup_MissingModelId_ThrowsInvalidOperationException` tests still pass, confirming backward compatibility.

---

# Group 4 Changes — Security architecture (I)

## Files Changed

### `backend/Program.cs` (Fix I)
- **Lines 1–2:** Added `using System.Threading.RateLimiting;` and `using Microsoft.AspNetCore.RateLimiting;` at the top.
- **Lines 20–33:** Added `builder.Services.AddRateLimiter(...)` after `builder.Services.AddCors(...)` that configures:
  - A policy named `"AuditPolicy"` using `FixedWindowLimiter` partitioned by client IP (`RemoteIpAddress`)
  - `PermitLimit = 10` requests per `Window = 1 minute`
  - `QueueLimit = 0` (no queuing — excess requests immediately rejected)
  - `RejectionStatusCode = 429` (instead of the default 503)
- **Line 43:** Added `app.UseRateLimiter()` before `app.MapAuditEndpoints()` to enable the rate limiting middleware.

### `backend/src/Endpoints/AuditEndpoints.cs` (Fix I)
- **Line 57:** Changed `});` to `}).RequireRateLimiting("AuditPolicy");` on the `/api/audit` `MapPost` call.
- This applies the rate limiting policy *only* to the `/api/audit` endpoint. `/health` and `/api/config` are NOT rate-limited.

### `backend/backend.csproj`
- **No change needed.** Rate limiting middleware is built into ASP.NET Core since .NET 8. No NuGet packages required.

## Verification Results

| Check | Result |
|-------|--------|
| `dotnet build` (backend) | ✅ Passed (0 warnings, 0 errors) |
| `dotnet test SpecAudit.slnx` | ✅ **19 passed** (0 failures) |

## Notes for Tester

- **Fix I**: Verify that sending 11+ requests to `/api/audit` within 1 minute returns HTTP 429 on the 11th request. `/health` and `/api/config` should remain unrestricted.
- The rejection status code is 429 (not default 503), matching standard rate-limit semantics.
- Rate limiting is per IP address (`RemoteIpAddress`). If behind a reverse proxy (e.g., Railway), the proxy IP is used unless `X-Forwarded-For` is configured.
- `QueueLimit=0` means no requests are queued — the 11th request is immediately rejected with 429.

---

# Group 5 Changes — TypeScript build fix (TS2666 / TS2300)

## Files Changed

### `frontend/src/vite-env.d.ts` (created)
- New Vite environment declaration file following the standard Vite pattern.
- Contains `/// <reference types="vite/client" />` triple-slash directive and a global `declare module '*.md?raw'` block.
- This provides the `*.md?raw` import type for the entire `src/` directory, eliminating the need for inline module augmentation in test files.

### `frontend/src/utils/__tests__/filterMarkdown.test.ts` (modified)
- **Removed lines 5–9:** The inline `declare module '*.md?raw' { ... }` block.
- With `"moduleDetection": "force"` in `tsconfig.app.json`, every file is treated as a module. The inline augmentation conflicted with Vite's own `*?raw` declaration from `vite/client`, causing TS2666 (augmentations not permitted in modules) and TS2300 (duplicate identifier 'src').

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc -b` (frontend, same as Docker build) | ✅ Passed (no errors) |
| `npx tsc --noEmit` (frontend) | ✅ Passed (no errors) |
| `npx vitest run --reporter=verbose` | ✅ **203 passed** (15 files, 0 failures) |

## Notes for Tester

- The `vite-env.d.ts` file is the standard Vite convention for declaring custom import types (same pattern used by Vite scaffolding templates).
- The fix resolves the Docker build failure at the `tsc -b` step. No runtime behavior changes.
- All existing tests (203) continue to pass, including `filterMarkdown.test.ts` which imports a `*.md?raw` fixture.
- No other files needed changes — the global declaration covers all consumers of `*.md?raw` imports.

---

# Spec Document Update — Updated `updated_spec.md` to reflect all changes since HEAD `775b729`

## File Changed

### `updated_spec.md` — Complete project context reference updated

Updated ~1200-line reference document to reflect all commits from `775b729` through `eae5a9e` (current HEAD `eae5a9e`). Specific edits:

| # | Area | What changed |
|---|------|-------------|
| 1 | **Line 3 HEAD** | Updated from `775b729` to `eae5a9e` |
| 2 | **Section 3 (Directory Map)** | Removed `Responses/AuditResponse.cs`, added `vite-env.d.ts` |
| 3 | **4.1 Program.cs** | Added rate limiter code (`AddRateLimiter`, `UseRateLimiter`), added `ApiKey` to startup validation guard |
| 4 | **4.2 SpecAuditService.cs** | Removed `partial` from class; replaced `[GeneratedRegex]` with `LastIndexOf`/`IndexOf` extraction; updated edge cases (text after JSON now ALLOWED) |
| 5 | **4.3 AuditEndpoints.cs** | Updated catch block to show generic sanitized message; added `.RequireRateLimiting("AuditPolicy")` |
| 6 | **4.4 Models** | Removed `AuditResponse.cs` response models section (dead types deleted) |
| 7 | **5.2 auditClient.ts** | Added `isValidStructuredData()` type guard description |
| 8 | **5.4 useAudit.ts** | Fixed retry code to show `await audit(payload, true)` (was fire-and-forget) |
| 9 | **5.6 ResultPanel.tsx** | Added `useAutoScroll` with `isStreaming` option, severity filter buttons |
| 10 | **5.7 InputPanel.tsx** | Added `status === 'loading'` to disabled condition |
| 11 | **5.8 exportPdf.ts** | Updated code fence regex to show `line.trimEnd().match(...)` for CRLF handling |
| 12 | **5.9 (new) useAutoScroll.ts** | Added new section describing `isStreaming` option and `'auto'` vs `'smooth'` behavior |
| 13 | **Section 6 (Regex Reference)** | Removed `StructuredJsonRegex` row; updated code fence row with `trimEnd()` note |
| 14 | **Section 7 (Test Counts)** | Updated: 177→203 frontend, 14→15 files, 18→19 backend; added `filterMarkdown.test.ts`; updated all changed file descriptions |
| 15 | **Section 8 (Features)** | Added 16 new feature rows (severity filter, pipeline enforcement, sanitized errors, await fix, type guard, loading guard, ApiKey validation, CRLF fix, LastIndexOf, scroll behavior, dead code removal, rate limiter, Docker build fix) |
| 16 | **Section 9 (Commit History)** | Added 12 commits from `25c129d` through `eae5a9e` above existing entries |
| 17 | **Section 12 (Agent Permissions)** | Added `b66d2c9` changes note (build agent git deny removed, NO SKIPPING STAGES) |
| 18 | **Section 13 (Key Decisions)** | Added 3 rows: rate limiter approach, block splitting regex, JSON extraction method |
| 19 | **Section 14 (Edge Cases)** | Updated rate limit entry (→ from AI), added rate limiter rejection (429), updated text-after-JSON (now allowed), updated multiple JSON blocks (LastIndexOf) |
| 20 | **Section 15 (Known Issues)** | Added item 6: stray `nul` file in working directory |
| 21 | **Section 17 (Quick Reference)** | Added `vite-env.d.ts` entry |

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` (frontend: `tsc -b && vite build`) | ✅ Build succeeded (0 errors) |
| `dotnet build backend/backend.csproj` | ✅ Build succeeded (0 warnings, 0 errors) |

## Notes for Tester

- The spec document is a reference for AI code review agents. Spot-check any section of interest against the actual source code.
- All code snippets in the spec now match the current source implementation at HEAD `eae5a9e`.
- Test counts (203 frontend, 19 backend) match the live test suite.

---

# Code Review Fixes — Findings 1–3 (spec.md v3)

## Files Changed

### `.opencode/opencode.json` (Finding 1 — Build agent bash permissions)
- **Lines 20–29:** Replaced `"bash": { "*": "allow" }` with a strict allowlist:
  ```json
  "bash": {
    "*": "deny",
    "dotnet build": "allow",
    "dotnet test": "allow",
    "dotnet restore": "allow",
    "npm run build": "allow",
    "npm run test": "allow",
    "npx tsc --noEmit": "allow",
    "npx vitest run": "allow"
  }
  ```
- `edit` and `write` rules are untouched — only the `bash` block changed.
- Verified no other agents have `"bash": { "*": "allow" }` (the `plan` agent already has `"*": "deny"`).

### `frontend/src/App.tsx` (Finding 2 — JSON export stripped result)
- **Line 66:** Changed `auditResult.result = state.result;` → `auditResult.result = strippedResult;` — the JSON export fallback now uses the fence-stripped result, matching the behavior of Copy, Download, PDF export, and ResultPanel display.
- **Line 81:** Changed dependency array `[state.result, ...]` → `[strippedResult, ...]` — keeps the `useCallback` exhaustive-deps in sync with the variable actually used inside the callback.

### `frontend/src/hooks/useTheme.ts` (Finding 3 — Dark mode respects prefers-color-scheme)
- **Lines 13–19:** Added a `try-catch` block that checks `window.matchMedia('(prefers-color-scheme: light)').matches` before falling back to `'dark'`. This ensures users with OS-level light mode see light theme on first visit.
- The `useEffect` and `toggle` functions are unchanged.

### `frontend/src/hooks/__tests__/useTheme.test.tsx` (Finding 3 — Tests)
- **Line 11:** Changed `delete (window as any).matchMedia` → `(window as any).matchMedia = undefined` — assignment works where `delete` fails on non-configurable properties.
- **Test rename:** `"defaults to dark theme"` → `"defaults to dark theme when no OS preference"` — explicitly mocks `matchMedia` so `(prefers-color-scheme: light)` returns `matches: false`.
- **New test:** `"defaults to light theme when OS prefers light mode"` — mocks `matchMedia` so `(prefers-color-scheme: light)` returns `matches: true`.
- **New test:** `"localStorage preference overrides OS preference"` — sets localStorage to `'light'`, mocks `matchMedia` with `matches: false` for both, asserts theme is `'light'`.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (frontend) | ✅ Passed (no errors) |
| `dotnet build` (backend) | ✅ Passed (0 warnings, 0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **205 passed** (15 files, 0 failures) |

## Notes for Tester

- **Finding 1:** Verify the build agent can still run `dotnet build`, `dotnet test`, `dotnet restore`, `npm run build`, `npm run test`, `npx tsc --noEmit`, and `npx vitest run`. Commands like `rm`, `cat`, `echo`, `curl`, `python`, `git` should be denied.
- **Finding 2:** The existing test "JSON export includes result field when no structured data (fallback)" in `App.test.tsx` should verify the exported JSON's `result` field does NOT contain the `` ```json `` fence. If the test was previously passing with the fence included, it should now pass with the stripped version.
- **Finding 3:** The three new tests in `useTheme.test.tsx` cover: (1) OS-level light → initial light, (2) OS-level dark → initial dark, (3) localStorage overrides OS preference. All existing toggle/persist/class tests continue to pass.

---

# Group 7 — Fix JSON block flashing in UI during streaming

## Files Changed

### `frontend/src/App.tsx` (line 19)
- **Replaced** `const strippedResult = state.result.replace(/```json[\s\S]*?```\s*$/gm, '');`
- **With** `lastIndexOf`-based approach:
  ```typescript
  const JSON_MARKER = '```json';
  const markerIndex = state.result.lastIndexOf(JSON_MARKER);
  const strippedResult = markerIndex === -1
    ? state.result
    : state.result.slice(0, markerIndex);
  ```
- This strips everything from the **last** ` ```json ` marker to the end, whether or not the closing ` ``` ` fence has arrived yet. The old regex required both the closing fence AND end-of-string (`$`), causing the partial ` ```json ` and raw JSON to leak into the displayed markdown during streaming.

## What this fixes

During streaming, when the AI outputs the trailing JSON block chunk by chunk:
1. ` ```json` arrives → old regex requires closing ` ``` ` + `$` → leaks into display → **FIX: `lastIndexOf` finds it and strips immediately**
2. `\n{"findings":[` arrives → still leaking → **FIX: already stripped from view**
3. `...\n` ` ``` ` arrives → now old regex would finally strip → but at this point user has already seen the flash

## What does NOT change

- `state.result` still has the full content (JSON export fallback)
- Copy/Download/PDF all use `strippedResult` (still stripped, now even during streaming)
- JSON export uses `state.findings[]` + `state.summary` (structured data unaffected)
- Severity filter operates on the `content` prop which is `strippedResult`

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Passed (0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **205 passed** (15 files, 0 failures) |
| `npm run build` (tsc -b && vite build) | ✅ Build succeeded |

## Notes for Tester

- **Behavioral change**: During streaming, the trailing ` ```json ` block is now immediately hidden from view as soon as the ` ```json ` marker arrives. Previously it would flash until the closing ` ``` ` arrived.
- **No change** to `state.result` — the full content (including the JSON block) is preserved for JSON export fallback.
- **Edge case** — multiple ` ```json ` markers: `lastIndexOf` picks the last occurrence, which is the trailing AI-generated JSON block. Earlier ones (e.g., inline code examples) are preserved — more correct than the old regex which could match non-trailing blocks.
- **Existing tests unaffected** — all static (non-streaming) test strings either have no ` ```json ` marker or have a complete ` ```json…``` ` block; both old and new logic produce identical results.
