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
