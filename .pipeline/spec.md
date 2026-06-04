# Don't pass CancellationToken to CompleteChatStreamingAsync

## OPEN QUESTIONS

None.

---

## Why this change is needed

The OpenAI SDK v2.10.0's `CompleteChatStreamingAsync` behaves differently when a `CancellationToken` is passed vs. when it is not:

| Scenario | Token | Observed behavior |
|----------|-------|-------------------|
| Test harness | No token | Stream completes in ~0.8s |
| Backend | 45s linked token | Yields zero chunks for 45s until timeout |

The root cause is an SDK-level issue (or OpenAI/Groq backend interaction) where a non-default `CancellationToken` delays or suppresses streaming chunks. Passing `CancellationToken.None` restores normal streaming behavior.

### Why this is safe

- The 45s timeout is still enforced by `token.ThrowIfCancellationRequested()` in `AuditEndpoints.cs` (line 49), which runs **between** chunks in the `await foreach` loop.
- Client disconnect (browser tab close, Escape key) still works: ASP.NET's `CancellationToken` (`ct`) is linked via `CancellationTokenSource.CreateLinkedTokenSource(ct)` on line 41, so when the client disconnects, `ct` is cancelled, the linked token fires, and `ThrowIfCancellationRequested` on the next iteration catches it.
- All catch blocks in `AuditEndpoints.cs` remain unchanged and will handle `OperationCanceledException` correctly.

### Trade-off

When the client disconnects, the SDK reads **one extra chunk** before the loop exit condition is checked. This is a minor resource leak (one extra chunk processed but not delivered), not a correctness issue.

---

## File changes

### 1. MODIFY: `backend/src/Services/SpecAuditService.cs` — one line change

**Line 197:** Replace the `CancellationToken` parameter in `CompleteChatStreamingAsync` with `CancellationToken.None`.

```csharp
// Before:
await foreach (var update in _chatClient.CompleteChatStreamingAsync(messages, options, ct))

// After:
await foreach (var update in _chatClient.CompleteChatStreamingAsync(messages, options, CancellationToken.None))
```

The `ct` parameter from `AuditAsync` (line 179) is still used implicitly via `[EnumeratorCancellation]` — when the caller disposes the `IAsyncEnumerable`, enumeration stops. The explicit token on the SDK call is what causes the bug.

### 2. DELETE: `ai-test/` directory (if still present)

Diagnostic test harness, no longer needed. Remove the entire directory tree:

- `ai-test/ai-test.csproj`
- `ai-test/Program.cs`
- `ai-test/bin/`
- `ai-test/obj/`

**Command (PowerShell):**
```powershell
if (Test-Path ai-test) { Remove-Item -Recurse -Force ai-test }
```

**Command (bash):**
```bash
rm -rf ai-test
```

### 3. Files NOT modified

| File | Reason |
|------|--------|
| `backend/src/Endpoints/AuditEndpoints.cs` | Already correct — 45s linked token, `ThrowIfCancellationRequested` between chunks, proper catch blocks |
| `backend/backend.csproj` | Already has `OpenAI v2.10.0` reference — no change needed |
| `SpecAudit.slnx` | Does not reference `ai-test/` — no change needed |

---

## Edge cases the implementation must handle

| Edge case | Handling |
|-----------|----------|
| `ai-test/` already deleted | Check directory existence before deleting (idempotent) |
| `ai-test/bin/` or `ai-test/obj/` has read-only files | Use `-Recurse -Force` or `-f` to force delete |
| SDK version changes | This fix is specific to OpenAI SDK v2.10.0 behavior; if the SDK is upgraded, re-test whether `ct` works correctly |
| No response from AI (zero chunks) | `await foreach` completes immediately, `fullText` is empty, no structured JSON extracted — handled by existing code |

---

## Existing patterns to follow

The change follows the same pattern already proven in the test harness: no `CancellationToken` on `CompleteChatStreamingAsync`. The rest of the service (`OpenAIClient` construction, `ChatCompletionOptions`, response chunking, structured JSON extraction) is unchanged from the current implementation.

---

## Verification steps

```bash
# 1. Build the backend (0 errors expected)
dotnet build backend/backend.csproj

# 2. Run tests (21/21 pass expected)
dotnet test backend.Tests/backend.Tests.csproj

# 3. Confirm the fix is in place (should show CancellationToken.None)
rg -n "CompleteChatStreamingAsync" backend/src/Services/SpecAuditService.cs

# 4. Confirm no other SDK call passes a non-default CancellationToken
rg -n "CompleteChatStreamingAsync.*ct[^N]" backend/src

# 5. Confirm ai-test/ is gone
if (Test-Path ai-test) { Write-Warning "ai-test still present" } else { Write-Host "OK - ai-test deleted" }

# 6. Docker smoke test: POST a spec and confirm audit completes in <15s
docker compose build
docker compose run --rm backend curl -s -X POST http://backend:8080/api/audit -H "Content-Type: application/json" -d '{"spec": "openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}"}'
```

All commands must return exit code 0. The Docker smoke test must return a complete SSE stream ending with `[SPECAUDIT_STRUCTURED]{...}` within 15 seconds.
