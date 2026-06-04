# Test Results

## Backend Tests

**Command:** `dotnet test backend.Tests/backend.Tests.csproj`

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
- `backend.Tests.DiagnoseEndpointTests.GetDiagnose_HandlesUnreachableEndpointGracefully`
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
[xUnit.net 00:00:00.08]   Starting:    backend.Tests
  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_SpecContentAppearsAfterFormatHint [9 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithInvalidJson_ReturnsNull [9 ms]
  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithYamlHint_IncludesFormatInMessage [< 1 ms]
  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithNullFormat_FallsBackToAutoDetect [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithMultipleJsonBlocks_ExtractsOnlyLast [2 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithNoJsonBlock_ReturnsNull [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithWhitespaceOnlyBlock_ReturnsNull [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithEmptyCodeBlock_ReturnsNull [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithValidJsonBlock_ReturnsJsonString [< 1 ms]
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString [< 1 ms]
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingBaseUrl_ThrowsInvalidOperationException [119 ms]
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingApiKey_ThrowsInvalidOperationException [6 ms]
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingModelId_ThrowsInvalidOperationException [15 ms]
  Passed backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsSet [213 ms]
  Passed backend.Tests.EndpointValidationTests.PostAudit_WhitespaceOnlySpec_Returns400 [221 ms]
  Passed backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsNotSet [15 ms]
  Passed backend.Tests.EndpointValidationTests.PostAudit_SpecExceedsMaxLength_Returns413 [16 ms]
  Passed backend.Tests.EndpointValidationTests.GetConfig_DoesNotReturnApiKey [10 ms]
  Passed backend.Tests.EndpointValidationTests.PostAudit_EmptySpec_Returns400 [8 ms]
  Passed backend.Tests.EndpointValidationTests.GetConfig_ReturnsProviderName [9 ms]
  Passed backend.Tests.EndpointValidationTests.PostAudit_TrimmedSpec_AcceptsSpec [117 ms]
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_RespondsWithinReasonableTime [4 s]
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_UsesOptionsInjection [4 s]
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_HandlesUnreachableEndpointGracefully [4 s]
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk [4 s]

Test Run Successful.
Total tests: 25
     Passed: 25
 Total time: 16.7572 Seconds
```

## New Tests Written

- **`backend.Tests/DiagnoseEndpointTests.cs`** — 4 tests for the `GET /api/diagnose` endpoint:

  1. **`GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk`** — Verifies the endpoint returns HTTP 200 with JSON containing the three required fields (`groqStatus`, `elapsedMs`, `ok`) with correct value kinds (number, number, boolean).

  2. **`GetDiagnose_UsesOptionsInjection`** — Verifies `IOptions<AiOptions>` is properly injected by confirming the endpoint executes successfully (200 OK) and `elapsedMs` is positive, proving the handler ran without DI-related exceptions.

  3. **`GetDiagnose_HandlesUnreachableEndpointGracefully`** — Verifies the error path: when the Groq API is unreachable (configured as `http://localhost:1` which actively refuses connections), the endpoint returns `ok: false`, `groqStatus: 0`, and includes a non-empty `error` message.

  4. **`GetDiagnose_RespondsWithinReasonableTime`** — Verifies the endpoint responds within its configured 10-second timeout. Uses `Stopwatch` to measure HTTP response time and asserts < 9s to allow for CI variance.

**Conclusion:** All tests pass. The `/api/diagnose` endpoint is correctly wired via `WebApplicationFactory<Program>` with in-memory configuration, handles unreachable endpoints gracefully, and returns the expected JSON shape.
