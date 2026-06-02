# Spec: Fix Export JSON — Add Trailing Newline

## Overview

`JSON.stringify(auditResult, null, 2)` produces JSON without a trailing newline. VSCode Prettier's default `insertFinalNewline: true` expects files to end with `\n`, so exported `.json` files are flagged as needing formatting. The fix appends `'\n'` to the serialized string before creating the Blob.

This is a pure frontend bugfix — no schema changes, no new features, no backend changes.

---

## Open Questions

**None.** The fix is well-defined with no ambiguity.

---

## Affected Files

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/App.tsx` | **Modify** | Append `'\n'` to `JSON.stringify` output on line 61 |
| `frontend/src/components/features/__tests__/App.test.tsx` | **Modify** | Add a regression test verifying the Blob content ends with `\n` |

### Not modified

- `frontend/src/types/audit.ts` — no schema change
- `frontend/src/hooks/useAudit.ts` — no state change
- `backend/` — no changes needed
- Any other test files — the existing `useAudit` hook tests are unaffected; only the JSON export Blob assertion needs a guard

---

## Detailed Changes

### 1. `frontend/src/App.tsx` — Append trailing newline

**Line 61** currently reads:

```typescript
const jsonString = JSON.stringify(auditResult, null, 2);
```

**Change to:**

```typescript
const jsonString = JSON.stringify(auditResult, null, 2) + '\n';
```

**Rationale:** The `+ '\n'` ensures the output file ends with a single Unix line terminator. No other part of the handler changes (Blob type, filename, try/catch, dependency array — all remain identical).

### 2. `frontend/src/components/features/__tests__/App.test.tsx` — Add regression test

Insert a new test inside the existing `describe('App Export JSON Button', ...)` block (after the last test, before the closing `});`).

**New test (test 22, or numbered to fit):**

```typescript
it('appends trailing newline to JSON output (Prettier compatibility)', async () => {
  const reportContent = 'Trailing newline test';
  mockUseAudit.mockReturnValue({
    state: { status: 'complete', result: reportContent, error: null, specFormat: null },
    audit: vi.fn(),
    abort: vi.fn(),
    reset: vi.fn(),
  });

  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();

  const origCreateElement = document.createElement.bind(document);
  const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
  mockAnchor.click = vi.fn();
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'a') return mockAnchor as unknown as HTMLElement;
    return origCreateElement(tagName);
  });

  render(<App />);
  await waitFor(() => {});

  const button = screen.getByRole('button', { name: /export json/i });
  await act(async () => {
    fireEvent.click(button);
  });

  const blobArg = createObjectURL.mock.calls[0][0] as Blob;
  const blobText = await blobArg.text();

  // The last character must be '\n'
  expect(blobText.endsWith('\n')).toBe(true);
  // The content before the trailing newline must be valid JSON
  const jsonContent = blobText.slice(0, -1);
  expect(() => JSON.parse(jsonContent)).not.toThrow();
  const parsed = JSON.parse(jsonContent);
  expect(parsed).toHaveProperty('result', reportContent);
});
```

**Note:** No existing tests need modification. All existing tests that parse the Blob content use `JSON.parse(blobText)`, which tolerates trailing whitespace/newlines. The only test that examines the raw string (`test 12: Pretty-printed JSON (2-space indent) is valid`) checks for a substring (`'\n  '`) which is still present after the fix. No existing assertions break.

**Pattern to follow:** The new test follows the exact same spy/mock pattern as `test 4` (`creates correct JSON envelope on click`, lines 369–419 of the current file) and `test 21` (`handles very large result content`, lines 655–691).

---

## Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| 1 | **Empty result** (`state.result === ''`) | `JSON.stringify({...}, null, 2) + '\n'` produces valid JSON with a trailing newline. `JSON.parse` ignores the trailing newline. Same behavior as before, plus the newline. |
| 2 | **Existing tests that mock the handler** | No test directly mocks `handleExportJson`; all tests either render `<App />` and click the button, or independently create `JSON.stringify` output. Tests that independently create JSON strings (tests 6–16) will NOT be affected — they continue to work as before without a trailing newline because they test the `AuditResult` shape and JSON parseability, not the handler's exact output. |
| 3 | **Multiple exports** | Each export creates a fresh string with `JSON.stringify(...) + '\n'`. No accumulator state to leak. |
| 4 | **Very large result** | Adding one extra byte (`'\n'`) per export is negligible. No performance concern. |
| 5 | **Cross-platform newlines** | The fix uses `'\n'` (LF), not `'\r\n'`. This matches VSCode Prettier's default `endOfLine: "lf"` and Unix convention. JSON is a text format; JSON.parse accepts LF only. |

---

## Test Strategy

### Existing tests — no changes needed

All 21 existing tests in `describe('App Export JSON Button', ...)` continue to pass:

- **Tests using `JSON.parse(blobText)`** (tests 4, 14, 18, 19, 21): Unaffected — `JSON.parse` ignores trailing whitespace/newlines.
- **Test 12** (`contains '\n  '` for pretty-printing): Unaffected — the inner indentation newlines are still present.
- **Tests 1–3** (RTL button visibility): Unaffected — no change to rendering logic.
- **Tests 5–11, 13, 15–17, 20** (unit/type tests): Unaffected — they test `AuditResult` object construction or JSON parseability, not the raw string from the handler.

### New test — 1 test added

| # | Test | Assertions | Layer |
|---|------|------------|-------|
| 22 | **Trailing newline (Prettier compatibility)** | `blobText.endsWith('\n')` is true; content before newline is valid JSON and round-trips correctly | RTL (full `App` render + click) |

**Total after fix:** 22 tests in `describe('App Export JSON Button', ...)`.

---

## Implementation Order

1. Edit `frontend/src/App.tsx` — change line 61 to `JSON.stringify(auditResult, null, 2) + '\n'`
2. Edit `frontend/src/components/features/__tests__/App.test.tsx` — add the trailing newline regression test
3. Run `npx tsc --noEmit` in `frontend/` to verify zero TypeScript errors
4. Run `npm test -- --run` in `frontend/` to verify all tests pass (including the new regression test)
5. Commit

---

## Verification

| Step | Command | Expected |
|------|---------|----------|
| 1. TypeScript | `Set-Location frontend; npx tsc --noEmit` | Zero errors |
| 2. Tests | `Set-Location frontend; npm test -- --run` | All 22 JSON export tests pass; all other existing tests pass |
| 3. Manual (optional) | Export JSON from browser, inspect file in VSCode | File ends with `\n`; Prettier does not flag it |
