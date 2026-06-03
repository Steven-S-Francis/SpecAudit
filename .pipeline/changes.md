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
