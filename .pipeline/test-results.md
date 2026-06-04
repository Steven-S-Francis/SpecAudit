# Test Results

## Summary
- Tests ran: 274 (29 backend + 245 frontend)
- Passed: 274
- Failed: 0
- Build errors: None
- TypeScript errors: None

## Results — Backend Tests (29 passed)

| Test | Status |
|------|--------|
| GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk | ✅ PASS |
| GetDiagnose_UsesOptionsInjection | ✅ PASS |
| GetDiagnose_HandlesChatCompletionsFailureGracefully | ✅ PASS |
| GetDiagnose_RespondsWithinReasonableTime | ✅ PASS |
| GetDiagnoseDefault_IsRawMode | ✅ PASS |
| GetDiagnoseSdkMode_ReturnsExpectedContract | ✅ PASS |
| GetDiagnoseSdkMode_HandlesFailureGracefully | ✅ PASS |
| GetDiagnose_InvalidModeFallsBackToRaw | ✅ PASS |
| Other backend tests (21) | ✅ PASS |

## Results — Frontend Tests (245 passed, 17 files)

All 17 test files passed with 245 tests total.

## Results — TypeScript

✅ Zero errors (`npx tsc --noEmit` passed cleanly).

## New Tests Verified

The 4 new tests added (in `backend.Tests/DiagnoseEndpointTests.cs`) cover:

| Test | Coverage |
|------|----------|
| `GetDiagnoseDefault_IsRawMode` | No `mode` param defaults to raw mode (checks `error` field present, `response`/`finishReason` absent) |
| `GetDiagnoseSdkMode_ReturnsExpectedContract` | SDK mode returns `{ groqStatus: 0, elapsedMs, ok: false, error }` on connection failure |
| `GetDiagnoseSdkMode_HandlesFailureGracefully` | SDK mode does not throw unhandled exception on connection refused; `ok` is false, `elapsedMs > 0` |
| `GetDiagnose_InvalidModeFallsBackToRaw` | Unrecognized mode value (`invalid`) falls back to raw mode shape |

## Notes

- **Expected connection failures**: All tests configure `BaseUrl = http://localhost:1` which triggers connection refused errors. This is intentional — tests verify graceful failure handling with `ok: false`, `groqStatus: 0`, and an error message present.
- **SDK mode timing**: SDK mode takes ~16s due to the OpenAI SDK's built-in retry policy (4 retries) against a refusing connection. All assertions pass correctly.
- **Raw mode timing**: Raw mode uses a direct `HttpClient` with a 10s timeout; each raw mode test completes in ~4s (TCP connection timeout on localhost closed port in Windows).

## Artifacts

### Compilation output (backend)
```
  backend -> D:\Work\Personal\SpecAudit\backend\bin\Debug\net10.0\backend.dll
  backend.Tests -> D:\Work\Personal\SpecAudit\backend.Tests\bin\Debug\net10.0\backend.Tests.dll
Build succeeded.
    0 Warning(s)
    0 Error(s)
Time Elapsed 00:00:01.09
```

### Test run output (backend, last 30 lines)
```
[04:17:21 INF] Application is shutting down...
[04:17:21 INF] Application is shutting down...
[04:17:21 INF] Application is shutting down...
[04:17:21 INF] Application is shutting down...
[04:17:21 INF] Application is shutting down...
[04:17:21 INF] Application is shutting down...
[04:17:21 INF] Application is shutting down...
[04:17:21 INF] Application is shutting down...
[xUnit.net 00:00:56.58]   Finished:    backend.Tests
  Passed backend.Tests.DiagnoseEndpointTests.GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk [4 s]

Test Run Successful.
Total tests: 29
     Passed: 29
 Total time: 56.9565 Seconds
     1>Done Building Project "...\backend.Tests.csproj" (VSTest target(s)).

Build succeeded.
    0 Warning(s)
    0 Error(s)
Time Elapsed 00:00:58.24
```

### Frontend test output
```
Test Files  17 passed (17)
     Tests  245 passed (245)
  Duration  4.28s
```

### TypeScript output
```
(no errors)
```
