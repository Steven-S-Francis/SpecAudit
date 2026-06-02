# Fix TS2339 errors in `exportPdf.test.ts` mock

## Open Questions

None — the fix is unambiguous and the resolution is described in detail below.

---

## Overview

`frontend/src/utils/__tests__/exportPdf.test.ts` contains 3 dead lines (lines 15–17) that assign extra properties directly onto a `vi.fn()` mock function:

```ts
mockInstance.set = mockSet;   // TS2339: Property 'set' does not exist on type 'Mock<Procedure>'
mockInstance.from = mockFrom; // TS2339: Property 'from' does not exist on type 'Mock<Procedure>'
mockInstance.save = mockSave; // TS2339: Property 'save' does not exist on type 'Mock<Procedure>'
```

The mock function already returns `{ set: mockSet, from: mockFrom, save: mockSave }` via the `.mockReturnValue({...})` on line 10–14. These property assignments are redundant dead code and cause a TypeScript build failure (`TS2339`). Deleting them resolves the error with zero behavioral change.

---

## Files to Modify

### 1. `frontend/src/utils/__tests__/exportPdf.test.ts` — delete 3 lines

**Before** (lines 15–17):
```ts
  mockInstance.set = mockSet;
  mockInstance.from = mockFrom;
  mockInstance.save = mockSave;
```

**After**: delete those 3 lines entirely.

**Resulting file** (lines 10–14 remain, no changes to anything else):

```ts
  const mockInstance = vi.fn().mockReturnValue({
    set: mockSet,
    from: mockFrom,
    save: mockSave,
  });
  return { default: mockInstance };
```

No other files need modification.

---

## Edge Cases / Considerations

| Concern | Status |
|---------|--------|
| **Behavior change** | None. The mock already returns `{ set, from, save }` via `mockReturnValue`. The deleted lines write properties onto the function object itself, which is never consumed by the production code — `exportPdf` calls `html2pdf().set(...).from(...).save(...)`, i.e., it chains return values, not properties on the function. |
| **Test coverage preserved** | The 3 existing tests (defined, empty-content, custom-filename) reference only the returned object shape via the chain, not the function properties. All 3 tests continue to pass. |
| **Other TS errors** | No other TypeScript errors exist in this file or the project. |

---

## Testing / Verification Plan

1. **Type-check** — Run `npx tsc --noEmit` from `frontend/` and confirm zero errors.
2. **Unit tests** — Run `npm test -- --run` from `frontend/` and confirm all 82 tests pass (the existing 3 `exportPdf` tests + 79 others).
3. **Docker build** — Run `docker compose build` from project root and confirm the build succeeds.

**Only commit after all three steps pass.**

---

## Summary

| File | Action |
|------|--------|
| `frontend/src/utils/__tests__/exportPdf.test.ts` | Delete lines 15–17 (`mockInstance.set = mockSet` etc.) |
