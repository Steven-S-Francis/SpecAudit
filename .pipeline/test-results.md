# Test Results

## Summary
PASS

## Backend Tests

**Command:** `dotnet test backend.Tests/backend.Tests.csproj --verbosity detailed`

**Result:** PASS

**Summary:**
- Total: 25
- Passed: 25
- Failed: 0
- Skipped: 0

**Passed Tests:**
- `backend.Tests.AiOptionsValidationTests.Startup_MissingApiKey_ThrowsInvalidOperationException`
- `backend.Tests.AiOptionsValidationTests.Startup_MissingBaseUrl_ThrowsInvalidOperationException`
- `backend.Tests.AiOptionsValidationTests.Startup_MissingModelId_ThrowsInvalidOperationException`
- `backend.Tests.DiagnoseEndpointTests.GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk`
- `backend.Tests.DiagnoseEndpointTests.GetDiagnose_UsesOptionsInjection`
- `backend.Tests.DiagnoseEndpointTests.GetDiagnose_HandlesChatCompletionsFailureGracefully`
- `backend.Tests.DiagnoseEndpointTests.GetDiagnose_RespondsWithinReasonableTime`
- `backend.Tests.EndpointValidationTests.GetConfig_DoesNotReturnApiKey`
- `backend.Tests.EndpointValidationTests.GetConfig_ReturnsProviderName`
- `backend.Tests.EndpointValidationTests.PostAudit_EmptySpec_Returns400`
- `backend.Tests.EndpointValidationTests.PostAudit_SpecExceedsMaxLength_Returns413`
- `backend.Tests.EndpointValidationTests.PostAudit_TrimmedSpec_AcceptsSpec`
- `backend.Tests.EndpointValidationTests.PostAudit_WhitespaceOnlySpec_Returns400`
- `backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithEmptyCodeBlock_ReturnsNull`
- `backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithInvalidJson_ReturnsNull`
- `backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithMultipleJsonBlocks_ExtractsOnlyLast`
- `backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithNoJsonBlock_ReturnsNull`
- `backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString`
- `backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithValidJsonBlock_ReturnsJsonString`
- `backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithWhitespaceOnlyBlock_ReturnsNull`
- `backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsNotSet`
- `backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsSet`
- `backend.Tests.UserMessageBuilderTests.BuildUserMessage_SpecContentAppearsAfterFormatHint`
- `backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithNullFormat_FallsBackToAutoDetect`
- `backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithYamlHint_IncludesFormatInMessage`

**Details:**
```
Test run for D:\Work\Personal\SpecAudit\backend.Tests\bin\Debug\net10.0\backend.Tests.dll (.NETCoreApp,Version=v10.0)
VSTest version 18.0.1 (x64)

Starting test execution, please wait...
A total of 1 test files matched the specified pattern.
[xUnit.net 00:00:00.00] xUnit.net VSTest Adapter v2.8.2+699d445a1a (64-bit .NET 10.0.3)
[xUnit.net 00:00:00.05]   Discovering: backend.Tests
[xUnit.net 00:00:00.07]   Discovered:  backend.Tests
[xUnit.net 00:00:00.07]   Starting:    backend.Tests
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithInvalidJson_ReturnsNull [7 ms]
  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_SpecContentAppearsAfterFormatHint [7 ms]
  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithYamlHint_IncludesFormatInMessage [< 1 ms]
  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithNullFormat_FallsBackToAutoDetect [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithMultipleJsonBlocks_ExtractsOnlyLast [2 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithNoJsonBlock_ReturnsNull [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithWhitespaceOnlyBlock_ReturnsNull [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithEmptyCodeBlock_ReturnsNull [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithValidJsonBlock_ReturnsJsonString [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString [< 1 ms]
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingBaseUrl_ThrowsInvalidOperationException [109 ms]
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingApiKey_ThrowsInvalidOperationException [5 ms]
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingModelId_ThrowsInvalidOperationException [4 ms]
  Passed backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsSet [188 ms]
  Passed backend.Tests.EndpointValidationTests.PostAudit_WhitespaceOnlySpec_Returns400 [195 ms]
  Passed backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsNotSet [12 ms]
  Passed backend.Tests.EndpointValidationTests.PostAudit_SpecExceedsMaxLength_Returns413 [20 ms]
  Passed backend.Tests.EndpointValidationTests.GetConfig_DoesNotReturnApiKey [10 ms]
  Passed backend.Tests.EndpointValidationTests.PostAudit_EmptySpec_Returns400 [14 ms]
  Passed backend.Tests.EndpointValidationTests.GetConfig_ReturnsProviderName [9 ms]
  Passed backend.Tests.EndpointValidationTests.PostAudit_TrimmedSpec_AcceptsSpec [116 ms]
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_RespondsWithinReasonableTime [4 s]
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_HandlesChatCompletionsFailureGracefully [4 s]
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_UsesOptionsInjection [4 s]
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk [4 s]

Test Run Successful.
Total tests: 25
     Passed: 25
 Total time: 16.7488 Seconds
```

## Frontend Tests

**Command:** `npm test -- --run` (vitest)

**Result:** PASS

- Count: 245 tests in 17 files
- Status: ✅ Pass
- Failures: none

**Details:**
```
Test Files  17 passed (17)
     Tests  245 passed (245)
  Duration  4.79s
```

## TypeScript

**Command:** `npx tsc --noEmit`

**Result:** PASS

- Status: ✅ Zero errors

---

## Test Coverage Description

### DiagnoseEndpointTests (4 tests) — `backend.Tests/DiagnoseEndpointTests.cs`

1. **`GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk`** — Verifies the endpoint returns HTTP 200 with JSON containing the three required fields (`groqStatus`, `elapsedMs`, `ok`) with correct value kinds (number, number, boolean). This exercises the chat completions POST path (fails to connect since test uses localhost:1), hitting the exception/catch block.

2. **`GetDiagnose_UsesOptionsInjection`** — Verifies `IOptions<AiOptions>` is properly injected by confirming the endpoint executes successfully (200 OK) and `elapsedMs` is positive, proving the handler ran without DI-related exceptions. Also uses a custom BaseUrl override to ensure config is read.

3. **`GetDiagnose_HandlesChatCompletionsFailureGracefully`** *(renamed from `GetDiagnose_HandlesUnreachableEndpointGracefully`)* — Verifies the error path: when the Groq API is unreachable (configured as `http://localhost:1` which actively refuses connections), the endpoint returns `ok: false`, `groqStatus: 0`, and includes a non-empty `error` message. Validates that connection failures are caught and reported without leaking stack traces to the response.

4. **`GetDiagnose_RespondsWithinReasonableTime`** — Verifies the endpoint responds within its configured 10-second timeout. Uses `Stopwatch` to measure HTTP response time and asserts < 9s to allow for CI variance.

**Note:** All 4 tests exercise the catch/exception path since the test configuration (`http://localhost:1`) causes connection refusal. The `message` field (returned by the implementation for non-200 HTTP responses) is not tested here because the catch block does not set `message` — it sets `error`. The HTTP-error-path (`message` field) requires a mock server that returns a non-200 HTTP response, which these tests do not currently cover.

### Other Backend Tests

- **AiOptionsValidationTests** (3 tests) — Validates startup validation: missing ApiKey, BaseUrl, or ModelId each throw `InvalidOperationException`.
- **EndpointValidationTests** (6 tests) — Validates `POST /api/audit` input validation (empty spec → 400, whitespace → 400, too large → 413, trimmed spec accepted) and `GET /api/config` (no API key leaked, provider name returned).
- **ExtractStructuredJsonTests** (6 tests) — Validates JSON extraction from AI responses (valid block, multiple blocks, no block, whitespace-only, empty code block, text after JSON).
- **UserMessageBuilderTests** (3 tests) — Validates user message construction with format hints, null format fallback, and content ordering.
- **SentryStartupTests** (2 tests) — Validates health endpoint works with and without Sentry DSN configured.

### Frontend Tests

- **245 tests across 17 test files** — All pass. Covers components (App, InputPanel, ResultPanel, Button, ThemeToggle, ScrollButton), hooks (useAudit, useAutoScroll, useTheme), utilities (splitIntoBlocks, filterMarkdown, parseSSEChunks, exportPdf, parseSeverity, highlightText), API client (auditClient), and an integration feature pipeline test.

---

**Conclusion:** All 25 backend tests, all 245 frontend tests, and TypeScript type checking pass. The renamed test `GetDiagnose_HandlesChatCompletionsFailureGracefully` is confirmed present and passing.
