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
