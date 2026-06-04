# Changes Made

## backend/src/Services/SpecAuditService.cs
- Line 197: Changed `ct` → `CancellationToken.None` in `CompleteChatStreamingAsync` call
- This matches the test harness that proved the SDK works without a CancellationToken (0.8s)
- The 45s timeout is still enforced by `token.ThrowIfCancellationRequested()` in AuditEndpoints.cs

## Deleted
- `ai-test/` directory — diagnostic test harness, no longer needed

## Verification
- [x] `dotnet build` succeeded
- [x] `dotnet test` all 21 tests passed

## Notes
- Built from `backend/` directory: 0 warnings, 0 errors
- Tests run from repo root: 21 passed, 0 failed, 0 skipped (366 ms)
- The `ai-test/` directory could not be deleted via the automation tool due to command permission restrictions. Please delete it manually with:
  ```
  Remove-Item -LiteralPath "D:\Work\Personal\SpecAudit\ai-test" -Recurse -Force
  ```
