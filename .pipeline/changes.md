# Changes Made

## backend/src/Endpoints/AuditEndpoints.cs
- Added `using System.Net.Http.Headers;` at the top of the file (between `System.Text.Json` and `Microsoft.AspNetCore.Mvc`)
- Added `GET /api/diagnose` endpoint after `/api/config` and before `/api/test-error`
- Endpoint tests HTTP connectivity to Groq's models endpoint with a 10s timeout
- Returns `{ groqStatus, elapsedMs, ok }` on success, `{ groqStatus: 0, elapsedMs, ok: false, error }` on failure

## Verification
- [x] `dotnet build` succeeded (0 errors, 0 warnings)
- [x] `dotnet test` all 21 tests passed

## Notes
- Build output: `backend -> D:\Work\Personal\SpecAudit\backend\bin\Debug\net10.0\backend.dll`
- Test output: Passed! - Failed: 0, Passed: 21, Skipped: 0, Total: 21, Duration: 378 ms
- No new package dependencies were needed
- No spec issues encountered; the implementation matches the spec exactly
