# Changes Summary

## Files Changed

### `frontend/src/App.tsx`
- **Line 61**: Changed `JSON.stringify(auditResult, null, 2)` to `JSON.stringify(auditResult, null, 2) + '\n'`
- **Purpose**: Appends a trailing Unix newline (`\n`) to the exported JSON file so that Prettier's `insertFinalNewline: true` no longer flags it as needing formatting.

### `frontend/src/components/features/__tests__/App.test.tsx`
- **Added test 22** inside `describe('App Export JSON Button', ...)`: `appends trailing newline to JSON output (Prettier compatibility)`
- **Purpose**: Regression test that verifies the Blob content ends with `\n`, the content before the newline is valid JSON, and the JSON round-trips correctly.

## Verification

- `npx tsc --noEmit` — zero TypeScript errors.
- `npm test -- --run` — all 169 tests pass (35 in `App.test.tsx`, up from 34).
