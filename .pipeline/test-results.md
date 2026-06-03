# Test Results

## Summary
PASS

## Frontend Tests (`npx tsc -b`)
- Status: ✅ Pass
- `tsc -b` (Docker build equivalent) completed with 0 errors

## Frontend Tests (`npx tsc --noEmit`)
- Status: ✅ Pass
- `tsc --noEmit` completed with 0 errors

## Frontend Tests (`npx vitest run --reporter=verbose`)
- Count: **205 passed** in **15 test files**
- Status: ✅ Pass
- Failures: None
- All `useTheme` tests pass (6 tests, including `vi` imported explicitly)
- All `useAutoScroll` tests pass (4 tests, including streaming `'auto'` behavior)
- All `exportPdf` tests pass (including CRLF and trailing-space code fence detection)
- All `InputPanel` tests pass (including loading/streaming disabled states)
- All `App` tests pass (including JSON export with stripped result fallback)
- All `filterMarkdownBySeverity` tests pass (including real fixture filtering)
- All integration pipeline tests pass (33 tests)

## Backend Tests (`dotnet test SpecAudit.slnx`)
- Count: **19 passed** in 1 test project
- Status: ✅ Pass
- Failures: None
- All `ExtractStructuredJsonTests` pass (7 tests, including `WithTextAfterJsonBlock_ReturnsJsonString`)
- All `AiOptionsValidationTests` pass (3 tests, including `MissingApiKey`)
- All `EndpointValidationTests` pass (6 tests, including rate-limit-aware endpoints)
- All `UserMessageBuilderTests` pass (3 tests)

## Backend Build (`dotnet build`)
- Status: ✅ Build succeeded
- Warnings: 0
- Errors: 0

## TypeScript
- Status: ✅ Zero errors (`tsc -b` and `tsc --noEmit` both pass)

## Git Ignore
- `nul` is properly gitignored (confirmed via `git check-ignore nul` returns the path)
- No untracked `nul` file in working tree

## Summary of All Checks

| Check | Result |
|-------|--------|
| `npx tsc -b` (Docker build) | ✅ Passed (0 errors) |
| `npx tsc --noEmit` (frontend) | ✅ Passed (0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **205 passed** (15 files) |
| `dotnet build` (backend) | ✅ Build succeeded (0 errors, 0 warnings) |
| `dotnet test SpecAudit.slnx` (backend) | ✅ **19 passed** (0 failures) |
| Git ignore (`nul`) | ✅ Properly ignored |

**All tests pass. No failures to report.**
