# Changes Made

## File Modified

### `backend/src/Services/SpecAuditService.cs`

**What changed:** Replaced the `AuditAsync` method body (lines 167–231) from the old OpenAI SDK streaming implementation to a raw `HttpClient` + SSE line-by-line parsing implementation.

**Before:** The method used `OpenAIClient`, `ApiKeyCredential`, `ChatMessage`, `SystemChatMessage`, `UserChatMessage`, and `CompleteChatStreamingAsync` — types from the `OpenAI`, `OpenAI.Chat`, and `System.ClientModel` namespaces that were already removed from the using statements. This code would not compile.

**After:** The method now:
- Creates a local `HttpClient` with a 45-second timeout
- Serializes a request payload with `system` and `user` messages as anonymous objects using `System.Text.Json`
- Sends a POST to `{BaseUrl}/chat/completions` with a `Bearer` authorization header
- Reads the SSE stream line-by-line using `StreamReader.ReadLineAsync`
- Parses each `data: ` line with `JsonDocument.Parse`, extracting `choices[0].delta.content`
- Yields content tokens as they arrive
- Handles `data: [DONE]` sentinel to break the loop
- Extracts structured JSON from the complete response and yields it as a `[SPECAUDIT_STRUCTURED]` sentinel

**Compilation fixes applied (beyond the spec's exact code):**
1. Changed `data.SequenceEqual("[DONE]"u8)` to `data is ['[', 'D', 'O', 'N', 'E', ']']` — because `data` is `ReadOnlySpan<char>` and `"[DONE]"u8` is `ReadOnlySpan<byte>`, and `SequenceEqual` requires matching types.
2. Changed `JsonDocument.Parse(data)` to `JsonDocument.Parse(data.ToString())` — because `JsonDocument.Parse` has no overload accepting `ReadOnlySpan<char>`.
3. Moved `yield return` outside the `try/catch (JsonException)` block — because C# forbids `yield return` inside a try-block that has a catch clause.

**No other files were modified.** The using statements (`System.Net.Http.Headers`, `System.Runtime.CompilerServices`, `System.Text`, `System.Text.Json`) were already correct.

## Build Status

- `dotnet build` — **C# compilation succeeded** (0 CSxxxx errors) in all 4 attempts.
- The persistent `MSB3021/MSB3027` errors are **not compilation errors**. They are file-copy failures caused by a stale `backend.exe` process (PID 44652) locking the output binary at `bin\Debug\net10.0\backend.exe`. The compiled assembly (`backend.dll` and `backend.pdb`) was successfully produced in `obj\Debug\net10.0\`.
- **To complete a clean build**, stop the running `backend` process (PID 44652) and re-run `dotnet build`.

## Tester Focus

1. Verify the SSE parsing handles all edge cases listed in the spec: `[DONE]`, heartbeat lines, HTTP errors, cancellation, broken JSON, missing `choices`/`delta.content`, empty responses.
2. Verify `ExtractStructuredJson` and `BuildUserMessage` (unchanged helpers) still work correctly with the new output format.
3. Manual tests: POST a 355-char spec, POST a 6995-char spec, press Escape during streaming, verify `GET /api/diagnose?mode=sdk` and `GET /api/diagnose?mode=raw` still work.
