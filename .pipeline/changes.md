# Changes

## Summary

Updated `GET /api/diagnose` to hit Groq chat completions API instead of the models listing endpoint.

## Files Changed

### `backend/src/Endpoints/AuditEndpoints.cs`

- **Added `using System.Text;`** (line 2) for `Encoding.UTF8`.
- **Replaced the `/api/diagnose` handler** (lines 94–140):
  - Now POSTs to `{BaseUrl}/chat/completions` instead of GET to `models`.
  - Uses `HttpRequestMessage` with `client.SendAsync()` instead of `client.GetAsync()`.
  - Removed `BaseAddress` — only sets `client.Timeout`.
  - Sends a minimal chat completion payload: `{ model, messages: [{ role: "user", content: "Say hi in one word" }], max_tokens: 10, stream: false }`.
  - Reads model from `aiOptions.ModelId` instead of hardcoding.
  - On HTTP success (200): returns `{ groqStatus, elapsedMs, ok: true, message: null }`.
  - On HTTP error (non-200): reads response body, extracts first 200 characters, returns `{ groqStatus, elapsedMs, ok: false, message: "..." }`.
  - On exception: returns `{ groqStatus: 0, elapsedMs, ok: false, error: "..." }` (no `message` field).
  - Log messages updated from "models endpoint" / "models endpoint failed" to "chat completions returned" / "chat completions failed".

### `backend.Tests/DiagnoseEndpointTests.cs`

- **Renamed** `GetDiagnose_HandlesUnreachableEndpointGracefully` → `GetDiagnose_HandlesChatCompletionsFailureGracefully`.
- Updated doc comment to say "chat completions failure" instead of "missing/invalid API key or unreachable endpoint".
- No other test changes — the shape test (`GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk`) checks `groqStatus`, `elapsedMs`, and `ok` (not `message`, since the test always hits the exception path via `http://localhost:1`).

## Verification

### Build
```
> dotnet build backend/backend.csproj
  Determining projects to restore...
  All projects are up-to-date for restore.
  backend -> D:\Work\Personal\SpecAudit\backend\bin\Debug\net10.0\backend.dll

Build succeeded.
    0 Warning(s)
    0 Error(s)

Time Elapsed 00:00:03.67
```

### Test
```
> dotnet test backend.Tests/backend.Tests.csproj
  Determining projects to restore...
  All projects are up-to-date for restore.
  backend -> D:\Work\Personal\SpecAudit\backend\bin\Debug\net10.0\backend.dll
  backend.Tests -> D:\Work\Personal\SpecAudit\backend.Tests\bin\Debug\net10.0\backend.Tests.dll
Test run for D:\Work\Personal\SpecAudit\backend.Tests\bin\Debug\net10.0\backend.Tests.dll (.NETCoreApp,Version=v10.0)
VSTest version 18.0.1 (x64)

Starting test execution, please wait...
A total of 1 test files matched the specified pattern.

Passed!  - Failed:     0, Passed:    25, Skipped:     0, Total:    25, Duration: 14 s - backend.Tests.dll (net10.0)
```

### Manual curl test (for reference)
```powershell
# Start the stack:
docker compose down
docker compose build --no-cache
docker compose up -d

# Hit diagnose endpoint:
curl http://localhost:5000/api/diagnose

# Expected success (Groq reachable):
# {"groqStatus":200,"elapsedMs":467,"ok":true,"message":null}

# Expected failure (connection issue):
# {"groqStatus":0,"elapsedMs":10000,"ok":false,"error":"...message..."}

# Expected auth/model error:
# {"groqStatus":401,"elapsedMs":350,"ok":false,"message":"...first 200 chars..."}
```
